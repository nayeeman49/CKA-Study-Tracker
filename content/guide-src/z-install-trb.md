@@ 10-Design-and-Install-Kubernetes-Cluster/01-Designing-a-Kubernetes-Cluster
### Introduction

Before building a cluster, decide what it is for, how big it must be, and what it will run. The design drives the infrastructure choice, node sizes and high-availability needs.

### Purpose

| Purpose | Suggested setup |
|---|---|
| Education / learning | Minikube, kind, k3s, or a single-node kubeadm cluster on a laptop or cloud VM |
| Development / testing | Multi-node cluster, one control plane, several workers; managed service is fine |
| Production hosting | HA control plane (3 nodes), multiple workers, monitoring, backups |

### Production guidance

- Up to **5,000 nodes**, **150,000 Pods**, **300,000 containers**, **100 Pods per node** are the documented upper limits.
- HA: multiple control plane nodes, ideally across failure zones.
- Workers: size to the workload (CPU, memory, disk type, network).
- Use SSD-backed disks for ETCD; consider running ETCD on dedicated nodes for big clusters.

### Workload considerations

| Workload | Needs |
|---|---|
| CPU/memory heavy | Large instances, dedicated node pools, taints |
| Disk intensive | SSD, local storage, fast StorageClasses |
| GPU | GPU nodes with device plugin, taints/tolerations |
| Many small Pods | Many medium nodes |

### Node basics

- 64-bit Linux, a supported container runtime (containerd).
- Control plane nodes do not run workloads (taints).
- Master nodes can host ETCD (stacked) or use external ETCD.

### Key takeaways

- Define purpose, scale, and workload type first; the answers decide the rest.

@@ 10-Design-and-Install-Kubernetes-Cluster/02-Choosing-Kubernetes-Infrastructure
### Introduction

Where and how to run Kubernetes: laptop, on-premise, or cloud; self-managed or managed.

### Local / learning

| Tool | Notes |
|---|---|
| Minikube | Single-node VM or container |
| kind | Clusters in Docker containers, great for CI |
| k3s | Lightweight distribution |
| kubeadm | Bootstraps real clusters on Linux machines |
| Docker Desktop | Single-node built-in |

### Self-hosted (turnkey vs custom)

- **Turnkey**: you provision VMs, a tool configures the cluster (kubeadm, Kubespray, kops, OpenShift, Rancher).
- **Hosted / managed**: the provider runs the control plane (GKE, EKS, AKS, DigitalOcean). You manage workloads and sometimes workers.

| Choice | You manage | Pros | Cons |
|---|---|---|---|
| Self-managed on VMs | Everything | Full control | Operational work |
| Managed | Workloads + workers | Less ops, easy upgrades | Less control, cost |

### Choosing

Consider: team skills, cost, compliance, scale, vendor lock-in, upgrade and support needs.

### Key takeaways

- Learn with kubeadm; run production on managed services unless you need control.

@@ 10-Design-and-Install-Kubernetes-Cluster/03-Configure-High-Availability
### Introduction

A single control plane node is a single point of failure. In an HA cluster you run several control plane nodes behind a load balancer.

```
            kubectl / kubelets
                   │
            ┌──────▼──────┐
            │ Load balancer│  (HAProxy / nginx / cloud LB)  :6443
            └──┬────┬───┬──┘
               ▼    ▼   ▼
             CP1   CP2  CP3
```

### Which components are active

| Component | HA behaviour |
|---|---|
| kube-apiserver | **Active/active**; all instances serve requests |
| kube-scheduler | **Active/passive** via leader election |
| kube-controller-manager | **Active/passive** via leader election |
| ETCD | Raft cluster (leader + followers) |

Leader election uses `--leader-elect=true`, a Lease object in `kube-system`:

```bash
kubectl -n kube-system get lease
```

### Load balancer

Point `kubectl`, kubelets and all components at the LB address, not at a single API server. With kubeadm:

```bash
kubeadm init --control-plane-endpoint "lb.example.com:6443" --upload-certs
kubeadm join lb.example.com:6443 --control-plane --certificate-key <key> --token ...
```

The API server certificate must include the LB DNS name/IP in its SANs.

### Quorum

With ETCD on the control plane nodes you need an odd count: 3 tolerates 1 failure, 5 tolerates 2.

### Key takeaways

- API servers active/active behind an LB; scheduler and controller manager elect a leader.

@@ 10-Design-and-Install-Kubernetes-Cluster/04-ETCD-in-HA
### Introduction

ETCD must also be highly available. This lesson covers topology and quorum for ETCD in HA clusters.

### Topologies

| Topology | Description | Trade-offs |
|---|---|---|
| **Stacked** | ETCD on the same nodes as the control plane | Simple, fewer machines; losing a node loses both |
| **External** | ETCD on dedicated nodes | More resilience, more machines |

### Quorum and fault tolerance

`quorum = floor(N/2) + 1`.

| N | Quorum | Tolerates |
|---|---|---|
| 1 | 1 | 0 |
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

Use odd numbers; 3 or 5 is typical. An even number gives no extra tolerance (4 tolerates 1, like 3). In a network split, the side with the majority continues.

### Setting up

Each member is started with:

