@@ 02-Core-Concepts/06-Kube-API-Server
### Introduction

The kube-apiserver is the front door of Kubernetes. Every command you type, every controller, the scheduler and every kubelet talk to it, and it is the only component that reads and writes ETCD. If the API Server is down, you cannot manage the cluster even though existing workloads keep running.

### What the API Server does

```
kubectl / client ──► kube-apiserver ──► etcd
                          ▲   ▲   ▲
                scheduler │   │   │ kubelet
                  controller-manager
```

When a request arrives it passes through a fixed pipeline:

```
 Request
    │
    ▼
 1. Authentication    who are you?
    ▼
 2. Authorization     are you allowed to do this?
    ▼
 3. Admission control may the request be changed or rejected?
    ▼
 4. Validation        is the object valid?
    ▼
 5. Persist to etcd   then respond to the client
```

#### Authentication

Identifies the caller using client certificates, bearer tokens, service account tokens, or OIDC. Users are not stored as objects in Kubernetes; they are identities proven by a credential.

#### Authorization

Decides what an identity may do. Common modes are `Node`, `RBAC`, `Webhook`, `ABAC`. Set with `--authorization-mode=Node,RBAC`.

#### Admission control

Plugins that inspect or modify requests after authorization. Examples: `NamespaceLifecycle` (stops creating objects in a missing namespace), `LimitRanger`, `ResourceQuota`, `ServiceAccount`, `DefaultStorageClass`, `NodeRestriction`. Enabled with `--enable-admission-plugins`.

### Example: a request without kubectl

kubectl is a convenience wrapper over REST. You can call the API directly:

```bash
kubectl proxy --port=8001 &
curl http://localhost:8001/api/v1/namespaces/default/pods
curl http://localhost:8001/apis/apps/v1/namespaces/default/deployments
```

`kubectl proxy` handles authentication for you. Using `curl` against port 6443 directly needs certificates:

```bash
curl https://<apiserver>:6443/api/v1/pods \
  --cacert ca.crt --cert admin.crt --key admin.key
```

### API groups

The API is organised into groups so it can grow:

| Group | Path | Examples |
|---|---|---|
| core (legacy) | `/api/v1` | pods, services, nodes, namespaces, configmaps, secrets, PVs |
| apps | `/apis/apps/v1` | deployments, replicasets, daemonsets, statefulsets |
| batch | `/apis/batch/v1` | jobs, cronjobs |
| networking.k8s.io | `/apis/networking.k8s.io/v1` | ingresses, networkpolicies |
| rbac.authorization.k8s.io | `/apis/rbac.authorization.k8s.io/v1` | roles, rolebindings, clusterroles |
| storage.k8s.io | `/apis/storage.k8s.io/v1` | storageclasses |

This is why YAML has `apiVersion: apps/v1` for a Deployment and `apiVersion: v1` for a Pod. Each resource has verbs: `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`.

```bash
kubectl api-resources                 # all kinds, short names, namespaced?
kubectl api-versions                  # all group/version pairs
kubectl explain pod.spec.containers   # field documentation
```

### How the API Server is run

In a kubeadm cluster it is a static Pod:

```bash
cat /etc/kubernetes/manifests/kube-apiserver.yaml
kubectl -n kube-system get pod kube-apiserver-controlplane
```

In a cluster built "the hard way" it is a systemd service:

```bash
cat /etc/systemd/system/kube-apiserver.service
ps -aux | grep kube-apiserver
```

### Important options

| Option | Purpose |
|---|---|
| `--advertise-address` | IP the API Server advertises to the cluster |
| `--secure-port` | HTTPS port, default **6443** |
| `--etcd-servers` | ETCD URLs |
| `--etcd-cafile`, `--etcd-certfile`, `--etcd-keyfile` | Client cert to talk to ETCD |
| `--client-ca-file` | CA for verifying client certificates |
| `--tls-cert-file`, `--tls-private-key-file` | Its own serving certificate |
| `--kubelet-client-certificate` / `-key` | Cert to talk to kubelets |
| `--service-cluster-ip-range` | Range for Service ClusterIPs |
| `--authorization-mode` | e.g. `Node,RBAC` |
| `--enable-admission-plugins` | Admission plugins on |
| `--service-account-key-file` | Key to verify service account tokens |

