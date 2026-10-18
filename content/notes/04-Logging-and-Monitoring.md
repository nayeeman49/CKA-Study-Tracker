## What this section is about
Seeing what the cluster and your applications are doing. On the exam this appears as "which Pod uses the most CPU", "read the logs of a crashed container" and "why is `kubectl top` failing".

## Monitoring resource usage
Kubernetes does not ship a full monitoring stack. The built-in piece is **metrics-server**, which scrapes kubelets and exposes the Metrics API (in-memory, short-lived, no history):
```
kubectl top nodes
kubectl top pods -A --sort-by=cpu
kubectl top pod mypod --containers
```
If `kubectl top` says "Metrics API not available", metrics-server is missing or unhealthy (check the `metrics-server` Deployment in `kube-system`; in labs it often needs `--kubelet-insecure-tls`). For history and alerting you add Prometheus/Grafana, which is outside the exam. The Metrics API also feeds the Horizontal Pod Autoscaler.

## Container logs
```
kubectl logs mypod                     # single container
kubectl logs mypod -c sidecar          # pick a container
kubectl logs mypod --previous          # the crashed/restarted instance
kubectl logs -l app=web --tail=50 -f   # by label, follow
kubectl logs deploy/web
```
Logs are written by the runtime to `/var/log/pods/...` and `/var/log/containers/` on the node and rotated by the kubelet. There is no cluster-level log storage by default; real clusters add a node-level agent (DaemonSet) shipping to a backend.

## Cluster component logs
- Kubeadm static-pod components: `kubectl logs -n kube-system kube-apiserver-<node>`; if the API server is down use `crictl ps -a` and `crictl logs <id>` on the node, or read `/var/log/pods`.
- kubelet and containerd are systemd services: `journalctl -u kubelet -f`, `systemctl status kubelet`.

## Events
`kubectl get events -A --sort-by=.metadata.creationTimestamp` (events expire after about an hour). `kubectl describe` shows events for a single object.

## Exam tips
- Use `kubectl top` with `--sort-by` and `--no-headers | head -1` for "find the highest" questions.
- A Pod in `CrashLoopBackOff`: `logs --previous` first, then `describe` for exit code and OOMKilled.
- Probes (liveness/readiness/startup) failing show up in `describe` events.

## Official documentation
- [Resource metrics pipeline](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
- [Logging Architecture](https://kubernetes.io/docs/concepts/cluster-administration/logging/)
- [Monitoring, Logging and Debugging](https://kubernetes.io/docs/tasks/debug/)
- [Debugging nodes with crictl](https://kubernetes.io/docs/tasks/debug/debug-cluster/crictl/)
