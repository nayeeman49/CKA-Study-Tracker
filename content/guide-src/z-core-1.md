@@ 02-Core-Concepts/02-Cluster-Architecture
### Introduction

Before working with Pods, Deployments, Services, or troubleshooting applications, you must understand how a Kubernetes cluster is built internally.

Kubernetes is a distributed container orchestration platform designed to manage containerized applications across multiple machines. Rather than running containers directly on a single server, Kubernetes creates an entire platform that manages deployment, scaling, networking, storage, recovery, and maintenance automatically.

At a high level, a Kubernetes cluster consists of:

- **Control Plane components**
- **Worker Node components**

The Control Plane makes decisions. Worker Nodes perform the work.

### Kubernetes cluster overview

```
                    Kubernetes Cluster

                   CONTROL PLANE NODE
┌────────────────────────────────────────────────────┐
│                                                    │
│  kube-apiserver                                    │
│  etcd                                              │
│  kube-scheduler                                    │
│  kube-controller-manager                           │
│                                                    │
└────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼

     WORKER 1         WORKER 2         WORKER 3
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ kubelet     │   │ kubelet     │   │ kubelet     │
│ kube-proxy  │   │ kube-proxy  │   │ kube-proxy  │
│ containerd  │   │ containerd  │   │ containerd  │
└─────────────┘   └─────────────┘   └─────────────┘
      Pods              Pods              Pods
```

### The goal of Kubernetes

Kubernetes exists to solve common problems when running applications:

- Application deployment
- Application scaling
- High availability
- Self-healing
- Service discovery
- Load balancing
- Storage management
- Rolling updates

Without Kubernetes, an administrator must perform these tasks manually. Kubernetes automates them.

### Control Plane

The Control Plane is the brain of the cluster. It continuously monitors everything inside Kubernetes and decides what actions should occur.

Responsibilities include:

- Accepting requests
- Scheduling workloads
- Monitoring system health
- Recovering failed workloads
- Managing cluster state
- Maintaining desired state

Control Plane components: **kube-apiserver**, **etcd**, **kube-scheduler**, **kube-controller-manager**. Every cluster requires a Control Plane.

### Worker Nodes

Worker Nodes perform the actual work. Applications never run inside the Control Plane; they run on Worker Nodes.

Worker Node components: **kubelet**, **kube-proxy**, and a **container runtime**.

Worker Nodes host Pods, containers and applications.

> In a lab built with kubeadm the control plane node is usually also tainted so ordinary Pods do not land on it. You will see that taint when you reach the Taints and Tolerations lesson.

### Understanding the flow of a cluster

Imagine a user creates a Pod:

```bash
kubectl run nginx --image=nginx
```

What happens internally?

#### Step 1 - kubectl sends the request

```
kubectl
    │
    ▼
API Server
```

kubectl is simply a client. All communication eventually goes through the API Server.

#### Step 2 - API Server validates the request

The API Server performs:

- Authentication
- Authorization
- Admission control
- Request validation

For example: is the user allowed? Is the YAML valid? Does the resource exist? If validation succeeds, processing continues.

#### Step 3 - information is stored in ETCD

The desired state is stored in ETCD.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - image: nginx
```

#### Step 4 - Scheduler detects an unscheduled Pod

Initially the Pod is `Pending`. No worker node has been assigned. The Scheduler sees the Pod needs placement.

#### Step 5 - Scheduler selects a node

The Scheduler evaluates available CPU, available memory, taints, tolerations, affinity, anti-affinity, labels and resource requests.

```
Worker-1  CPU 90%
Worker-2  CPU 15%      -> select Worker-2
```

#### Step 6 - node selected

The Scheduler updates cluster state (`Pod -> Worker-2`). The placement decision is complete.

#### Step 7 - Kubelet receives instructions

The Kubelet running on Worker-2 detects that a Pod has been assigned to it and begins Pod creation.

#### Step 8 - container runtime creates the containers

The Kubelet communicates with containerd, which downloads the image, creates the container and starts it.

#### Step 9 - Pod running

Final state: `Running`. The application becomes available.

### The desired state model

One of the most important Kubernetes concepts is **desired state**. You tell Kubernetes:

```yaml
replicas: 3
```

Kubernetes stores `Desired State = 3`. Current reality is `Actual State = 3`, so everything is healthy.

#### Pod failure example

Suppose one Pod crashes. Actual state becomes `2 Pods Running` while desired state remains `3 Pods Running`. Controllers detect the difference and create a new Pod. The cluster returns to desired state.

### The API Server

The API Server is the most important component in Kubernetes. Everything eventually communicates through it.

```bash
kubectl get pods
kubectl get nodes
kubectl create deployment nginx --image=nginx
kubectl delete pod nginx
```

```
User
  │
  ▼