### Troubleshooting

- `kubectl` says "connection refused on 6443": the API Server is not running. On the control plane node use `crictl ps -a | grep apiserver`, then `crictl logs <id>`.
- Pod crash after you edited the manifest: a typo in a flag or wrong certificate path. The kubelet restarts the Pod after each edit. Fix the file and wait a minute.
- Check the log files `/var/log/pods/kube-system_kube-apiserver-*` when `crictl` is not clear.
- `kubectl get pods` returning "Unauthorized/Forbidden": an authentication or authorization problem, not an outage.

### CKA exam tips

- Port **6443**. Config at `/etc/kubernetes/manifests/kube-apiserver.yaml`.
- Always back up a manifest before editing: `cp kube-apiserver.yaml /root/`.
- Use `kubectl api-resources` to find short names and API groups quickly.

### Key takeaways

- Only the API Server talks to ETCD.
- Every request goes through authentication, authorization, admission and validation.
- The REST API is split into groups and versions.
- It runs as a static Pod in kubeadm clusters.

@@ 02-Core-Concepts/07-Kube-Controller-Manager
### Introduction

A controller is a process that continuously watches the state of the cluster and works to bring it to the desired state. The kube-controller-manager packages many of those controllers into one binary so they are easy to run. If the scheduler decides where things go, controllers make sure things exist in the right numbers and stay healthy.

### The control loop

Every controller does the same thing forever:

```
     ┌────────────────────────┐
     │ 1. Watch API Server    │
     │ 2. Compare desired vs  │
     │    actual state        │
     │ 3. Take action to fix  │
     └───────────┬────────────┘
                 └────────► repeat
```

Controllers read the state through the API Server and write changes back through it.

### Important controllers

| Controller | What it watches | What it does |
|---|---|---|
| Node | Nodes | Checks heartbeats, marks nodes `NotReady`, evicts Pods |
| ReplicaSet | ReplicaSets | Keeps the right number of Pods |
| Deployment | Deployments | Creates ReplicaSets, handles rollouts |
| Namespace | Namespaces | Cleans up objects when a namespace is deleted |
| Job / CronJob | Jobs | Creates Pods for run-to-completion work |
| Endpoints / EndpointSlice | Services + Pods | Keeps the list of Pod IPs behind a Service |
| ServiceAccount | Namespaces | Creates the `default` service account |
| PersistentVolume | PVs and PVCs | Binds claims to volumes |
| Service (cloud) | Services | Creates cloud load balancers |
| Certificate (CSR) | CSR objects | Signs approved certificates |

There are dozens in total (garbage collector, TTL, cronjob, statefulset, daemonset, and others).

### Node controller in detail

Each kubelet sends a heartbeat. The Node controller uses these timers:

```
node monitor period            5s    how often it checks heartbeats
node monitor grace period     40s    time before marking a node Unknown/NotReady
pod eviction timeout           5m    time before Pods on a dead node are evicted
```

So when a node dies: after ~40 seconds it is marked `NotReady`, and after about five more minutes its Pods are deleted and recreated elsewhere (through taints with `tolerationSeconds` in current versions).

### How it is run

kubeadm: a static Pod.

```bash
cat /etc/kubernetes/manifests/kube-controller-manager.yaml
kubectl -n kube-system get pod kube-controller-manager-controlplane
```

Manual install: a systemd service.

```bash
cat /etc/systemd/system/kube-controller-manager.service
ps -aux | grep kube-controller-manager
```

### Important options

| Option | Purpose |
|---|---|
| `--controllers` | Which controllers are enabled (default: all) |
| `--kubeconfig` | How it reaches the API Server |
| `--cluster-signing-cert-file`, `--cluster-signing-key-file` | CA for signing CSRs |
| `--service-account-private-key-file` | Signs service account tokens |
| `--root-ca-file` | CA bundle injected into service accounts |
| `--leader-elect=true` | Only one active manager among several control-plane nodes |
| `--node-monitor-period`, `--node-monitor-grace-period`, `--pod-eviction-timeout` | Node controller timers |
| `--allocate-node-cidrs`, `--cluster-cidr` | Pod CIDR allocation |

