@@ 02-Core-Concepts/02-Cluster-Architecture
### The big picture
Kubernetes is a set of cooperating programs. The **control plane** decides what should run; the **worker nodes** run it. You talk only to the **kube-apiserver**; everything else watches the API and reacts.

| Where | Component | Job |
|---|---|---|
| Control plane | kube-apiserver | REST front door: authenticates, authorizes, validates and stores objects |
| Control plane | etcd | Consistent key-value database holding all cluster state |
| Control plane | kube-scheduler | Chooses a node for each unscheduled Pod |
| Control plane | kube-controller-manager | Runs control loops: node, replication, endpoints, service accounts, jobs... |
| Every node | kubelet | Node agent: runs the Pods assigned to its node, reports status |
| Every node | kube-proxy | Programs Service VIP rules (iptables/IPVS) |
| Every node | container runtime | containerd / CRI-O, started by the kubelet through the CRI |

### What happens when you run `kubectl run web --image=nginx`
1. kubectl sends the request to the API server, which authenticates you, checks RBAC, runs admission, and writes the Pod to etcd with no node assigned.
2. The scheduler sees an unassigned Pod, filters and scores nodes, and writes `spec.nodeName`.
3. The kubelet on that node sees a Pod bound to it, asks the runtime to pull the image and start containers, and reports status back.
4. Controllers (e.g. ReplicaSet) keep watching and correct any drift from the desired state.

### See it on a real cluster
```
kubectl get nodes -o wide
kubectl get pods -n kube-system -o wide      # control-plane pods (kubeadm runs them as static pods)
kubectl cluster-info
ls /etc/kubernetes/manifests                  # on a control-plane node: apiserver, etcd, scheduler, controller-manager
```
### Watch out
Only the API server talks to etcd. If `kubectl` hangs, the API server or etcd is the first suspect; if Pods stay Pending with no events, suspect the scheduler.

@@ 02-Core-Concepts/03-Docker-vs-ContainerD
### Why this matters
Early Kubernetes was hard-wired to Docker. The **Container Runtime Interface (CRI)** let any runtime plug in. Docker itself is not CRI-compliant, so Kubernetes used a shim (*dockershim*), which was **removed in v1.24**. Today clusters use **containerd** (what Docker used underneath) or **CRI-O**.

### Which CLI to use
| Tool | Who it is for | Notes |
|---|---|---|
| `docker` | Developers | Not present on Kubernetes nodes by default |
| `ctr` | containerd debugging | Low level, not user friendly |
| `nerdctl` | General containerd use | Docker-like commands (`nerdctl run`, `ps`) |
| `crictl` | Kubernetes debugging | Talks CRI; **use this on nodes**: `crictl ps`, `crictl pods`, `crictl images`, `crictl logs <id>`, `crictl inspect` |

### How to do it
1. Find the runtime on a node: `kubectl get nodes -o wide` (CONTAINER-RUNTIME column).
2. Point crictl at it if needed: `/etc/crictl.yaml` with `runtime-endpoint: unix:///run/containerd/containerd.sock`.
3. List containers: `crictl ps -a`; read logs: `crictl logs <container-id>`.

### Watch out
Images built with Docker still run unchanged (OCI format). `crictl ps` only shows Kubernetes containers when you add `-a` for exited ones. When the API server is down, `crictl` is how you read control-plane logs.

@@ 02-Core-Concepts/04-ETCD-For-Beginners
### What etcd is
A distributed, strongly consistent **key-value store**. Unlike a relational database it stores `key → value` pairs and is fast at reads and watches. Kubernetes keeps every object (Pods, Secrets, ConfigMaps, RBAC...) in it, so **losing etcd means losing the cluster**.

### Try it
```
etcdctl put name kodekloud
etcdctl get name
etcdctl get / --prefix --keys-only
etcdctl version
```
Set the API version for the v3 commands: `export ETCDCTL_API=3` (the default in current releases, still seen in older notes).

### How it stays consistent
etcd uses the **Raft** protocol: nodes elect a leader, writes go through the leader and are committed once a majority (**quorum**) acknowledges. Quorum = ⌊N/2⌋ + 1, so 3 nodes survive 1 failure and 5 survive 2. Even numbers add cost without extra fault tolerance.