API Server
```

#### API Server responsibilities

- **Authentication** - identify users (certificates, tokens, service accounts).
- **Authorization** - decide what the user may do (can this user create Pods? delete Deployments?).
- **Validation** - reject invalid requests, for example `replicas: abc`.
- **Cluster communication** - the Scheduler, Controller Manager and Kubelet all interact with it.

### ETCD

ETCD is Kubernetes' database. It stores cluster information as key-value pairs.

ETCD stores: Pods, Deployments, Services, Secrets, Namespaces, Nodes, RBAC rules and ConfigMaps. Everything important lives in ETCD.

#### Why ETCD is critical

Imagine ETCD disappears. Kubernetes loses its current state, desired state and cluster configuration, and the cluster cannot function properly. That is why ETCD backups are critical.

#### ETCD characteristics

- **Distributed** - multiple ETCD servers can form a cluster (ETCD-1, ETCD-2, ETCD-3) and data is replicated across all members.
- **Consistent** - uses the Raft consensus algorithm so every member agrees on cluster state.
- **Highly available** - if the leader goes down, followers elect a new leader and the cluster keeps operating.

### Kube Scheduler

The Scheduler decides where Pods run. It never runs containers; it only makes placement decisions.

Factors it considers:

- **Resource availability** - CPU, memory, storage
- **Labels** - for example `nodeSelector: {disktype: ssd}`
- **Taints and tolerations** - control where workloads can run
- **Affinity** - prefer specific nodes
- **Anti-affinity** - avoid specific nodes

Example decision:

```
Node1 CPU 95%
Node2 CPU 40%
Node3 CPU 20%      -> Scheduler chooses Node3
```

### Controller Manager

Controllers maintain desired state. Every controller follows the same loop: **Observe, Compare, Correct**.

- **Node controller** - monitors nodes. A node that becomes unreachable goes `NotReady` and the controller initiates recovery.
- **ReplicaSet controller** - desired `replicas: 5`, actual 4 running, so it creates 1 new Pod.
- **Deployment controller** - handles rolling updates, rollbacks and ReplicaSets, and maintains Deployment state.

### Worker node components

#### Kubelet

The Kubelet is the node agent and runs on every worker node. Responsibilities: node registration, Pod creation, Pod monitoring and status reporting.

```
API Server
     │
     ▼
Kubelet
     │
     ▼
Container Runtime
```

The Kubelet constantly verifies workloads remain healthy.

#### Container runtime

A container runtime creates containers. Common runtimes are containerd and CRI-O (historically Docker). It pulls images, and starts, stops, monitors and deletes containers. For image `nginx:latest` the runtime downloads the image, creates the container and starts it.

#### Kube Proxy

Kube Proxy provides Service networking and runs on every worker node.

The problem it solves: Pods A, B and C each receive a dynamic IP, and Pod IPs constantly change. Applications need a stable endpoint. Create a Service (`kind: Service`) and traffic goes:

```
Client
   │
Service
   │
 ┌─┼─┐
 ▼ ▼ ▼
 A B C