### Seeing it work

```bash
kubectl create deployment web --image=nginx --replicas=3
kubectl get pods -w &
kubectl delete pod -l app=web --wait=false   # controller recreates them
```

### Troubleshooting

- Deployments or ReplicaSets don't create Pods, but the API works: check `kubectl -n kube-system get pod kube-controller-manager-*`. If it crashes, `kubectl logs` or `crictl logs`.
- Typo in the manifest (wrong kubeconfig path, wrong flag): Pod in `CrashLoopBackOff` or missing.
- Certificate signing stays `Pending`: no signing keys configured, or the manager is down.
- A Pod stays `Pending` with no events: that is the scheduler, not this component.

### CKA exam tips

- If you scale a Deployment and nothing happens, check the controller manager and the scheduler in `kube-system`.
- Know that it runs many controllers in one process and is leader-elected.

### Key takeaways

- Controllers implement the watch, compare, act loop.
- One kube-controller-manager process hosts all the built-in controllers.
- Node health, replicas, endpoints and many other behaviours come from it.

@@ 02-Core-Concepts/08-Kube-Scheduler
### Introduction

The scheduler answers one question: which node should this new Pod run on? It does not start anything. It only assigns the Pod to a node by setting `spec.nodeName`, and then the kubelet on that node takes over.

### The scheduling process

Two phases for every Pod without a node:

```
        Pending Pod
            │
            ▼
   ┌──────────────────┐
   │ 1. FILTER        │  remove nodes that cannot run it
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │ 2. SCORE         │  rank the remaining nodes
   └────────┬─────────┘
            ▼
      highest score wins
            ▼
   bind Pod to the node
```

#### Filtering (can the Pod run here?)

- Enough free CPU and memory for the Pod's requests.
- `nodeSelector` and node affinity match.
- Node taints are tolerated by the Pod.
- Ports, volumes and topology constraints satisfied.
- Node is schedulable (not cordoned).

#### Scoring (which is best?)

Plugins give each feasible node a score. Examples: how much resource would remain free, spreading Pods of one service across nodes, preferring nodes with the image already present, preferred affinity rules.

If no node passes filtering, the Pod stays `Pending` and `kubectl describe pod` lists reasons in the Events (for example `0/3 nodes are available: 3 Insufficient cpu`).

### Resource example

```
Pod requests 10 CPU
Node A: 4 free CPUs  -> filtered out
Node B: 16 free      -> leaves 6 after placement
Node C: 12 free      -> leaves 2 after placement
Scoring prefers B (more left over)
```

### Installing and running

kubeadm runs it as a static Pod:

```bash
cat /etc/kubernetes/manifests/kube-scheduler.yaml
kubectl -n kube-system get pod kube-scheduler-controlplane
```

Manual install: download the binary and run it as a service with a kubeconfig and a config file:

```bash
cat /etc/systemd/system/kube-scheduler.service
ps -aux | grep kube-scheduler
```

### Binding is just a field

You can see the result of scheduling:

```bash
kubectl get pod web -o jsonpath='{.spec.nodeName}'
kubectl get pods -o wide        # NODE column
```

Events: `kubectl describe pod web` shows `Scheduled  default-scheduler  Successfully assigned default/web to node01`.

### Troubleshooting

- All new Pods stuck in `Pending` with **no events at all**: the scheduler is not running. Check the Pod in `kube-system`, `crictl ps -a`, and its logs.
- Pods pending with `Insufficient cpu/memory`: lower requests or add capacity.
- Pods pending with `node(s) had taint ... that the pod didn't tolerate`: add a toleration or remove the taint.
- Pods pending with `didn't match Pod's node affinity/selector`: check labels.
- Crashing scheduler after a manifest edit: wrong kubeconfig path or bad flag.

### CKA exam tips

- Pending Pod and no events means look at the scheduler.
- Pods with `nodeName` set bypass the scheduler entirely (you will do this in manual scheduling).
- Config: `/etc/kubernetes/manifests/kube-scheduler.yaml`.
- Later lessons cover taints, affinity, resource limits, and multiple schedulers; this page is just the engine.

### Key takeaways