```
--name etcd-1
--initial-advertise-peer-urls https://10.0.0.1:2380
--listen-peer-urls https://10.0.0.1:2380
--listen-client-urls https://10.0.0.1:2379,https://127.0.0.1:2379
--advertise-client-urls https://10.0.0.1:2379
--initial-cluster-token etcd-cluster-1
--initial-cluster etcd-1=https://10.0.0.1:2380,etcd-2=https://10.0.0.2:2380,etcd-3=https://10.0.0.3:2380
--initial-cluster-state new
```

The API server lists all members: `--etcd-servers=https://10.0.0.1:2379,https://10.0.0.2:2379,https://10.0.0.3:2379`.

### Operations

```bash
etcdctl member list -w table
etcdctl endpoint status --cluster -w table
etcdctl endpoint health --cluster
```

### Key takeaways

- 3 or 5 members; losing quorum stops writes.

@@ 11-Install-Kubernetes-the-kubeadm-way/01-Introduction-to-Deployment-with-kubeadm
### Introduction

`kubeadm` is the official tool for bootstrapping a Kubernetes cluster on existing machines. It automates certificates, static Pod manifests, and join tokens. It does not provision machines or install a network plugin.

### The process

```
 1. Provision machines (VMs)
 2. Install a container runtime (containerd) + kubeadm, kubelet, kubectl on ALL nodes
 3. kubeadm init   on the control plane node
 4. Install a CNI (Pod network) add-on
 5. kubeadm join   on each worker node
```

### Prerequisites

- 2 CPU, 2 GB RAM minimum per machine for control plane (more for production).
- Unique hostname, MAC address and product_uuid.
- Required ports open (6443, 10250, 2379-2380, 30000-32767).
- Swap disabled.
- Kernel modules `overlay`, `br_netfilter` and sysctl settings for bridged traffic.

### Key takeaways

- kubeadm sets up Kubernetes components; you provide machines, runtime and CNI.

@@ 11-Install-Kubernetes-the-kubeadm-way/02-Resources
### Introduction

Reference material for the kubeadm installation: the official documentation (kubernetes.io "Installing kubeadm", "Creating a cluster with kubeadm") and the course repository.

### Useful commands for pre-flight

```bash
cat /sys/class/dmi/id/product_uuid
ip link
nc 127.0.0.1 6443 -zv
swapoff -a ; sed -i '/ swap / s/^/#/' /etc/fstab
lsmod | grep br_netfilter
```

### Documentation habit

In the exam the Kubernetes docs are allowed. Learn how to navigate to the kubeadm pages (search "kubeadm upgrade", "kubeadm init") quickly.

@@ 11-Install-Kubernetes-the-kubeadm-way/03-Provision-VMs-with-Vagrant
### Introduction

Vagrant provisions repeatable VMs for a local lab cluster using VirtualBox (or another provider).

### Steps

```bash
vagrant --version
git clone https://github.com/kodekloudhub/certified-kubernetes-administrator-course
cd certified-kubernetes-administrator-course/kubeadm-clusters/virtualbox
vagrant up
vagrant status
vagrant ssh kubemaster
```

### Vagrantfile concepts

- Defines nodes (`kubemaster`, `kubenode01`, `kubenode02`) with IP addresses, CPU, memory, a base box image.
- Runs provisioning scripts to install packages.

### Tips

- Host needs enough RAM (about 8 GB for 3 small VMs).
- `vagrant halt` stops, `vagrant destroy` removes the VMs.
- Verify networking: each node should reach the others by IP.

@@ 11-Install-Kubernetes-the-kubeadm-way/04-Demo-Deployment-with-Kubeadm
### Introduction

The full sequence of building a cluster with kubeadm.

### 1. On every node: prepare

```bash
swapoff -a
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
modprobe overlay ; modprobe br_netfilter
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system
```

### 2. Install runtime and Kubernetes packages

```bash
apt-get install -y containerd
mkdir -p /etc/containerd ; containerd config default > /etc/containerd/config.toml
# set SystemdCgroup = true
systemctl restart containerd

apt-get install -y apt-transport-https ca-certificates curl gpg
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.31/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.31/deb/ /' > /etc/apt/sources.list.d/kubernetes.list
apt-get update
apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl
systemctl enable --now kubelet
```

### 3. Initialise the control plane

```bash
kubeadm init --apiserver-advertise-address=192.168.56.2 \
             --pod-network-cidr=10.244.0.0/16
```

Note the `kubeadm join` command printed at the end. Configure kubectl:

```bash
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
```

### 4. Install a CNI

```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
kubectl get pods -n kube-system
```

The Pod CIDR must match `--pod-network-cidr`.

### 5. Join workers

```bash
kubeadm join 192.168.56.2:6443 --token abcdef.0123456789abcdef --discovery-token-ca-cert-hash sha256:...
```

Regenerate the command if the token expired (24h):

```bash
kubeadm token create --print-join-command
```

### 6. Verify

```bash
kubectl get nodes
kubectl get pods -A
```

### Troubleshooting

- Nodes `NotReady`: no CNI yet, or kubelet issues.
- `kubeadm init` pre-flight errors: swap on, ports in use, runtime missing.
- cgroup driver mismatch between kubelet and containerd: set `SystemdCgroup = true`.
- `kubeadm reset` to start over.

### Key takeaways

- Prepare nodes, init, CNI, join, verify.

@@ 11-Install-Kubernetes-the-kubeadm-way/05-Practice-Test-Deploy-Kubernetes-Cluster-using-Kubeadm
### How to approach this lab