```

Kube Proxy manages the routing: traffic forwarding, load balancing, and service connectivity.

### Container networking

Each Pod receives a unique IP address and Pods communicate over the cluster network.

```
Frontend Pod -> Backend Pod -> Database Pod
```

### High availability control plane

Production environments typically run multiple control plane nodes (Control Plane 1, 2 and 3). Benefits: redundancy, fault tolerance and high availability.

### Single node cluster

Learning environments may combine everything into one machine: API Server, ETCD, Scheduler, Controller Manager and worker components all running together. Suitable for labs, testing and learning. Not for production.

### How the control plane runs in a kubeadm cluster

In the exam and in most labs the control plane components run as **static Pods** on the control plane node. They show up in the `kube-system` namespace, and their manifests live on disk:

```bash
ls /etc/kubernetes/manifests/
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
```

The kubelet watches that folder. Edit a file and the kubelet restarts that component. You will use this when you troubleshoot a broken control plane.

### Common CKA commands

```bash
kubectl get nodes                          # view nodes
kubectl get pods -n kube-system            # view system Pods
kubectl describe node worker-1             # node details
kubectl cluster-info                       # cluster information
```

### CKA exam tips

Remember these one-line definitions:

| Component | Purpose |
|---|---|
| API Server | Cluster entry point |
| ETCD | Source of truth |
| Scheduler | Chooses nodes |
| Controller Manager | Maintains desired state |
| Kubelet | Node agent |
| Kube Proxy | Service networking |
| Container Runtime | Runs containers |

#### Complete Pod creation flow

Memorise this diagram:

```
kubectl
   │
   ▼
API Server
   │
   ▼
ETCD
   │
   ▼
Scheduler
   │
   ▼
Worker Node
   │
   ▼
Kubelet
   │
   ▼
Container Runtime
   │
   ▼