- Scheduler = filter then score.
- It only assigns; the kubelet starts the Pod.
- `describe pod` Events tell you why scheduling failed.

@@ 02-Core-Concepts/09-Kubelet
### Introduction

The kubelet is the agent on every node. It is the only Kubernetes component that is *not* normally run as a Pod, because it is the thing that runs Pods. It registers its node with the cluster, receives Pod specs from the API Server, tells the container runtime to run them, and reports back status.

```
 API Server ◄──── status, heartbeat ──── kubelet ───CRI───► containerd
            ───── PodSpecs ───────────►     │
                                            ├──► CNI plugin (Pod network)
                                            └──► CSI plugin (volumes)
```

### What the kubelet does

1. **Registers the node** with the API Server on startup.
2. **Watches** for Pods assigned to its node.
3. **Creates containers** through the runtime (CRI), sets up networking (CNI) and volumes.
4. **Monitors** the Pods: runs liveness, readiness and startup probes, restarts failed containers.
5. **Reports** Pod and node status, and sends heartbeats (node `Lease` objects).
6. Runs **static Pods** from a local folder without needing the API Server.
7. Applies **resource limits** (via cgroups), garbage-collects images and containers, and evicts Pods under node pressure.

### Installing

kubeadm installs the kubelet package for you. It is always a **systemd service** on the node, never a Pod.

```bash
systemctl status kubelet
journalctl -u kubelet --no-pager | tail -50
ps -aux | grep kubelet
```

Note: a cluster built by hand does not install the kubelet automatically on workers. With kubeadm, `kubeadm join` configures it.

### Configuration

| File | Purpose |
|---|---|
| `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` | Systemd drop-in with flags and paths |
| `/var/lib/kubelet/config.yaml` | KubeletConfiguration (e.g. `staticPodPath`, `clusterDNS`, `cgroupDriver`, authentication) |
| `/etc/kubernetes/kubelet.conf` | kubeconfig: how it reaches the API Server |
| `/var/lib/kubelet/kubeadm-flags.env` | Extra flags (runtime socket, etc.) |
| `/etc/kubernetes/pki/ca.crt` | Cluster CA for verifying the API Server |

Check the effective settings on a node:

```bash
ps -aux | grep kubelet           # flags on the command line
cat /var/lib/kubelet/config.yaml
```

### Static Pods

`staticPodPath` in the kubelet config (usually `/etc/kubernetes/manifests`) is watched. Any Pod YAML placed there is started by the kubelet itself. That's how kubeadm runs the control plane. (Covered fully in the Scheduling section.)

### Verifying the node

```bash
kubectl get nodes
kubectl describe node node01      # conditions, capacity, allocatable, Pods
```

Conditions to know: `Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`, `NetworkUnavailable`.

### Troubleshooting a node

If a node is `NotReady`:

```bash
ssh node01
systemctl status kubelet
journalctl -u kubelet -f
systemctl restart kubelet
systemctl enable kubelet
```

Typical causes:

- kubelet service stopped or disabled.
- Wrong path to certificates or kubeconfig in `/etc/kubernetes/kubelet.conf`.
- Wrong CA, or the API Server address changed.
- The container runtime is not running (`systemctl status containerd`).
- Swap enabled (kubelet refuses to start by default).
- `cgroupDriver` mismatch between kubelet and runtime.
- Disk full.

### CKA exam tips

- Kubelet is not in `kubectl get pods -n kube-system` because it is a service.
- The first things to check on a `NotReady` node are `systemctl status kubelet` and `journalctl -u kubelet`.
- `/var/lib/kubelet/config.yaml` is where `staticPodPath` lives.

### Key takeaways

- Kubelet is the node agent: registers the node, runs Pods, reports status.
- It runs as a systemd service.
- Node problems usually start with the kubelet and the runtime.

@@ 02-Core-Concepts/10-Kube-Proxy
### Introduction

Pods are ephemeral and their IPs change. A Service gives a stable virtual IP in front of a set of Pods. Kube-proxy is the component that makes that virtual IP actually work on each node.

### Pod network vs Service network

