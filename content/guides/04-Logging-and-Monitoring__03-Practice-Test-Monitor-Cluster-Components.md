### How to approach this lab

The lab deploys a Metrics Server (or has one deployed) and asks which node or Pod consumes the most resources.

### Commands

```bash
kubectl top node
kubectl top node --sort-by=cpu
kubectl top pod
kubectl top pod --sort-by=memory
kubectl top pod -A --sort-by=cpu --no-headers | head -1
kubectl -n kube-system get pods | grep metrics
kubectl -n kube-system logs deploy/metrics-server
```

### Typical questions

| Question | Answer approach |
|---|---|
| Which node consumes the most CPU? | `kubectl top node` |
| Which node consumes the most memory? | `kubectl top node --sort-by=memory` |
| Which Pod uses the most memory? | `kubectl top pod --sort-by=memory` |
| Which Pod uses the least CPU? | `kubectl top pod --sort-by=cpu` (last line) |

### Tips

- Give the Metrics Server a minute after deployment before querying.
- Use `-A` to include all namespaces.

### Worked example

```bash
kubectl top node --sort-by=cpu --no-headers | head -1        # busiest node
kubectl top pod -A --sort-by=memory --no-headers | head -1   # hungriest Pod
kubectl top pod -A --sort-by=cpu --no-headers | tail -1      # least CPU
```

### If metrics are missing

```bash
kubectl -n kube-system get deploy metrics-server
kubectl -n kube-system logs deploy/metrics-server
kubectl get apiservice v1beta1.metrics.k8s.io       # Available should be True
```

### Common mistakes

- Querying before the first scrape (about a minute).
- Forgetting `-A` for Pods in other namespaces.