Build a cluster from fresh nodes, similar to the demo.

### Checklist

1. Check the target version from the task and install matching `kubeadm`, `kubelet`, `kubectl`.
2. `kubeadm init` with the right `--apiserver-advertise-address` and `--pod-network-cidr`.
3. Copy `admin.conf` to `~/.kube/config`.
4. Install the CNI the task names (Flannel/Calico/Weave) using the matching Pod CIDR.
5. Print the join command: `kubeadm token create --print-join-command`; run on the worker.
6. `kubectl get nodes` until all `Ready`.

### Troubleshooting

- Nodes NotReady: look at the CNI Pods and `journalctl -u kubelet`.
- Join fails: token expired, wrong API address, firewall on 6443.
- Pods CIDR mismatch causes CNI crashes (flannel needs `10.244.0.0/16` by default).

@@ 12-Troubleshooting/02-Application-Failure
### Introduction

Troubleshooting an application: follow the request path and check each hop.

### Typical architecture

```
 user ─► web Service ─► web Pods ─► db Service ─► db Pods
```

### Method

1. Start from the user's symptom (cannot reach the app).
2. Walk each layer: Service, Pods, dependencies, configuration.
3. Use logs and events.

### Checks, in order

```bash
# Service
kubectl get svc
kubectl describe svc web-service           # selector, port, targetPort, Endpoints
kubectl get endpoints web-service          # empty means no matching ready Pods
kubectl get pods --show-labels             # compare labels with selector

# Pods
kubectl get pods
kubectl describe pod web
kubectl logs web
kubectl logs web --previous                # after a restart

# Dependencies (DB)
kubectl get svc mysql-service ; kubectl describe svc mysql-service
kubectl get pods ; kubectl logs mysql
```

### Common causes

| Symptom | Likely cause |
|---|---|
| Service has no endpoints | Selector/labels mismatch, Pods not Ready |
| Connection refused | Wrong `targetPort`, app not listening |
| `CrashLoopBackOff` | Bad command, missing config, DB unreachable |
| App can't reach DB | DB service name/port, env variables, DB credentials, namespace |
| Intermittent errors | Probes, resource limits, node issues |

### Test connectivity

```bash
kubectl exec web -- curl -s db-service:3306
kubectl run tmp --rm -it --image=busybox --restart=Never -- nslookup db-service
```

### Key takeaways

- Check Service → Endpoints → Pod → logs → dependencies.

@@ 12-Troubleshooting/03-Solution-Application-Failure
### Introduction

A worked method to solve application failure labs.

### Steps and answers

1. `kubectl get all -n <ns>` for an overview.
2. Frontend not reachable: `kubectl describe svc webapp-service` → check selector and NodePort; compare with Pod labels. Fix a typo in the selector (`name: webapp-mysql` vs `name: webapp`).
3. Backend unreachable: `kubectl describe svc mysql-service` → targetPort; the Service name must match the DB host in the web app's env (`DB_Host`).
4. Credentials: `DB_User` / `DB_Password` in the web Deployment must match MySQL's `MYSQL_ROOT_PASSWORD`.
5. NodePort: confirm the expected `nodePort` in the Service spec.
6. Fix with `kubectl edit`, wait for the rollout, test again in the browser or with `curl`.

### Pattern to remember

```bash
kubectl edit svc web-service            # selector/ports
kubectl edit deploy webapp-mysql        # env/ports
kubectl rollout status deploy/webapp-mysql
```

### Tip

Change one thing at a time and re-test so you know which fix worked.

@@ 12-Troubleshooting/04-Control-Plane-Failure
### Introduction

When the cluster itself misbehaves, check the control plane components and their configuration.

### Quick checks

```bash
kubectl get nodes
kubectl get pods -n kube-system
```

If `kubectl` itself fails, the API server is down: use the node.

### kubeadm cluster (components are static Pods)

```bash
kubectl logs kube-apiserver-controlplane -n kube-system
crictl ps -a | grep kube
crictl logs <container-id>
ls /etc/kubernetes/manifests
journalctl -u kubelet
```

### Service-based cluster

```bash
systemctl status kube-apiserver
journalctl -u kube-apiserver
service kube-controller-manager status
```

### Common failures and where to look

| Symptom | Component | Typical cause |
|---|---|---|
| `kubectl` connection refused | kube-apiserver | wrong flag/cert path in manifest, ETCD unreachable |
| Pods stay Pending, no events | kube-scheduler | scheduler down, bad kubeconfig path |
| Deployments don't create Pods | kube-controller-manager | down, bad config |
| Replica counts wrong | controller manager | |
| API timeouts | etcd | wrong data dir / certs |
| Node NotReady | kubelet | service down, config |

### Manifest mistakes to look for

- Typo in a flag or filename (`--kubeconfig=/etc/kubernetes/scheduler.conff`).
- Wrong path in `volumes.hostPath` versus the `volumeMounts` (certificates).
- Wrong image name or tag.
- Wrong port or command (`kube-schedulerr`).

### Fix procedure

1. Read the logs.
2. Edit `/etc/kubernetes/manifests/<component>.yaml`.
3. Wait for the kubelet to restart the Pod (may take a minute).
4. Verify.

Always keep a backup copy before editing.

### Key takeaways

- Identify the failing component, read its logs, fix the manifest.