- **Pod network**: every Pod can reach every other Pod directly by IP, with no NAT (provided by the CNI plugin, e.g. Calico, Flannel, Weave, Cilium).
- **Service network**: a virtual range (`--service-cluster-ip-range`, e.g. `10.96.0.0/12`). Service IPs do not exist on any interface. They are only rules.

```
 Pod A ──► Service 10.96.0.15:80 ──► kube-proxy rules ──► Pod B (10.244.1.7)
                                                     └──► Pod C (10.244.2.4)
```

### What kube-proxy does

It runs on every node, watches the API Server for Services and EndpointSlices, and programs the node's kernel so traffic to a Service IP is forwarded to one of the healthy Pods.

Whenever a Service or its Pods change, kube-proxy updates the rules on every node.

### Proxy modes

| Mode | How |
|---|---|
| `iptables` (default) | Adds NAT rules in iptables. Random, stateless selection. |
| `ipvs` | Uses the kernel IPVS load balancer. Better at very large scale, more algorithms. |
| `nftables` | Newer replacement for iptables mode. |
| userspace | Legacy, no longer used. |

Check the mode:

```bash
kubectl -n kube-system get cm kube-proxy -o yaml | grep mode
kubectl -n kube-system logs ds/kube-proxy | head
```

### How it is run

In kubeadm it is a **DaemonSet**, so one Pod per node:

```bash
kubectl get ds -n kube-system
kubectl get pods -n kube-system -o wide | grep kube-proxy
kubectl -n kube-system describe ds kube-proxy
```

Its configuration is in a ConfigMap (`kube-proxy`) mounted in the Pod; `clusterCIDR` and `mode` live there.

### Seeing the rules

On a node:

```bash
iptables -t nat -L KUBE-SERVICES | head
iptables-save | grep my-service
```

Each Service has a chain; each endpoint has a chain with a probability match for load balancing.

### Troubleshooting

- Pod-to-Pod works but Service IP times out: kube-proxy not running on that node, or CNI/iptables problem.
- `kubectl get ds -n kube-system` shows fewer ready kube-proxy than nodes.
- Check `kubectl -n kube-system logs kube-proxy-xxxxx`.
- Wrong `clusterCIDR` in the ConfigMap or wrong Pod network leads to odd NAT behaviour.
- Service has no endpoints: selector doesn't match Pod labels (`kubectl get endpoints svc`).

### CKA exam tips

- Kube-proxy = DaemonSet in `kube-system`.
- It programs rules; it does not itself proxy packets in iptables mode.
- Services are virtual: you cannot `ping` a ClusterIP (no ICMP handling), but TCP/UDP to the port works.

### Key takeaways

- Kube-proxy turns Service IPs into rules that reach Pods.
- One instance per node, usually a DaemonSet.
- iptables is the default mode; ipvs is an alternative.

@@ 02-Core-Concepts/11-Pods
### Introduction

A Pod is the smallest deployable unit in Kubernetes. It wraps one or more containers that share networking and storage and are scheduled together onto one node. You rarely create bare Pods in production (you use Deployments), but everything else is built from them.

### Pod vs container

```
 Pod
┌──────────────────────────────────────────┐
│  shared network namespace (one IP)       │
│  shared volumes                          │
│  ┌────────────┐     ┌────────────┐       │
│  │ container  │     │ container  │       │
│  │  (main)    │     │ (sidecar)  │       │
│  └────────────┘     └────────────┘       │
└──────────────────────────────────────────┘
```

- Containers in a Pod share an IP address and can talk over `localhost`.
- They can share files through volumes.
- They live and die together. To scale, you add more Pods, not more containers in a Pod.
- Usually: one main container per Pod. Extra containers are helpers (sidecars, init containers).

### Creating a Pod

Imperative:

```bash
kubectl run nginx --image=nginx
kubectl run nginx --image=nginx --port=80 --labels="app=web,tier=frontend"
kubectl run busybox --image=busybox --command -- sleep 3600
```

Generate YAML without creating (very useful in the exam):

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
```

Declarative:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: web
spec:
  containers:
  - name: nginx
    image: nginx:1.27
    ports:
    - containerPort: 80
```

```bash
kubectl apply -f pod.yaml
```

The four required top-level fields in every Kubernetes object are `apiVersion`, `kind`, `metadata` and `spec`.

