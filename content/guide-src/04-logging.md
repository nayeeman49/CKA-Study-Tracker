@@ 04-Logging-and-Monitoring/02-Monitor-Cluster-Components
### What you can monitor
Kubernetes has no full built-in monitoring. The built-in piece is **metrics-server**: it scrapes each kubelet's cAdvisor data and serves CPU/memory for nodes and Pods via the Metrics API (in memory, no history). For history, alerts and dashboards use Prometheus + Grafana, Datadog, etc.

### How to do it
1. Install (labs usually have it): `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`. In lab clusters with self-signed kubelet certs add `--kubelet-insecure-tls` to the Deployment args.
2. Wait for `kubectl -n kube-system get deploy metrics-server` to be Available (give it a minute).
3. Use it:
```
kubectl top node
kubectl top pod -A --sort-by=memory
kubectl top pod mypod --containers
```
### Verify
`kubectl get apiservices | grep metrics` shows `v1beta1.metrics.k8s.io True`.

### Watch out
"error: Metrics API not available" = metrics-server missing/unhealthy. HPAs need it too.

@@ 04-Logging-and-Monitoring/03-Practice-Test-Monitor-Cluster-Components
### How to work through this lab
1. **Deploy metrics-server** from the provided repo: `git clone https://github.com/kodekloudhub/kubernetes-metrics-server.git`, `cd kubernetes-metrics-server`, `kubectl create -f .`.
2. Wait about a minute, then `kubectl top node`.
3. **Which node uses the most CPU/memory?** `kubectl top node --sort-by=cpu` (or `memory`).
4. **Which Pod uses the most?** `kubectl top pod --sort-by=memory` / `--sort-by=cpu`; lowest = last row.

### Verify
`kubectl top node` prints values instead of an error. If not, `kubectl -n kube-system logs deploy/metrics-server`.

@@ 04-Logging-and-Monitoring/04-Managing-Application-Logs
### What it is
Containers write to stdout/stderr; the runtime stores those streams and `kubectl logs` reads them.

### How to do it
```
kubectl logs web                       # one container
kubectl logs web -c sidecar            # pick a container in a multi-container Pod
kubectl logs -f web                    # follow
kubectl logs web --previous            # crashed/restarted container
kubectl logs web --tail=50 --since=10m
kubectl logs -l app=web --all-containers
kubectl logs deploy/web
```
### Verify
Output appears. If you get `a container name must be specified`, add `-c <name>` (list names with `kubectl get pod web -o jsonpath='{.spec.containers[*].name}'`).

### Watch out
Logs live on the node (`/var/log/pods`, `/var/log/containers`) and disappear with the Pod; there is no cluster-level storage by default, so real clusters ship logs with a DaemonSet agent (Fluent Bit, etc.).

@@ 04-Logging-and-Monitoring/06-Practice-Test-Managing-Application-Logs
### How to work through this lab
1. **Read logs of a Pod:** `kubectl logs webapp-1` (find the user who failed login or the error in the text).
2. **Multi-container Pod:** `kubectl logs webapp-2 -c simple-webapp` and `-c db`; list names with `kubectl describe pod webapp-2`.
3. **Follow live:** `kubectl logs -f webapp-2 -c simple-webapp`.
4. **Find the right line:** pipe through grep: `kubectl logs webapp-1 | grep -i failed`.

### Verify
Your answer comes directly from the log text (user name, error message, status).
