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
