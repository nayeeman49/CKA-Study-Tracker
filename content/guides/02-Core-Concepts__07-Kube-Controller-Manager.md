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