### Watch out
Listens on port **2379** (clients) and **2380** (peers). All client access needs TLS certificates in a Kubernetes cluster, which is why backup commands carry `--cacert --cert --key`.

@@ 02-Core-Concepts/05-ETCD-in-Kubernetes
### How a kubeadm cluster runs etcd
etcd runs as a **static pod** (`etcd-<node>` in `kube-system`) defined in `/etc/kubernetes/manifests/etcd.yaml`, with data in `/var/lib/etcd` and certificates in `/etc/kubernetes/pki/etcd`. The API server connects with `--etcd-servers=https://127.0.0.1:2379`.

### Look inside (typical exam skill)
```
kubectl -n kube-system get pod etcd-controlplane
kubectl -n kube-system describe pod etcd-controlplane      # shows cert paths, data-dir, endpoints
kubectl -n kube-system exec etcd-controlplane -- sh -c \
 "ETCDCTL_API=3 etcdctl get / --prefix --keys-only --limit=10 \
  --cacert /etc/kubernetes/pki/etcd/ca.crt --cert /etc/kubernetes/pki/etcd/server.crt --key /etc/kubernetes/pki/etcd/server.key"
```
Objects live under the `/registry/...` key prefix (e.g. `/registry/pods/default/web`).

### Answer common questions quickly
- *Where is the data?* `--data-dir` in the manifest (default `/var/lib/etcd`).
- *Which certs?* `--cert-file`, `--key-file`, `--trusted-ca-file` in the same manifest.
- *HA?* `kubectl -n kube-system get pods | grep etcd` shows one per control-plane node (stacked) or none (external etcd; check the API server's `--etcd-servers`).

@@ 02-Core-Concepts/06-Kube-API-Server
### Role
The API server is the only component that reads/writes etcd and the hub every other component talks to. Request path: **authenticate → authorize (RBAC/Node) → admission (mutating, then validating) → validate schema → persist to etcd**.

### Find and inspect it
- kubeadm: static pod manifest `/etc/kubernetes/manifests/kube-apiserver.yaml`; `kubectl -n kube-system get pod kube-apiserver-<node>`.
- Service install: `/etc/systemd/system/kube-apiserver.service`; `ps aux | grep kube-apiserver` shows live flags.
Key flags to recognise: `--etcd-servers`, `--authorization-mode=Node,RBAC`, `--enable-admission-plugins`, `--service-cluster-ip-range`, `--client-ca-file`, `--tls-cert-file`, `--secure-port=6443`.

### Typical tasks
1. *Change a flag:* edit the manifest in `/etc/kubernetes/manifests`; the kubelet restarts the pod automatically. A typo takes the whole API down, so copy the file first (`cp kube-apiserver.yaml /root/`).
2. *Which admission plugins / auth mode are on?* `grep -E 'admission|authorization' /etc/kubernetes/manifests/kube-apiserver.yaml`.
3. *Call the API directly:* `kubectl get --raw /healthz` or `kubectl get --raw /api/v1/namespaces`.

### Watch out
After editing, wait about a minute; if `kubectl` stops responding use `crictl ps -a | grep apiserver` and `crictl logs <id>` to find the bad flag.

@@ 02-Core-Concepts/07-Kube-Controller-Manager
### Role
Runs the control loops that continuously compare **desired state** (in the API) with **actual state** and act: node controller (marks nodes NotReady, evicts Pods), replication controller (ReplicaSets), endpoints, namespace, service-account, job, PV controllers and more. It runs as one process.

### Inspect it
```
kubectl -n kube-system get pod kube-controller-manager-<node>
cat /etc/kubernetes/manifests/kube-controller-manager.yaml
```
Useful flags: `--controllers` (default all), `--node-monitor-period=5s`, `--node-monitor-grace-period=40s`, `--pod-eviction-timeout` (older), `--cluster-cidr`, `--service-cluster-ip-range`, `--cluster-signing-cert-file` (needed to sign CSRs), `--leader-elect=true`.

### What breaks when it fails
Creating a Deployment makes **no** ReplicaSet or Pods; dead nodes are never marked NotReady; CSRs are never issued. Check `kubectl -n kube-system logs kube-controller-manager-<node>`, and if the manifest name or a file path is wrong fix it under `/etc/kubernetes/manifests`.

### Watch out
Only one instance is active in an HA setup (leader election via a Lease), the others stand by.

@@ 02-Core-Concepts/08-Kube-Scheduler
### Role
Watches for Pods with an empty `spec.nodeName` and picks a node: **filter** (can it run there? resources, taints, selectors, affinity) then **score** (best fit: spread, image locality...). It only writes the binding; the **kubelet** starts the Pod.

### Inspect it
```
kubectl -n kube-system get pod kube-scheduler-<node>
cat /etc/kubernetes/manifests/kube-scheduler.yaml     # --config, --leader-elect, kubeconfig path
```
### When a Pod is Pending
```
kubectl describe pod <name>        # Events: "0/3 nodes are available: ..."
kubectl get pods -n kube-system | grep scheduler      # is the scheduler even running?
```
- No events at all → scheduler down (or the Pod names a scheduler that doesn't exist via `schedulerName`).
- "Insufficient cpu/memory" → requests too large. "untolerated taint" → add toleration. "didn't match node selector/affinity" → fix labels.

### Watch out
Setting `nodeName` by hand bypasses the scheduler completely (see Manual Scheduling).

@@ 02-Core-Concepts/09-Kubelet
### Role
The only component that is **not** a Pod on kubeadm clusters: the kubelet is a systemd service on every node. It registers the node, watches the API for Pods bound to it, tells the container runtime to start/stop containers, runs probes, mounts volumes and reports status. It also runs **static pods** from `staticPodPath`.

### Inspect and manage
```
systemctl status kubelet
journalctl -u kubelet -f                 # logs
ps aux | grep kubelet                    # shows --config and --kubeconfig
cat /var/lib/kubelet/config.yaml         # staticPodPath, clusterDNS, cgroupDriver, authentication
cat /etc/kubernetes/kubelet.conf         # how it authenticates to the API server
systemctl daemon-reload && systemctl restart kubelet
```
### Joining a node
`kubeadm join` installs the kubelet config and starts it; the kubelet then performs a TLS bootstrap to obtain its client certificate.

### Watch out
NotReady node? Start with `systemctl status kubelet` and `journalctl -u kubelet`: wrong API address/CA, expired cert, runtime socket down, swap on, or disk pressure are the usual culprits. Kubeadm does **not** install the kubelet for you; you install the package on each node.

@@ 02-Core-Concepts/10-Kube-Proxy
### Role
Implements the **Service** abstraction on each node. Services have virtual IPs that exist on no interface; kube-proxy watches Services/EndpointSlices and programs rules (iptables by default, or IPVS) that rewrite Service IP:port to a ready Pod IP:port.

### How it runs
A **DaemonSet** in `kube-system`, config in the `kube-proxy` ConfigMap.
```
kubectl -n kube-system get ds kube-proxy
kubectl -n kube-system get cm kube-proxy -o yaml | grep -E 'mode|clusterCIDR'
iptables-save | grep <service-name>          # rules for a Service (iptables mode)
```
### Debug a Service that doesn't route
1. `kubectl get ep <svc>` has addresses? If not, selector/readiness problem, not kube-proxy.
2. `kubectl -n kube-system get pods -l k8s-app=kube-proxy` all Running? Read logs for errors.
3. Check the mode and CIDR in the ConfigMap, and that the node's `br_netfilter`/`ip_forward` sysctls are set.

### Watch out
kube-proxy does load balancing at connection level (random/round-robin), not per HTTP request. It does nothing for Pod-to-Pod traffic (that is the CNI's job).

@@ 02-Core-Concepts/11-Pods
### What a Pod is
The smallest deployable unit: one or more containers that share a network namespace (one IP, talk over `localhost`), IPC and volumes, and are always scheduled together on one node.

### Create one
```
kubectl run nginx --image=nginx                               # quickest
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml   # generate YAML
```
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels: {app: nginx}
spec:
  containers:
  - name: nginx
    image: nginx:1.27
    ports: [{containerPort: 80}]
```
`kubectl apply -f pod.yaml`

### Inspect
```
kubectl get pods -o wide            # node + IP
kubectl describe pod nginx          # Events at the bottom
kubectl logs nginx                  # add -c <container> for multi-container
kubectl exec -it nginx -- sh
kubectl delete pod nginx
```
### Watch out
A bare Pod is not rescheduled if its node dies; use a Deployment. Most Pod fields are immutable; to change them delete and recreate (`kubectl replace --force -f pod.yaml`). Only the image (and a few fields) can be edited in place.

@@ 02-Core-Concepts/13-Practice-Test-PODs
### How to work through this lab
Typical tasks and the fastest commands:
1. **Count Pods / list in a namespace:** `kubectl get pods` (add `-n <ns>` or `-A`; `--no-headers | wc -l`).
2. **Images used / node / READY column:** `kubectl get pods -o wide`, `kubectl describe pod <name>` (containers, image, node).
3. **Create a Pod:** `kubectl run redis --image=redis` or generate YAML with `--dry-run=client -o yaml`.
4. **Pod in ErrImagePull / wrong image:** `kubectl describe pod` shows the cause; fix with `kubectl edit pod <name>` and change `image` (image is editable), or `kubectl set image pod/<name> <container>=<image>`.
5. **Delete a Pod:** `kubectl delete pod <name>`.
6. **Fix a failing YAML:** run `kubectl apply -f file.yaml`; the error names the line. Common ones: wrong `apiVersion`, bad indentation, `containers` not a list.

### Verify
`kubectl get pods` shows `Running` and READY `1/1`. A pod in `Pending`/`ContainerCreating` for long: read Events.

### Tip
Use `kubectl explain pod.spec.containers` while you edit YAML.

@@ 02-Core-Concepts/14-ReplicaSets
### What it does
A ReplicaSet keeps a stable set of replica Pods running. It identifies "its" Pods with a **label selector**, so `selector.matchLabels` **must** match `template.metadata.labels`.

### Create one
There is no `kubectl create replicaset`, so write YAML (or generate a Deployment and change the kind):
```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata: {name: web}
spec:
  replicas: 3
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}
    spec:
      containers:
      - name: nginx
        image: nginx
```
### Operate
```
kubectl get rs
kubectl scale rs web --replicas=5
kubectl edit rs web
kubectl delete rs web              # deletes its Pods too
```
### Watch out
Editing the Pod template of an existing ReplicaSet does **not** change running Pods; delete the Pods so new ones are created from the new template. Pods already carrying the selector labels are adopted by the ReplicaSet. Prefer Deployments.

@@ 02-Core-Concepts/15-Practice-Tests-ReplicaSet
### How to work through this lab
1. **Find desired/current/ready counts:** `kubectl get rs`.
2. **Image or labels of the template:** `kubectl describe rs <name>`.
3. **"Why are Pods not Running?"** `kubectl describe pod <pod>`: bad image tag → fix the ReplicaSet (`kubectl edit rs`), then **delete the broken Pods** so replacements use the corrected template.
4. **Create from a broken YAML:** common errors are `apiVersion: v1` (must be `apps/v1`) and a selector that doesn't match template labels.
5. **Scale:** `kubectl scale rs <name> --replicas=5` or `kubectl edit rs`.
6. **Delete a Pod and watch it come back:** `kubectl delete pod <p>; kubectl get pods`.

### Verify
`kubectl get rs` shows DESIRED = CURRENT = READY. Remember each Pod's name is `<rs-name>-<random>`.

@@ 02-Core-Concepts/16-Deployments
### What it does
A Deployment manages ReplicaSets to give **rolling updates, rollbacks and scaling**. You normally create Deployments, not ReplicaSets or bare Pods.

### Create and operate
```
kubectl create deployment web --image=nginx --replicas=3
kubectl create deployment web --image=nginx --replicas=3 --dry-run=client -o yaml > d.yaml
kubectl get deploy,rs,pods
kubectl scale deployment web --replicas=5
kubectl set image deployment/web nginx=nginx:1.27
kubectl rollout status deployment/web
kubectl rollout undo deployment/web
kubectl delete deployment web
```
YAML is identical to a ReplicaSet except `kind: Deployment` (plus an optional `strategy`).

### Behind the scenes
Create → Deployment creates a ReplicaSet `web-<hash>` → that creates Pods `web-<hash>-<rand>`. An update creates a new ReplicaSet and shifts Pods over.

### Watch out
Deleting a Deployment deletes its ReplicaSets and Pods. Use `kubectl get all` to see the whole tree.

@@ 02-Core-Concepts/17-Practice-Tests-Deployments
### How to work through this lab
1. **Counts and names:** `kubectl get deployments`, `kubectl get rs`, `kubectl get pods`.
2. **Image used:** `kubectl describe deployment <name> | grep -i image`.
3. **Create a Deployment:** `kubectl create deployment httpd-frontend --image=httpd:2.4-alpine --replicas=3`.
4. **Broken Deployment:** `kubectl describe` shows what is wrong; fix with `kubectl edit deployment <name>` (image, selector) and watch the rollout with `kubectl rollout status`.
5. **Fix a YAML file:** `kind: Deployment` needs `apiVersion: apps/v1` and a matching selector; run `kubectl apply -f`.
6. **Delete:** `kubectl delete deployment <name>`; confirm Pods vanish.

### Verify
`kubectl get deploy` READY equals desired. If Pods keep restarting use `kubectl logs` and `describe`.

@@ 02-Core-Concepts/18-Namespaces
### What it does
Namespaces partition one cluster into virtual clusters: names only need to be unique within a namespace, and RBAC, quotas and network policies can be applied per namespace. Default ones: `default`, `kube-system`, `kube-public`, `kube-node-lease`.

### Use them
```
kubectl create namespace dev
kubectl get pods -n dev
kubectl get pods -A                               # all namespaces
kubectl config set-context --current --namespace=dev     # change your default
kubectl api-resources --namespaced=false          # cluster-scoped kinds
```
Put `metadata.namespace: dev` in YAML, or pass `-n dev` at apply time. Do not mix them up: a manifest naming one namespace and a command naming another is an error.

### DNS across namespaces
Same namespace: `db-service`. Another namespace: `db-service.dev` or `db-service.dev.svc.cluster.local`.

### Limit resources
```yaml
apiVersion: v1
kind: ResourceQuota
metadata: {name: compute-quota, namespace: dev}
spec:
  hard: {pods: "10", requests.cpu: "4", requests.memory: 5Gi, limits.cpu: "10", limits.memory: 10Gi}
```
### Watch out
Deleting a namespace deletes everything in it. Many exam tasks fail by working in `default` when the task named another namespace.

@@ 02-Core-Concepts/19-Practice-Test-Namespaces
### How to work through this lab
1. **Count namespaces:** `kubectl get ns --no-headers | wc -l`.
2. **Pods in a namespace:** `kubectl get pods -n research`.
3. **Create a Pod in a namespace:** `kubectl run redis --image=redis -n finance`.
4. **Find which namespace a Pod is in:** `kubectl get pods -A | grep blue`.
5. **Reach a Service in another namespace:** use `<service>.<namespace>.svc.cluster.local` (e.g. `db-service.dev.svc.cluster.local`).

### Verify
`kubectl get pods -n <ns>` shows your Pod; `kubectl get pods` (default) does not. If a task says "in the X namespace" always add `-n X` to every command.

@@ 02-Core-Concepts/20-Services
### What it does
A Service gives a **stable virtual IP and DNS name** to a changing set of Pods selected by labels, and load-balances across the ready ones.

### Types
- **ClusterIP** (default): reachable only inside the cluster.
- **NodePort**: also opens a port 30000-32767 on every node (`nodeIP:nodePort`).
- **LoadBalancer**: asks the cloud provider for an external load balancer (on bare metal it stays `<pending>` unless you add MetalLB).

### Create
```
kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort --name=web-svc
kubectl create service nodeport web-svc --tcp=80:8080 --node-port=30080
```
```yaml
apiVersion: v1
kind: Service
metadata: {name: web-svc}
spec:
  type: NodePort
  selector: {app: web}
  ports:
  - port: 80          # Service port
    targetPort: 8080  # container port
    nodePort: 30080   # optional, 30000-32767
```
### Check
```
kubectl get svc web-svc
kubectl get endpoints web-svc        # must list Pod IPs
curl http://<node-ip>:30080
```
### Watch out
Empty endpoints = selector doesn't match Pod labels or Pods aren't Ready. `port` is what clients use; `targetPort` must match what the container listens on.

@@ 02-Core-Concepts/21-Services-ClusterIP
### What it does
ClusterIP is the default Service type: an internal-only virtual IP, ideal for tier-to-tier traffic (frontend → backend → database) where each tier scales independently and Pods come and go.

### Create
```
kubectl expose deployment backend --port=80 --target-port=8080 --name=back-end      # ClusterIP by default
kubectl create service clusterip back-end --tcp=80:8080
```
```yaml
apiVersion: v1
kind: Service
metadata: {name: back-end}
spec:
  type: ClusterIP
  selector: {app: myapp, type: back-end}
  ports: [{port: 80, targetPort: 80}]
```
### Use it
Other Pods call `http://back-end` (same namespace) or `back-end.<ns>.svc.cluster.local`. Test: `kubectl run t --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- back-end`.

### Watch out
`kubectl create service clusterip` generates a selector `app=<name>`, so edit the selector to match your Pods or use `kubectl expose`, which copies the selector from the Deployment.

@@ 02-Core-Concepts/22-Practice-Test-Services
### How to work through this lab
1. **Service details:** `kubectl get svc` (TYPE, CLUSTER-IP, PORT), `kubectl describe svc <name>` (Endpoints, Selector, TargetPort).
2. **How many endpoints?** `kubectl get ep <svc>`.
3. **Which Pods does the Service select?** Compare `Selector` in describe with `kubectl get pods --show-labels`.
4. **Create a Service for a Deployment:** `kubectl expose deployment simple-webapp-deployment --name=webapp-service --target-port=8080 --type=NodePort --port=8080`, then set a fixed `nodePort` with `kubectl edit svc` (30080) if asked; `expose` cannot set it.
5. **Quickly generate YAML:** add `--dry-run=client -o yaml`.

### Verify
`curl <nodeIP>:<nodePort>` or `kubectl get ep` shows Pod IPs.

@@ 02-Core-Concepts/23-Imperative-Commands-with-kubectl
### Why it matters
On the exam time is tight: imperative commands create objects in seconds and `--dry-run=client -o yaml` generates a template you only have to tweak. Declarative (`kubectl apply -f`) is the right way to manage long-lived objects.

### Cheat sheet
```
export do="--dry-run=client -o yaml"
kubectl run nginx --image=nginx $do > pod.yaml
kubectl run tmp --image=busybox --restart=Never -it --rm -- sh
kubectl run web --image=nginx --port=80 --labels="tier=db,app=web" --env=KEY=val
kubectl create deployment web --image=nginx --replicas=3 $do
kubectl expose pod web --port=80 --name=web-svc --target-port=8080
kubectl expose deployment web --port=80 --type=NodePort
kubectl create namespace dev
kubectl create configmap cfg --from-literal=A=1
kubectl create secret generic s --from-literal=pw=x
kubectl create serviceaccount sa
kubectl create role / rolebinding / clusterrole ...
kubectl create job j --image=busybox -- echo hi
kubectl create cronjob c --image=busybox --schedule="*/5 * * * *" -- date
kubectl set image / set resources / scale / label / annotate / taint / cordon
kubectl run test --image=busybox --command -- sleep 3600
```
### Workflow
1. Generate YAML: `kubectl create deployment ... $do > d.yaml`.
2. Edit what the flags can't express (volumes, probes, affinity).
3. `kubectl apply -f d.yaml` and verify.

### Watch out
Put command arguments after `--`. `kubectl create deployment` has no `--port`/`--env` (use `kubectl set env` or edit the YAML). `--dry-run=client` never contacts the cluster so errors may only appear on apply.

@@ 02-Core-Concepts/24-Practice-Test-Imperative-Commands
### How to work through this lab
Create each object imperatively and verify it:
1. `kubectl run nginx-pod --image=nginx:alpine`
2. `kubectl run redis --image=redis:alpine --labels="tier=db"`
3. `kubectl expose pod redis --port=6379 --name=redis-service`
4. `kubectl create deployment webapp --image=kodekloud/webapp-color --replicas=3`
5. `kubectl run custom-nginx --image=nginx --port=8080`
6. `kubectl create namespace dev-ns` then `kubectl create deployment redis-deploy -n dev-ns --image=redis --replicas=2`
7. `kubectl run httpd --image=httpd:alpine --port=80 --expose` (creates the Pod and a ClusterIP Service).

### Verify
`kubectl get pods,svc,deploy -A | grep <name>`; `kubectl describe` for labels and ports. If a flag is rejected, run `kubectl <cmd> --help | grep -A2 <flag>`.