Pod Running
```

This is one of the most frequently tested architecture concepts in the CKA exam.

### Key takeaways

- Kubernetes consists of a Control Plane and Worker Nodes.
- The API Server is the central communication hub.
- ETCD stores the cluster state and acts as the source of truth.
- The Scheduler determines Pod placement.
- Controllers maintain desired state.
- The Kubelet manages Pods on Worker Nodes.
- containerd or CRI-O runs containers.
- Kube Proxy provides Service networking.
- Kubernetes continuously reconciles actual state with desired state.
- Understanding the Pod creation workflow is essential for both the CKA exam and real-world Kubernetes administration.

@@ 02-Core-Concepts/03-Docker-vs-ContainerD
### Introduction

People say "Kubernetes runs Docker containers", but that has not been accurate for years. Kubernetes does not run containers itself. It asks a **container runtime** on each node to do it. Understanding the difference between Docker and containerd, and why Kubernetes moved on from Docker, explains a lot of commands you will meet in the exam (`crictl`, `ctr`, `nerdctl`) and why `docker ps` often shows nothing on a Kubernetes node.

### The layers of a container platform

A container is not one thing. Several layers cooperate:

```
┌─────────────────────────────────────────┐
│  Docker CLI / kubectl     (user tools)  │
├─────────────────────────────────────────┤
│  Docker Engine (dockerd)  or  kubelet   │
├─────────────────────────────────────────┤
│  containerd  /  CRI-O     (high-level   │
│                            runtime)     │
├─────────────────────────────────────────┤
│  runc                     (low-level    │
│                            runtime)     │
├─────────────────────────────────────────┤
│  Linux kernel: namespaces + cgroups     │
└─────────────────────────────────────────┘
```

- **runc** talks to the kernel and actually starts the isolated process (namespaces for isolation, cgroups for resource limits).
- **containerd** manages the container lifecycle: pulling images, storing them, creating containers and snapshots, calling runc.
- **Docker Engine** is a full developer platform on top of containerd. It adds building images, a CLI, networking, volumes and a friendly UX.

Kubernetes only needs the middle layer (pull images, run containers). Docker's extra features are not needed on a cluster node.

### Why standards matter: OCI and CRI

#### OCI - Open Container Initiative

OCI defines two specifications so tools are interchangeable:

- **Image spec** - how a container image is packaged.
- **Runtime spec** - how a runtime starts a container from that image.

An image built with Docker runs on containerd, CRI-O or Podman because they all follow OCI.

#### CRI - Container Runtime Interface

In the early days Kubernetes was hard-wired to Docker. To support other runtimes, Kubernetes introduced the **CRI**, a gRPC API the kubelet uses to talk to any compatible runtime.

```
kubelet ──CRI──► containerd ──► runc ──► container
kubelet ──CRI──► CRI-O      ──► runc ──► container
```

Any runtime that implements CRI works. containerd and CRI-O do. Docker Engine did not, so Kubernetes included a small adapter called **dockershim** to translate.

### What happened to dockershim

Maintaining dockershim inside Kubernetes was a burden. It was **deprecated in v1.20 and removed in v1.24**. Important points:

- **Images built with Docker still work.** They are OCI images.
- You can still build with Docker on your laptop and push to a registry.
- Nodes now normally use **containerd** (or CRI-O). Docker Engine is not installed on them.
- If you really want Docker Engine as the runtime you need the external `cri-dockerd` adapter.

Docker itself was already using containerd internally. Kubernetes simply started talking to containerd directly and skipped Docker.

### Command-line tools - which one to use

| Tool | Made for | Understands Kubernetes? | Typical use |
|---|---|---|---|
| `docker` | Developers | No | Build, run, push images on a workstation |
| `ctr` | containerd debugging | No | Low level, not user friendly |
| `nerdctl` | Docker-like CLI for containerd | Partly (namespaces) | Docker-style commands on containerd nodes |
| `crictl` | Any CRI runtime | **Yes** | Inspect and debug containers on a Kubernetes node |

`crictl` is the one to know for the CKA. It talks CRI, so it sees the containers the kubelet created.

```bash
crictl ps                      # running containers
crictl ps -a                   # include stopped ones
crictl pods                    # Pod sandboxes
crictl images                  # images on this node
crictl logs <container-id>     # logs of a container
crictl inspect <container-id>  # full detail
crictl pull nginx              # pull an image
```

If `crictl` complains about endpoints, point it at the runtime socket:

```bash
export CONTAINER_RUNTIME_ENDPOINT=unix:///run/containerd/containerd.sock
# or put it in /etc/crictl.yaml
# runtime-endpoint: unix:///run/containerd/containerd.sock
```

Do not use `docker ps` on a modern node. It will show nothing because there is no Docker daemon.

### Why `crictl` instead of `kubectl` here

`kubectl` talks to the API Server and shows Kubernetes objects. If the API Server is down (a common troubleshooting scenario), `kubectl` is useless. `crictl` works directly on the node, so it is how you check whether the `kube-apiserver` or `etcd` containers are actually running.

```bash
crictl ps -a | grep kube-apiserver
crictl logs <id>
```

### Image lifecycle on a node

```
Pod scheduled to node
        │
        ▼
kubelet asks runtime (via CRI) to create the Pod sandbox
        │
        ▼
runtime pulls image from the registry (if not present)
        │
        ▼
runtime unpacks image layers, creates the container
        │
        ▼
