### Introduction

Logs are the first place to look when an application misbehaves. Kubernetes captures anything a container writes to standard output (stdout) and standard error (stderr).

### Docker/runtime logs vs Kubernetes logs

In plain Docker: `docker logs -f container`. In Kubernetes the runtime stores each container's output on the node, and `kubectl logs` fetches it via the API Server and the kubelet.

```
 app writes stdout/stderr ──► runtime ──► /var/log/pods/<ns>_<pod>_<uid>/<container>/0.log
                                                │
                                           kubelet serves
                                                ▼
                                          kubectl logs
```

### kubectl logs

```bash
kubectl logs web-pod
kubectl logs -f web-pod                      # follow (stream)
kubectl logs web-pod -c sidecar              # specific container in multi-container Pod
kubectl logs web-pod --previous              # previous crashed container instance
kubectl logs web-pod --tail=50
kubectl logs web-pod --since=10m
kubectl logs web-pod --timestamps
kubectl logs -l app=web --all-containers=true
kubectl logs deploy/web
kubectl logs job/backup
```

In a Pod with multiple containers you **must** name the container with `-c`, otherwise kubectl prints an error listing the container names (or picks the default one).

### Where logs live on the node

```bash
ls /var/log/pods/
ls /var/log/containers/            # symlinks with readable names
crictl logs <container-id>         # when kubectl can't reach the API
journalctl -u kubelet              # kubelet's own logs (systemd)
```

Log rotation is handled by the kubelet (`containerLogMaxSize`, `containerLogMaxFiles`). When a Pod is deleted its logs go with it.

### Cluster-level logging

Because logs vanish with Pods, production clusters ship them to a central store:

- **Node-level agent** (DaemonSet): Fluentd/Fluent Bit/Filebeat reads files in `/var/log/containers`.
- **Sidecar container**: a second container in the Pod streams or tails a log file.
- **Direct push** from the application.

Typical stack: Fluent Bit → Elasticsearch/Loki → Kibana/Grafana.

### Apps that write to files

If an app writes logs to a file instead of stdout, `kubectl logs` shows nothing. Use `kubectl exec pod -- cat /var/log/app.log`, or add a sidecar that tails the file to its own stdout.

### Control plane logs

```bash
kubectl logs -n kube-system kube-apiserver-controlplane
kubectl logs -n kube-system etcd-controlplane
journalctl -u kubelet
crictl ps -a ; crictl logs <id>        # if API server is down
```

### Events

```bash
kubectl get events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl describe pod x         # events at the bottom
```

### Troubleshooting

- `kubectl logs` prints nothing: app writes to a file, or hasn't started.
- "container ... is waiting to start": see `describe pod`.
- CrashLoopBackOff: `kubectl logs --previous`.

### CKA exam tips

- Always know `-c`, `-f`, `--previous`.
- `kubectl logs` is the first step in application troubleshooting.

### Key takeaways

- Kubernetes collects stdout/stderr; use `kubectl logs`.
- For persistence use a logging stack; for a broken API Server use `crictl logs`.