### Inspecting Pods

```bash
kubectl get pods
kubectl get pods -o wide                 # node and IP
kubectl describe pod nginx               # events, state, reasons
kubectl logs nginx
kubectl logs nginx -c sidecar            # specific container
kubectl exec -it nginx -- /bin/sh
kubectl get pod nginx -o yaml
```

### Pod lifecycle and phases

| Phase | Meaning |
|---|---|
| Pending | Accepted but not running: waiting for scheduling or image pull |
| Running | At least one container is running |
| Succeeded | All containers exited successfully (Jobs) |
| Failed | A container exited with an error |
| Unknown | Node unreachable |

Container states: `Waiting`, `Running`, `Terminated`.

### Common statuses and what they mean

| Status | Typical cause | First command |
|---|---|---|
| `Pending` | No node fits, no scheduler | `describe pod` |
| `ContainerCreating` | Pulling image, volume or CNI issue | `describe pod` |
| `ImagePullBackOff` / `ErrImagePull` | Wrong name/tag, private registry | `describe pod` |
| `CrashLoopBackOff` | Container keeps exiting | `logs --previous` |
| `CreateContainerConfigError` | Missing ConfigMap/Secret | `describe pod` |
| `Error` / `OOMKilled` | Crash or out of memory | `describe pod` |

### Editing a Pod

Most Pod fields are immutable. You can change only: `image`, `activeDeadlineSeconds`, `tolerations`, and appended ones. To change others:

```bash
kubectl edit pod nginx          # on rejection, a copy is saved in /tmp
kubectl replace --force -f /tmp/kubectl-edit-xxxx.yaml
# or
kubectl get pod nginx -o yaml > pod.yaml ; vi pod.yaml
kubectl delete pod nginx ; kubectl apply -f pod.yaml
```

### Deleting

```bash
kubectl delete pod nginx
kubectl delete pod nginx --force --grace-period=0   # only when stuck
```

A bare Pod that is deleted is gone for good. Pods managed by a ReplicaSet or Deployment are recreated.

### Restart policy

`restartPolicy` is `Always` (default), `OnFailure` or `Never`, and applies to all containers in the Pod.

```bash
kubectl run job-pod --image=busybox --restart=Never -- echo hi
```

### Why Pods are not enough

Pods don't self-heal after a node failure, can't scale, and can't be updated in a controlled way. Next you meet ReplicaSets and Deployments for that.

### CKA exam tips

- `kubectl run x --image=y --dry-run=client -o yaml` is the fastest way to write Pod YAML.
- Set the namespace with `-n` or by changing the context namespace.
- `kubectl explain pod.spec` shows fields without leaving the terminal.

### Key takeaways

- A Pod is one or more containers sharing network and storage.
- Create with `kubectl run` or YAML with `apiVersion/kind/metadata/spec`.
- Debug with `describe`, `logs`, `exec`.

@@ 02-Core-Concepts/13-Practice-Test-PODs
### How to approach this lab

This lab tests the basics from the Pods lesson. The questions are always answered by looking at the cluster, so build a habit of using a handful of commands.

### Useful commands

```bash
kubectl get pods                        # how many pods?
kubectl get pods -o wide                # which node, which IP
kubectl describe pod <name>             # image, containers, ready, events
kubectl get pod <name> -o yaml          # full spec
kubectl run <name> --image=<image>      # create a pod
kubectl run <name> --image=<image> --dry-run=client -o yaml > pod.yaml
kubectl delete pod <name>
kubectl edit pod <name>                 # fix image names etc.
```

### Typical questions and how to answer them

| Question | How |
|---|---|
| How many Pods exist in the default namespace? | `kubectl get pods --no-headers \| wc -l` |
| What image is used? | `kubectl describe pod x \| grep Image` |
| Which node is it on? | `kubectl get pods -o wide` |
| How many containers in the Pod? | `READY` column `x/y`, y is the total |
| Why is a Pod not ready? | `describe pod`, look at Events and container State |
| Why does one Pod show `ErrImagePull`? | The image name or tag is wrong; fix with `kubectl edit pod` (image is editable) |
| Create a Pod with a given name and image | `kubectl run redis --image=redis` |
| Create a Pod from a YAML file and fix it | `kubectl apply -f`, then read errors |