@@ 12-Troubleshooting/05-Practice-Test-Control-Plane-Failure
### How to approach this lab

Three or four control plane faults appear one after the other (scheduler, controller manager, kube-system config). Solve them in order.

### Method for each

```bash
kubectl get pods -n kube-system
kubectl describe pod kube-scheduler-controlplane -n kube-system
kubectl logs kube-scheduler-controlplane -n kube-system
crictl ps -a | grep scheduler
vi /etc/kubernetes/manifests/kube-scheduler.yaml
```

### Frequent faults

- Scheduler: bad `command` (`kube-schedulerr`) or wrong kubeconfig path.
- Controller manager: wrong CA path (`/etc/kubernetes/pki/ca.crt` vs `/etc/kubernetes/WRONG-PKI-DIRECTORY/ca.crt`) or hostPath volume mismatch.
- Scaling a Deployment has no effect: controller manager is broken.

### Test

```bash
kubectl scale deployment app --replicas=3
kubectl get pods -w
```

@@ 12-Troubleshooting/06-Solution-Control-Plane-Failure
### Introduction

Solutions for typical control plane failures.

### Examples

1. **Pods stuck Pending**: scheduler Pod in `CrashLoopBackOff`. Logs say the config path is wrong. Edit the manifest to the real path and let the kubelet recreate the Pod.
2. **Scaling does nothing**: `kube-controller-manager` crashing; logs reveal missing certificate file; the hostPath in the manifest points to a non-existent directory. Correct the `path:` under `volumes` to `/etc/kubernetes/pki`.
3. **Both fixed**: verify `kubectl get pods -n kube-system` all `Running`.

### Checklist

- Compare each flag path with files in the actual directory (`ls /etc/kubernetes/pki`).
- Check that `volumeMounts.mountPath` and `volumes.hostPath.path` pair up.
- Wait about a minute after saving.

@@ 12-Troubleshooting/07-Worker-Node-Failure
### Introduction

Worker problems usually show up as a node in `NotReady` or `Unknown`.

### Diagnose

```bash
kubectl get nodes
kubectl describe node worker-1
```

Look at **Conditions**: `Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`, `NetworkUnavailable`. `Unknown` means the kubelet stopped reporting (crash, network, node down).

On the node:

```bash
top ; df -h ; free -m
systemctl status kubelet
journalctl -u kubelet
systemctl status containerd
ss -tlnp | grep 10250
```

### Certificates

```bash
openssl x509 -in /var/lib/kubelet/worker-1.crt -text -noout      # validity and issuer
```

An expired or wrong kubelet certificate prevents registration.

### Typical causes

| Cause | Fix |
|---|---|
| kubelet stopped | `systemctl start kubelet`, `enable` |
| Wrong CA / kubeconfig path | edit `/etc/kubernetes/kubelet.conf` or `/var/lib/kubelet/config.yaml` |
| Wrong API server address/port | fix `server:` in `kubelet.conf` (6443) |
| Runtime stopped | `systemctl restart containerd` |
| Disk full | clean up |
| Swap on | disable |

### Key takeaways

- `describe node` for conditions, `journalctl -u kubelet` for reasons.

@@ 12-Troubleshooting/08-Practice-Test-Worker-Node-Failure
### How to approach this lab

A worker is `NotReady`; find out why and fix it.

### Steps

```bash
kubectl get nodes
kubectl describe node node01 | grep -A10 Conditions
ssh node01
systemctl status kubelet
journalctl -u kubelet -n 50
```

### Typical faults

- kubelet not running: `systemctl start kubelet` (and `enable`).
- Wrong CA path in `/var/lib/kubelet/config.yaml`: fix, then `systemctl restart kubelet`.
- Wrong API server port in `/etc/kubernetes/kubelet.conf` (for example 6553 instead of 6443): correct and restart.

### Verify

```bash
exit
kubectl get nodes
```

@@ 12-Troubleshooting/09-Solution-Worker-Node-Failure
### Introduction

Solutions for worker node failures.

### Example flow

1. `kubectl get nodes`: `node01 NotReady`.
2. On node01: `service kubelet status` → inactive/failed.
3. Logs show: `failed to load Kubelet config file ... no such file or directory` or `unable to load client CA file`.
4. Fix the path in `/var/lib/kubelet/config.yaml`; or fix `server: https://controlplane:6443`.
5. `systemctl daemon-reload` (if units changed) then `systemctl restart kubelet`.
6. `kubectl get nodes` shows `Ready`.

### Notes

- A kubelet flag in `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` or `/var/lib/kubelet/kubeadm-flags.env` can also be wrong.
- If the node was deleted from the cluster, rejoin using `kubeadm token create --print-join-command`.

@@ 12-Troubleshooting/10-Practice-Test-Troubleshoot-Network
### How to approach this lab

Network problems with CNI or kube-proxy: Pods can't communicate, Services unreachable, DNS failing.

### Checks

```bash
kubectl get pods -n kube-system
kubectl get ds -n kube-system                       # kube-proxy, CNI
kubectl logs -n kube-system kube-proxy-xxxxx
kubectl -n kube-system get cm kube-proxy -o yaml
kubectl get endpoints svc
kubectl run t --image=busybox:1.28 --rm -it --restart=Never -- nslookup kubernetes
```

### Typical faults