runc starts the container process
```

The `imagePullPolicy` setting decides whether the image is pulled again (`Always`, `IfNotPresent`, `Never`).

### Where things live on a containerd node

| Item | Location |
|---|---|
| containerd config | `/etc/containerd/config.toml` |
| containerd socket | `/run/containerd/containerd.sock` |
| Kubelet config | `/var/lib/kubelet/config.yaml` |
| Container logs | `/var/log/pods/` and `/var/log/containers/` |

Check the service:

```bash
systemctl status containerd
journalctl -u containerd --no-pager | tail -50
```

### Troubleshooting

- **Pod stuck in `ContainerCreating` or `ImagePullBackOff`**: `kubectl describe pod` shows the pull error. On the node, `crictl pull <image>` reproduces it.
- **Node `NotReady` and kubelet logs say it cannot reach the runtime**: `systemctl status containerd`; restart it with `systemctl restart containerd`.
- **`crictl` errors about the endpoint**: set `CONTAINER_RUNTIME_ENDPOINT` or `/etc/crictl.yaml`.
- **"docker: command not found" on a node**: expected. Use `crictl`.

### CKA exam tips

- `crictl ps -a` is the go-to when the control plane is down.
- Know the chain: `kubelet -> CRI -> containerd -> runc`.
- Docker-built images are fine on containerd because of the OCI standard.
- Dockershim was removed in Kubernetes **1.24**.

### Key takeaways

- Kubernetes talks to runtimes through the CRI, not directly to Docker.
- containerd is the usual runtime; CRI-O is the other common one.
- OCI makes images portable between tools.
- Use `crictl` to inspect containers on a node, `docker` on your laptop.

@@ 02-Core-Concepts/04-ETCD-For-Beginners
### Introduction

ETCD is a distributed, reliable key-value store. Kubernetes keeps all of its cluster state in it. Before you look at how Kubernetes uses ETCD, it helps to understand ETCD on its own: what a key-value store is, how it differs from a normal database, how several ETCD servers stay in agreement, and how to read and write data with `etcdctl`.

### What is a key-value store?

A traditional relational database stores data in tables with rows and columns. Adding a new attribute means changing the table for every row. A key-value store is simpler: every record is one key with one value, and records are independent.

```
Table style                    Key-value style
┌──────┬─────┬───────┐         name   = "Ana"
│ name │ age │ city  │         age    = "34"
├──────┼─────┼───────┤         city   = "Leeds"
│ Ana  │ 34  │ Leeds │
└──────┴─────┴───────┘
```

Each person can have different fields without touching anyone else's record. It is fast to look up by key and easy to replicate.

### What ETCD is

- Open source, started at CoreOS and now a CNCF project.
- Simple, secure (TLS client auth) and fast.
- Strongly **consistent**: every read returns the latest committed write.
- Distributed: several members form a cluster.
- Listens on **port 2379** for clients and **2380** for peer (member to member) traffic.

The name comes from the Unix `/etc` directory plus "d" for distributed.

### Installing and running ETCD (concept)

You download the binary, start it, and it listens on 2379.

```bash
./etcd                     # starts a server on localhost:2379
```

The command-line client is `etcdctl`. It has two API versions, and the version matters:

```bash
etcdctl version
export ETCDCTL_API=3        # use the v3 API (default in current releases)
```

Version 2 commands (`etcdctl set key value`) differ from version 3 (`etcdctl put key value`). The CKA uses **v3**.

### Basic operations

```bash
etcdctl put name "Ana"          # write
etcdctl get name                # read
etcdctl get name --print-value-only
etcdctl get / --prefix --keys-only   # list all keys
etcdctl del name                # delete
```

### How ETCD stays consistent: leader and followers

When you run several ETCD members, they need to agree on the order of writes, even if members fail. ETCD uses the **Raft** consensus algorithm.

```
              ┌───────────┐
   writes ──► │  LEADER   │
              └─────┬─────┘
          replicate │ log entries
        ┌───────────┴───────────┐
        ▼                       ▼
  ┌───────────┐           ┌───────────┐
  │ FOLLOWER  │           │ FOLLOWER  │
  └───────────┘           └───────────┘