### Reading the READY column

`READY 1/2` means one of two containers is ready. `kubectl describe pod` shows each container's state: `Waiting` with a reason, `Running`, or `Terminated` with an exit code.

### Fixing a Pod with a bad image

```bash
kubectl edit pod webapp           # change image: nginx → correct image
kubectl get pod webapp -w
```

If the edit is rejected (field immutable), save the temp file path printed, then:

```bash
kubectl replace --force -f /tmp/kubectl-edit-XXXX.yaml
```

### Tips

- Delete a Pod in the lab with `kubectl delete pod name`; add `--force --grace-period=0` only if it hangs.
- Use `-A` or `-n kube-system` to inspect system Pods.
- Practise: write Pod YAML from `--dry-run` rather than from scratch. Speed matters in the exam.

@@ 02-Core-Concepts/14-ReplicaSets
### Introduction

A ReplicaSet makes sure a specified number of identical Pods is running at all times. If a Pod dies, the ReplicaSet creates a replacement. If you have too many, it deletes extras. It provides **high availability** and **load sharing** by running several copies.

### Replication Controller vs ReplicaSet

The Replication Controller (`apiVersion: v1`, `kind: ReplicationController`) is the old technology. ReplicaSet (`apps/v1`) replaces it and adds one important feature: a `selector` with set-based matching. In practice you use Deployments, which create ReplicaSets for you.

### Anatomy

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web          # which Pods this RS owns
  template:             # the Pod blueprint
    metadata:
      labels:
        app: web        # MUST match the selector
    spec:
      containers:
      - name: nginx
        image: nginx
```

Three key parts: **replicas**, **selector**, **template**.

```
 ReplicaSet (replicas=3, selector app=web)
        │
   ┌────┼────┐
   ▼    ▼    ▼
 Pod  Pod  Pod      labels: app=web
```

`apiVersion: apps/v1` requires `selector`. If the template labels don't match the selector, the API Server rejects the object.

### Why labels matter

The ReplicaSet doesn't track Pods by name. It finds Pods by label selector. If a Pod with `app=web` already exists (even one you made manually), the ReplicaSet will count it. If you remove the label from a Pod, the RS no longer owns it and creates another.

### Commands

```bash
kubectl apply -f rs.yaml
kubectl get rs
kubectl describe rs web-rs
kubectl get pods
kubectl delete rs web-rs                # deletes Pods too
```

### Scaling

```bash
# 1. edit the file replicas, then
kubectl replace -f rs.yaml
# 2. imperative
kubectl scale rs web-rs --replicas=6
kubectl scale --replicas=6 -f rs.yaml
# 3. edit live
kubectl edit rs web-rs
```

### Self-healing demo

```bash
kubectl get pods
kubectl delete pod web-rs-xxxxx
kubectl get pods        # a new one already starting
```

### Fixing a broken ReplicaSet

If Pods use a bad image, editing the ReplicaSet does **not** change the existing Pods. Delete the Pods so the RS recreates them with the new template:

```bash
kubectl edit rs web-rs
kubectl delete pod -l app=web
```

(This is exactly why Deployments exist: they do this as a controlled rollout.)

### Troubleshooting

- `selector does not match template labels`: fix labels.
- Replicas not created: check `kubectl describe rs` Events; maybe a quota or admission error.
- Pods stay Pending: scheduling, not the ReplicaSet.

### CKA exam tips

- `kubectl explain rs.spec`.
- Create the YAML from a Deployment dry run and change `kind` if asked for a ReplicaSet.
- Scale shortcut: `kubectl scale rs NAME --replicas=N`.

### Key takeaways

- ReplicaSets maintain a replica count using a label selector and a Pod template.
- Template labels must match the selector.
- Editing the template affects only new Pods.

@@ 02-Core-Concepts/15-Practice-Tests-ReplicaSet
### How to approach this lab

Questions in this lab ask you to read ReplicaSet state, fix a broken one, and scale it.

### Commands

```bash
kubectl get rs                          # DESIRED / CURRENT / READY
kubectl describe rs <name>              # image, selector, events
kubectl get rs <name> -o yaml
kubectl get pods
kubectl delete pod <pod>                # test self-healing
kubectl scale rs <name> --replicas=5
kubectl edit rs <name>
kubectl delete rs <name>
```

### What the columns mean

| Column | Meaning |
|---|---|
| DESIRED | `spec.replicas` |
| CURRENT | Pods the RS has created |
| READY | Pods that passed readiness |

### Typical tasks

1. **How many ReplicaSets/Pods exist?** `kubectl get rs`, `kubectl get pods`.
2. **What image does the RS use?** `kubectl describe rs new-replica-set | grep Image`.
3. **Why aren't Pods ready?** Check Pod events: usually a bad image tag. Fix with `kubectl edit rs`, then **delete the existing Pods** so they are recreated.
4. **Delete one of the Pods.** Watch the RS bring it back. Number stays the same.
5. **Create a ReplicaSet from a file with errors.** Common mistakes: `apiVersion: v1` (should be `apps/v1`), selector labels not matching template labels, mis-indented `template`.
6. **Scale up and down.** `kubectl scale rs name --replicas=N`.

### Fixing a YAML error

```bash
kubectl apply -f replicaset-definition-1.yaml
# error: unable to recognize ... no matches for kind "ReplicaSet" in version "v1"
vi replicaset-definition-1.yaml        # apiVersion: apps/v1
kubectl apply -f replicaset-definition-1.yaml
```

### Tips

- Check `kubectl get pods --show-labels` to compare labels with the selector.
- Remember editing the RS template does not fix running Pods.

@@ 02-Core-Concepts/16-Deployments
### Introduction

A Deployment is the standard way to run stateless applications. It manages ReplicaSets, which manage Pods, and adds rolling updates, rollbacks, pausing, and scaling.

```
 Deployment
     │ creates/owns
     ▼
 ReplicaSet (current)       ReplicaSet (old, scaled to 0 after update)
     │
  ┌──┼──┐
  ▼  ▼  ▼
 Pod Pod Pod
