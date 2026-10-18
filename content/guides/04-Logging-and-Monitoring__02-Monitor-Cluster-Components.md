### Introduction

Monitoring tells you how healthy the cluster and its workloads are: node CPU and memory, Pod resource use, and the state of control plane components. Kubernetes has **no full built-in monitoring solution**. It ships with a lightweight metrics pipeline (Metrics Server) and relies on tools such as Prometheus, Grafana, Datadog or the Elastic stack for more.

### What you want to monitor

- **Node level**: number of nodes, how many are healthy, CPU, memory, disk and network use.
- **Pod level**: number of Pods, and each Pod's CPU and memory consumption.
- **Control plane health**: API Server, scheduler, controller manager, ETCD.
- **Application level**: logs and custom metrics.

### How metrics flow

```
 kubelet (contains cAdvisor)  collects container metrics
          │
          ▼
   Metrics Server   (in-memory, aggregates from every kubelet)
          │
          ▼
   kubectl top  /  Horizontal Pod Autoscaler
```

- **cAdvisor** is part of the kubelet; it gathers container CPU, memory, filesystem, network usage.
- **Metrics Server** collects these from all nodes and keeps them **in memory only** (no history). It powers `kubectl top` and autoscaling.
- For history, graphs and alerts you need Prometheus or another system.

### Installing the Metrics Server

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system get deploy metrics-server
```

In lab clusters with self-signed kubelet certificates you may need `--kubelet-insecure-tls` on the deployment args.

### Using it

```bash
kubectl top node
kubectl top pod
kubectl top pod -A --sort-by=memory
kubectl top pod --containers
kubectl top pod -l app=web
```

Output columns: `CPU(cores)` e.g. `250m`, `MEMORY(bytes)` e.g. `300Mi`.

### Other useful health checks

```bash
kubectl get nodes
kubectl get componentstatuses          # deprecated
kubectl get --raw='/readyz?verbose'
kubectl get --raw='/livez?verbose'
kubectl describe node node01           # conditions + allocated resources
kubectl get events -A --sort-by=.lastTimestamp
```

### Troubleshooting

- `error: Metrics API not available`: Metrics Server not installed or not ready; check its Pod and logs.
- Metrics Server runs but "x509 certificate" errors: add `--kubelet-insecure-tls` (labs only), or fix kubelet serving certs.
- `kubectl top` shows `<unknown>` right after install: wait a minute for the first scrape.

### CKA exam tips

- Know `kubectl top node/pod` and `--sort-by`.
- Know that the Metrics Server is in-memory and has no history.

### Key takeaways

- cAdvisor → kubelet → Metrics Server → `kubectl top` and HPA.
- Use Prometheus-type tooling for history and alerting.
