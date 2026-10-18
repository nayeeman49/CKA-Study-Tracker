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