```

Why not just ReplicaSets? When you change the image, a ReplicaSet does nothing to running Pods. A Deployment creates a *new* ReplicaSet and gradually moves Pods across, so there's no downtime and you can roll back.

### YAML

The same as a ReplicaSet but `kind: Deployment`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.26
```

### Create it quickly

```bash
kubectl create deployment web --image=nginx --replicas=3
kubectl create deployment web --image=nginx --dry-run=client -o yaml > deploy.yaml
```

### Inspect

```bash
kubectl get deploy
kubectl get all                            # deploy, rs, pods together
kubectl describe deployment web
kubectl get rs                             # name = <deploy>-<pod-template-hash>
kubectl rollout status deployment web
kubectl rollout history deployment web
```

### Update strategies (summary)

Deployments update with a **RollingUpdate** (default) or **Recreate** strategy. The full detail, `maxSurge`, `maxUnavailable`, and `rollout undo`, comes in the Application Lifecycle section, so here just the commands:

```bash
kubectl set image deployment/web nginx=nginx:1.27
kubectl rollout undo deployment/web
kubectl scale deployment web --replicas=5
```

### Scaling and autoscaling

```bash
kubectl scale deploy web --replicas=10
kubectl autoscale deploy web --min=2 --max=10 --cpu-percent=70    # HPA
```

### Naming

Pod names look like `web-6d4cf56db6-xk2tq`: Deployment name, then ReplicaSet hash, then a random suffix.

### Troubleshooting

- `READY 0/3`: look at the Pods (`describe pod`) for image or scheduling problems.
- `kubectl rollout status` hangs: new Pods are not becoming ready.
- Selector mismatch: Deployment's `selector` is immutable after creation.
- Deleting a Pod of a Deployment just makes a new one; delete the Deployment to remove everything.

### CKA exam tips

- `kubectl create deployment` is the fastest way; use `--dry-run=client -o yaml` and edit.
- `kubectl get all` shows the whole chain.
- Use `kubectl scale`, `set image`, `rollout undo` for quick edits.

### Key takeaways

- Deployment → ReplicaSet → Pods.
- Updates create a new ReplicaSet; the old one is kept for rollback.
- Always prefer Deployments to bare ReplicaSets or Pods.