| Symptom | Cause |
|---|---|
| CNI Pods crash | Missing/incorrect CNI config |
| Service not reachable | kube-proxy DaemonSet misconfigured (wrong config path, wrong `kubeconfig.conf` in ConfigMap) |
| DNS fails | CoreDNS Pods or ConfigMap errors; NetworkPolicy blocking 53 |
| Pods Pending | No CNI installed |

### Fixing kube-proxy

```bash
kubectl -n kube-system describe ds kube-proxy         # command path, configmap name
kubectl -n kube-system edit ds kube-proxy             # fix --config path
kubectl -n kube-system rollout restart ds kube-proxy
```

The kubeadm default command is `/usr/local/bin/kube-proxy --config=/var/lib/kube-proxy/config.conf --hostname-override=$(NODE_NAME)`.

@@ 13-Other-Topics/01-Labs-JSON-PATH
### Introduction

Hands-on practice of JSONPath queries against kubectl output. JSONPath is a query language to extract fields from JSON; kubectl uses it with `-o jsonpath`.

### Method

1. Look at the structure first: `kubectl get pods -o json | less` (or `-o yaml`).
2. Build the path from the root: `.items[0].spec.containers[0].image`.
3. Use `[*]` for all elements, `[?(@.key=="value")]` for filters.
4. Format with `range` loops and `{"\n"}` / `{"\t"}`.

### Examples

```bash
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.osImage}'
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}'
kubectl get pv -o jsonpath='{.items[*].spec.capacity.storage}'
```

### Tips

- Save the output to files when asked: `> /opt/outputs/nodes.txt`.
- `kubectl explain` finds field names.
- Quote the expression in single quotes.

@@ 13-Other-Topics/02-Pre-Requisites-JSON-PATH
### Introduction

JSONPath basics before using it with kubectl.

### JSON refresher

```json
{
  "car": { "color": "blue", "price": 20000 },
  "bus": { "color": "red", "price": "100000" },
  "wheels": [ { "model": "KDJ39", "location": "rear-right" }, { "model": "TRE45", "location": "front-left" } ]
}
```

### JSONPath syntax

| Expression | Meaning |
|---|---|
| `$` | Root |
| `$.car.color` | Child by key |
| `$.wheels[0].model` | Array index |
| `$.wheels[*].model` | All elements |
| `$[?(@.price>1000)]` | Filter |
| `$..model` | Recursive search |
| `$[0:3]` | Slice |
| `$[-1:]` | Last element |

In kubectl the root `$` is implicit and the expression goes in braces.

### Lists in JSONPath

kubectl output of multiple objects is a `List` with `.items`. A query on one resource has no `.items`.

### Formatting

```bash
kubectl get nodes -o jsonpath='{.items[*].metadata.name}{"\n"}{.items[*].status.capacity.cpu}{"\n"}'
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\n"}{end}'
```

### Custom columns and sorting

```bash
kubectl get nodes -o custom-columns=NODE:.metadata.name,CPU:.status.capacity.cpu
kubectl get nodes --sort-by=.metadata.name
```

### Key takeaways

- Learn `[*]`, filters and `range`.

@@ 13-Other-Topics/03-Advance-Kubectl-Commands
### Introduction

Advanced kubectl output control for exam tasks: jsonpath, custom-columns, sort-by, field selectors.

### Examples

```bash
kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image
kubectl get nodes --sort-by=.metadata.name
kubectl get pv --sort-by=.spec.capacity.storage
kubectl get pv --sort-by=.spec.capacity.storage -o custom-columns=NAME:.metadata.name,CAPACITY:.spec.capacity.storage
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\n"}{end}'
kubectl config view -o jsonpath='{.contexts[?(@.context.user=="aws-user")].name}'
```

### Handy selectors

```bash
kubectl get pods --field-selector=status.phase=Running
kubectl get pods --field-selector=spec.nodeName=node01 -A
kubectl get events --field-selector type=Warning
kubectl get pods -l app=web -o name
```

### Other power tools

```bash
kubectl get pods -o wide
kubectl get pod x -o yaml
kubectl explain pod.spec.containers --recursive
kubectl diff -f file.yaml
kubectl wait --for=condition=Ready pod/x --timeout=60s
kubectl auth can-i list pods --as user
```

### Key takeaways

- Output shaping saves time on "write X to a file" tasks.

@@ 13-Other-Topics/04-Practice-Test-Advance-Kubectl-Commands
### How to approach this lab

Each task saves the output of a query to a file.

### Tasks and commands

```bash
kubectl get nodes -o jsonpath='{.items[*].metadata.name}' > /opt/outputs/node_names.txt
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.osImage}' > /opt/outputs/nodes_os.txt
kubectl config view --kubeconfig=/root/my-kube-config -o jsonpath='{.users[*].name}' > /opt/outputs/users.txt
kubectl get pv --sort-by=.spec.capacity.storage > /opt/outputs/storage-capacity-sorted.txt
kubectl get pv --sort-by=.spec.capacity.storage -o custom-columns=NAME:.metadata.name,CAPACITY:.spec.capacity.storage > /opt/outputs/pv-and-capacity-sorted.txt
kubectl config view --kubeconfig=/root/my-kube-config -o jsonpath='{.contexts[?(@.context.user=="aws-user")].name}' > /opt/outputs/aws-context-name
```

### Check

`cat` the file afterwards. The expected format is exact, so no extra text or trailing commentary.