```

How it works in plain terms:

1. One member is elected **leader**. The others are **followers**.
2. A client can talk to any member, but writes are forwarded to the leader.
3. The leader appends the write to its log and sends it to the followers.
4. The write is **committed** only when a **majority** (quorum) has stored it.
5. If the leader stops sending heartbeats, followers hold an election and a new leader takes over.

### Quorum - how many members you need

Quorum is the minimum number of members that must agree: `floor(N/2) + 1`.

| Members (N) | Quorum | Failures tolerated |
|---|---|---|
| 1 | 1 | 0 |
| 2 | 2 | 0 |
| 3 | 2 | 1 |
| 4 | 3 | 1 |
| 5 | 3 | 2 |
| 6 | 4 | 2 |
| 7 | 4 | 3 |

Two takeaways for exams and real life:

- **Use an odd number** of members. Four members tolerate no more failures than three, but need more machines.
- With **1 or 2** members you have no real fault tolerance. Three is the practical minimum for HA; five is common for larger clusters.

If quorum is lost (for example, two of three members die), the cluster becomes read-only or unavailable until quorum returns. It will not accept writes that it cannot safely agree on.

### Watching for changes

Kubernetes components do not poll constantly. ETCD supports **watches**: a client asks to be notified when a key changes.

```bash
etcdctl watch /registry/pods --prefix
```

The API Server uses this to react quickly when objects change.

### Snapshots and backup (preview)

ETCD can save a point-in-time copy of its whole database:

```bash
etcdctl snapshot save backup.db
etcdctl snapshot status backup.db
```

You will use this for real in the cluster maintenance section.

### Troubleshooting ideas

- **Cannot connect**: check the endpoint and port (`--endpoints=https://127.0.0.1:2379`).
- **Auth errors**: a secure ETCD needs `--cacert`, `--cert`, `--key` (covered in the next page).
- **"no leader" errors**: quorum has been lost; bring members back.
- **Wrong results or strange command syntax**: check `ETCDCTL_API`.

### CKA exam tips

- Know ports **2379** (client) and **2380** (peer).
- Know that ETCD uses **Raft** and needs a **majority**.
- `ETCDCTL_API=3` is the safe default when typing commands from memory.

### Key takeaways

- ETCD is a consistent, distributed key-value store.
- One leader handles writes; followers replicate them.
- A write succeeds only when a majority has it.
- Use an odd number of members; three or five for HA.
- `etcdctl put/get/del` are the basic operations.

@@ 02-Core-Concepts/05-ETCD-in-Kubernetes
### Introduction

In Kubernetes, ETCD is the single source of truth. Every object you create, from a Pod to a Secret, is stored in ETCD by the API Server, and nothing else talks to ETCD directly. This page shows what is stored, how ETCD is deployed in the two common styles, how to connect to it with the right certificates, and how to check its health. Backup and restore get their own lessons later; here the focus is understanding and inspecting it.

### What Kubernetes stores in ETCD

Every cluster object: nodes, Pods, ConfigMaps, Secrets, accounts, roles, bindings, Deployments and more. When you run `kubectl get`, the API Server reads from ETCD (usually through its cache). When you `kubectl apply`, the API Server writes to ETCD. A change is only "real" once it is committed in ETCD.

```
kubectl ──► kube-apiserver ──► etcd
                 ▲
 scheduler, controller manager, kubelet
 (all go through the API Server, never to etcd)
```

Only the **kube-apiserver** is an ETCD client. That is why the API Server flag `--etcd-servers` is so important.

### Two ways ETCD is deployed

#### 1. Stacked ETCD (kubeadm default)

ETCD runs as a **static Pod** on each control plane node, in the `kube-system` namespace.

```
control plane node
┌────────────────────────────────┐
│ kube-apiserver                 │
│ kube-scheduler                 │
│ kube-controller-manager        │
│ etcd  (static Pod)             │
└────────────────────────────────┘
```

```bash
kubectl get pods -n kube-system | grep etcd
# etcd-controlplane   1/1   Running
cat /etc/kubernetes/manifests/etcd.yaml
```

#### 2. External ETCD

ETCD runs on its own servers outside the cluster. The API Server points to it by URL.

```
┌──────────────┐        ┌────────────────────┐
│ control plane│──────► │ etcd-1 etcd-2 etcd-3│
└──────────────┘ https  └────────────────────┘
```

Here ETCD is usually a systemd service, not a Pod.

```bash
systemctl status etcd
cat /etc/systemd/system/etcd.service
```

### How to tell which type you have

```bash
# Look at the API server for the etcd URL
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep etcd-servers
#  --etcd-servers=https://127.0.0.1:2379      -> stacked (local)
#  --etcd-servers=https://10.0.0.11:2379,...   -> external
```

Or check whether a static Pod manifest for etcd exists: `ls /etc/kubernetes/manifests`.

### Important ETCD options