@@ 14-Lightning-Labs/01-Lightning-Labs-Introduction
### Introduction

Lightning labs are short, timed, mixed-topic practice sessions modelled on the speed of the exam. Each lab contains several tasks of varying difficulty.

### How to use them

1. Set a timer for the whole lab.
2. Configure aliases first:

```bash
alias k=kubectl
export do="--dry-run=client -o yaml"
source <(kubectl completion bash)
complete -F __start_kubectl k
```

3. Do the quick tasks first; flag long ones and return later.
4. Switch context when the task says so (`kubectl config use-context ...`).
5. After finishing, review solutions and redo anything missed.

### Time budget

The exam gives about 2 hours for roughly 15-20 questions, so ~6 minutes each on average; easy tasks should take 2-3.

### Skills trained

Imperative commands, YAML editing in vim, docs navigation, verifying results quickly.

### Tip

Use `kubectl explain` and search kubernetes.io rather than memorising YAML.

@@ 14-Lightning-Labs/02-Lightning-Lab-1
### How to approach this lab

A mixed bag covering upgrades, storage, Pods, Deployments, networking, and backup.

### Typical tasks and how to do them

1. **Upgrade the cluster**: control plane first (`kubeadm upgrade apply`), then nodes (`kubeadm upgrade node`), kubelet restart. See the Cluster Upgrade lab.
2. **Print the list of nodes/PVs to a file** with `jsonpath` or `custom-columns`.
3. **Create a Pod with two containers sharing an `emptyDir`**.
4. **Deployment with a rolling update, change the image, then roll back**: `kubectl set image`, `kubectl rollout undo`.
5. **ETCD backup**: `etcdctl snapshot save` with certificates; restore.
6. **Pod with resource requests/limits, PVC with PV, a Service**.
7. **NetworkPolicy or RBAC** task.

### Approach per task

```bash
kubectl run x --image=nginx $do > x.yaml
vi x.yaml
kubectl apply -f x.yaml
kubectl get/describe        # verify
```

### Review

Rebuild what you struggled with from the docs, with a timer.

@@ 16-Ultimate-Mocks/02-Troubleshooting/docs/11-C1-orange-pvc-cka13-trb
### How to approach this lab

Scenario: a Pod using a PVC for "orange" fails.

### Diagnose

```bash
kubectl get pods,pvc,pv -A
kubectl describe pod <pod>              # "persistentvolumeclaim ... not found" or unbound
kubectl describe pvc <pvc>              # why not bound?
kubectl get pv,pvc -o wide              # compare capacity, access modes, storage class
```

### Typical causes

| Cause | Fix |
|---|---|
| `storageClassName` mismatch | recreate PVC with the PV's class (or `""`) |
| Request larger than PV capacity | PVC size ≤ PV size |
| Access mode mismatch | match `ReadWriteOnce` etc. |
| PVC in another namespace | create it in the Pod's namespace |
| Pod `claimName` typo | edit the Pod/Deployment |

PVCs are mostly immutable; delete and recreate. Pods must be recreated if `claimName` changes.

### Verify

`kubectl get pvc,pod` shows `Bound` and `Running`.

@@ 16-Ultimate-Mocks/02-Troubleshooting/docs/19-C1-netpol-cyan-pod-cka28-trb
### How to approach this lab

Scenario: a Pod ("cyan") can't be reached because of a NetworkPolicy.

### Diagnose

```bash
kubectl get netpol -A
kubectl describe netpol <name>          # PodSelector, Allowing ingress from..., ports
kubectl get pods --show-labels
kubectl get ns --show-labels
```

### Fix

Edit the policy so the client is allowed by `podSelector` and/or `namespaceSelector` and the correct `ports`. Watch AND vs OR (one `from` item vs two). Policies are additive; if the task forbids deleting the policy, edit it.

### Test

```bash
kubectl exec <client> -- wget -qO- -T2 <svc>:<port>
```

Timeout = blocked; the page = allowed.

@@ 16-Ultimate-Mocks/04-Storage/docs/10-CI-olive-pvc-cka10-str
### How to approach this lab

Create storage resources to specification ("olive").

### Steps

1. Read names, sizes, access modes, storage class and namespace carefully.
2. Create the PV if needed (hostPath or local), then the PVC.
3. Mount the PVC in the Pod/Deployment.
4. Verify.

```bash
kubectl get pv,pvc
kubectl exec <pod> -- sh -c 'echo test > /mnt/data/t; cat /mnt/data/t'
```

### Watch out

- Requests must fit the PV.
- `storageClassName: ""` for static binding when a default class exists.
- Pod and PVC share a namespace.
- Retain vs Delete as requested.

@@ 16-Ultimate-Mocks/05-Services-Networking/docs/03-C3-External-Webserver
### How to approach this lab

Pods must reach a web server **outside** the cluster using a Service name.

### Option 1: Service + Endpoints (no selector)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-web
spec:
  ports:
  - port: 80
---
apiVersion: v1
kind: Endpoints
metadata:
  name: external-web
subsets:
- addresses:
  - ip: 192.168.1.100
  ports:
  - port: 80
```

The Endpoints name must equal the Service name.

### Option 2: ExternalName

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-web
spec:
  type: ExternalName
  externalName: web.example.com
```

This creates a DNS CNAME.

### Test

```bash
kubectl exec <pod> -- curl external-web
kubectl get svc,ep external-web
```

@@ 16-Ultimate-Mocks/09-general/docs/01-cluster-state-questions
### How to approach this lab

Quickly gather facts about the cluster and write answers to files.

### Command map

| Question | Command |
|---|---|
| Kubernetes version | `kubectl version`, `kubectl get nodes` |
| Number of nodes/Pods | `kubectl get nodes --no-headers \| wc -l` |
| Runtime/OS | `kubectl get nodes -o wide` |
| Pod / service CIDR | `kubectl cluster-info dump \| grep -E 'cluster-cidr\|service-cluster-ip-range'` |
| CNI | `ls /etc/cni/net.d` |
| Static Pod path | `grep staticPodPath /var/lib/kubelet/config.yaml` |
| Certificate expiry | `kubeadm certs check-expiration` |
| ETCD version/data dir | `describe pod etcd-*` |
| DNS domain | `kubectl -n kube-system get cm coredns -o yaml` |

Write answers exactly in the requested format and file path.

@@ 17-tips-and-tricks/docs/01-server-for-testing-network-policies
### Introduction

A throwaway server Pod and Service to test NetworkPolicies.

### Create

```bash
kubectl run server --image=nginx --labels=app=server --port=80 --expose
kubectl get pods,svc -l app=server
```

### Use

1. Test the baseline from a client **before** applying any policy.
2. Apply the NetworkPolicy being tested.
3. Test again from clients with different labels and namespaces.

A timeout means blocked; the nginx page means allowed.

```bash
kubectl describe netpol <name>       # shows selected Pods
```

### Clean up

```bash
kubectl delete pod,svc server
```

@@ 17-tips-and-tricks/docs/02-client--for-testing-network-things
### Introduction

A throwaway client Pod to test access to servers, DNS and ports.

### Create and use

```bash
kubectl run client --image=busybox:1.36 --labels=role=frontend --command -- sleep 3600
kubectl exec client -- wget -qO- -T2 http://server
kubectl exec client -- nslookup server
kubectl exec client -- nc -zv server 80
kubectl run tmp --rm -it --image=nicolaka/netshoot --restart=Never -- bash
```

### Tips

- Cross-namespace: `server.<ns>.svc.cluster.local`.
- Change labels to prove a policy: `kubectl label pod client role=other --overwrite`.
- Always test the baseline before applying a policy.
- Delete clients afterwards.

@@ 18-Beyond-the-Course/01-Helm-and-Kustomize
### Introduction

Two ways to manage Kubernetes manifests: **Helm** (a package manager with templates) and **Kustomize** (patch-based customisation built into kubectl). Both are part of the current CKA syllabus.

### Helm

A **chart** is a package of templated manifests. A **release** is an installed instance of a chart. **Repositories** host charts.

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo nginx
helm install my-web bitnami/nginx
helm install my-web bitnami/nginx --set replicaCount=3 -n web --create-namespace
helm install my-web bitnami/nginx -f values.yaml
helm list -A
helm status my-web
helm get values my-web
helm upgrade my-web bitnami/nginx --set replicaCount=5
helm history my-web
helm rollback my-web 1
helm uninstall my-web
helm template my-web bitnami/nginx > out.yaml        # render only
helm pull bitnami/nginx --untar
```

Chart layout:

```
mychart/
  Chart.yaml        name, version
  values.yaml       defaults
  templates/        deployment.yaml uses {{ .Values.replicaCount }}
```

Precedence for values: `--set` > `-f file` > chart `values.yaml`.

### Kustomize

Customises plain YAML without templates, using a `kustomization.yaml`.

```
app/
  base/
    deployment.yaml
    service.yaml
    kustomization.yaml
  overlays/
    prod/
      kustomization.yaml
```

```yaml
# base/kustomization.yaml
resources:
- deployment.yaml
- service.yaml
```

```yaml
# overlays/prod/kustomization.yaml
resources:
- ../../base
namePrefix: prod-
namespace: production
commonLabels:
  env: prod
replicas:
- name: web
  count: 5
images:
- name: nginx
  newTag: "1.27"
patches:
- path: patch-resources.yaml
```

```bash
kubectl kustomize overlays/prod       # render
kubectl apply -k overlays/prod
kubectl delete -k overlays/prod
```

### Helm vs Kustomize

| | Helm | Kustomize |
|---|---|---|
| Approach | Templates + values | Overlays/patches on plain YAML |
| Packaging/versioning | Yes (charts, releases) | No |
| Rollback | `helm rollback` | Git/`kubectl rollout` |
| Built in | Separate binary | In kubectl |

### Key takeaways

- Know basic `helm install/upgrade/rollback/uninstall` and `kubectl apply -k`.

@@ 18-Beyond-the-Course/02-Gateway-API
### Introduction

The **Gateway API** is the successor to Ingress. It is more expressive and role-oriented, splitting infrastructure from application routing. It requires installing the CRDs and a controller (Envoy Gateway, NGINX Gateway Fabric, Istio, Cilium).

### Resources and roles

```
 GatewayClass   ← infrastructure provider (which controller)
      │
   Gateway      ← cluster operator (listeners: port, protocol, hostname)
      │
   HTTPRoute    ← application developer (routing rules to Services)