Read the `etcd.yaml` manifest or service file. Key arguments:

| Option | Meaning |
|---|---|
| `--data-dir` | Where the database lives (default `/var/lib/etcd`) |
| `--listen-client-urls` | Where it accepts client connections (2379) |
| `--advertise-client-urls` | URL clients are told to use |
| `--listen-peer-urls` | Member-to-member traffic (2380) |
| `--initial-cluster` | List of members when bootstrapping |
| `--cert-file`, `--key-file` | ETCD's server certificate and key |
| `--trusted-ca-file` | CA that signed client certificates |
| `--peer-*` | Same, for peer communication |
| `--client-cert-auth=true` | Require client certificates |

You need `--data-dir` and the certificate paths for backup and restore.

### Connecting with etcdctl in a kubeadm cluster

Because ETCD requires client certificates, `etcdctl` needs them too. kubeadm places them in `/etc/kubernetes/pki/etcd/`.

```bash
export ETCDCTL_API=3

etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  member list
```

Where to find the correct paths if you forget:

```bash
kubectl -n kube-system describe pod etcd-controlplane | grep -E "cert|key|ca|listen"
# or
grep -E "cert-file|key-file|trusted-ca" /etc/kubernetes/manifests/etcd.yaml
```

To avoid typing flags each time you can export environment variables:

```bash
export ETCDCTL_ENDPOINTS=https://127.0.0.1:2379
export ETCDCTL_CACERT=/etc/kubernetes/pki/etcd/ca.crt
export ETCDCTL_CERT=/etc/kubernetes/pki/etcd/server.crt
export ETCDCTL_KEY=/etc/kubernetes/pki/etcd/server.key
```

### Useful inspection commands

```bash
etcdctl member list -w table              # members and their IDs
etcdctl endpoint health -w table          # is each member healthy?
etcdctl endpoint status -w table          # leader, DB size, raft index
etcdctl get / --prefix --keys-only | head # keys stored
```

### How objects are laid out in ETCD

Kubernetes stores everything under the `/registry` prefix.

```bash
etcdctl get /registry --prefix --keys-only
# /registry/pods/default/nginx
# /registry/deployments/default/web
# /registry/secrets/kube-system/...
# /registry/namespaces/default
```

Values are stored in a binary (protobuf) format, so `etcdctl get` output looks garbled. Secrets are **not encrypted at rest by default**, which is why access to ETCD must be restricted. Encryption at rest is a security topic covered later.

### What happens if ETCD is unhealthy

- API Server logs show timeouts or "etcdserver: ..." errors.
- `kubectl` commands hang or fail.
- Running Pods keep running (the kubelet works from local state), but you cannot change anything.

### Troubleshooting

- **kube-apiserver crashlooping with etcd errors**: check the `--etcd-servers` URL and the certificate paths in `/etc/kubernetes/manifests/kube-apiserver.yaml`.
- **etcd Pod not starting**: inspect `crictl ps -a | grep etcd`, `crictl logs <id>`, and verify `--data-dir` exists and has the right permissions.
- **`etcdctl` hangs or says "context deadline exceeded"**: wrong endpoint, missing certificates, or ETCD is down.
- **Certificate errors**: compare the cert paths used by `etcdctl` with those in the manifest.

### CKA exam tips

- Only the API Server talks to ETCD.
- Know the default data directory `/var/lib/etcd` and certificate folder `/etc/kubernetes/pki/etcd`.
- Find paths from the manifest (`/etc/kubernetes/manifests/etcd.yaml`) instead of guessing.
- Always set `ETCDCTL_API=3` and pass `--cacert`, `--cert`, `--key`, `--endpoints`.
- Stacked vs external changes where you look: Pod vs systemd service.

### Key takeaways

- ETCD holds all cluster state and is the source of truth.
- It runs as a static Pod (stacked) or as an external service.
- Only the API Server is a client; it authenticates with certificates.
- `etcdctl` needs the same TLS files to connect.
- Protect ETCD and back it up; losing it means losing the cluster's state.