```

### Examples

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: web-gateway
spec:
  gatewayClassName: nginx
  listeners:
  - name: http
    protocol: HTTP
    port: 80
    allowedRoutes:
      namespaces:
        from: Same
```

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
spec:
  parentRefs:
  - name: web-gateway
  hostnames: ["shop.example.com"]
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /wear
    backendRefs:
    - name: wear-service
      port: 80
  - matches:
    - path: {type: PathPrefix, value: /watch}
    backendRefs:
    - name: video-service
      port: 80
      weight: 90
```

### Commands

```bash
kubectl get gatewayclass,gateway,httproute -A
kubectl describe gateway web-gateway       # Accepted, Programmed conditions
kubectl describe httproute web-route       # ResolvedRefs
```

### Features beyond Ingress

Header-based matching, traffic splitting with weights, request redirects/rewrites, TLS routes, TCP/UDP/gRPC routes, cross-namespace sharing with `ReferenceGrant`.

### Migrating from Ingress

Map each Ingress rule to an HTTPRoute path match; map TLS to Gateway listener `tls`.

### Key takeaways

- GatewayClass → Gateway → HTTPRoute; check status conditions when routes don't work.

@@ 18-Beyond-the-Course/03-Workload-Autoscaling
### Introduction

Kubernetes can scale automatically: Pods (HPA, VPA) and nodes (Cluster Autoscaler). HPA is in the CKA syllabus.

### Horizontal Pod Autoscaler (HPA)

Changes the replica count of a Deployment/StatefulSet based on metrics (CPU, memory, custom). Requires the **Metrics Server** and CPU/memory **requests** on the Pods.

```bash
kubectl autoscale deployment web --cpu-percent=50 --min=2 --max=10
kubectl get hpa
kubectl describe hpa web
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

Formula: `desired = ceil(current * currentMetric / targetMetric)`.

### Test it

```bash
kubectl run load --image=busybox --restart=Never -- /bin/sh -c "while true; do wget -q -O- http://web; done"
kubectl get hpa -w
```

### Vertical Pod Autoscaler (VPA)

Adjusts Pod requests/limits (recommendation, auto modes). It is an add-on, not core.

### Cluster Autoscaler

Adds/removes nodes when Pods are unschedulable or nodes are underused. Provided by cloud integrations.

### Troubleshooting HPA

- `TARGETS <unknown>`: Metrics Server missing, or no resource requests set.
- Not scaling down: stabilization window (5 min default).

### Key takeaways

- HPA needs metrics-server and requests; `kubectl autoscale` creates it.

@@ 18-Beyond-the-Course/04-CRDs-and-Operators
### Introduction

**Custom Resource Definitions (CRDs)** extend the API with your own object types. **Operators** are controllers that manage those objects, encoding operational knowledge (install, backup, upgrade) in software.

### CRD

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.example.com        # <plural>.<group>
spec:
  group: example.com
  scope: Namespaced
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: ["bk"]
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              schedule: {type: string}
              retention: {type: integer}
```

```yaml
apiVersion: example.com/v1
kind: Backup
metadata:
  name: nightly
spec:
  schedule: "0 2 * * *"
  retention: 7
```

```bash
kubectl get crd
kubectl explain backup.spec
kubectl get backups
kubectl describe crd backups.example.com
```

A CRD by itself only stores data in ETCD; nothing acts on it without a controller.

### Operators

```
 Custom Resource (desired state) ──► Operator (controller) ──► creates Deployments, PVCs, Jobs...
```

Examples: Prometheus Operator, cert-manager, Postgres operators, Argo CD. Installed via manifests or Helm; they bring their own CRDs and RBAC.

### Troubleshooting

- `no matches for kind`: CRD not installed.
- Resource accepted but nothing happens: operator Pod not running.
- Deleting a CRD deletes all its resources.

### Key takeaways

- CRD = new API kind; operator = controller that acts on it.

@@ 18-Beyond-the-Course/05-Extension-Interfaces-CNI-CSI-CRI
### Introduction

Kubernetes stays small by defining standard interfaces that vendors plug into.

| Interface | Plugs in | Examples | Config location |
|---|---|---|---|
| **CRI** Container Runtime Interface | Container runtimes | containerd, CRI-O | kubelet `--container-runtime-endpoint` |
| **CNI** Container Network Interface | Pod networking | Calico, Cilium, Flannel, Weave | `/etc/cni/net.d`, `/opt/cni/bin` |
| **CSI** Container Storage Interface | Storage | EBS, Ceph, NetApp, local-path | CSIDriver, StorageClass |

```
 kubelet ──CRI──► containerd ──► runc
    │──CNI──► network plugin (Pod IPs, routes)
    └──CSI──► storage driver (attach/mount volumes)
```

### CRI

gRPC API with RuntimeService (Pods, containers) and ImageService (images). `crictl` talks to it.

```bash
crictl --runtime-endpoint unix:///run/containerd/containerd.sock ps
```

### CNI

Plugins executed by the runtime on Pod create/delete (ADD/DEL). Check with `ls /etc/cni/net.d`.

### CSI

Drivers run as a controller (provisioning/attach) plus a node plugin (mount) with sidecars.

```bash
kubectl get csidrivers
kubectl get storageclass
```

### Other extension points

- Device plugins (GPUs), admission webhooks, scheduler plugins, API aggregation, CRDs and operators.

### Key takeaways

- CRI = runtime, CNI = network, CSI = storage; each swappable.
