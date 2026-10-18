### Introduction

Kubernetes lets you run additional schedulers alongside the default one. A Pod chooses which scheduler to use with `schedulerName`. Useful for custom placement logic.

### Deploying a second scheduler

Option 1: run the binary with its own config:

```yaml
# my-scheduler-config.yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: my-scheduler
leaderElection:
  leaderElect: false
```

Option 2 (more common): run it as a Pod. Copy the default static Pod manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-scheduler
  namespace: kube-system
spec:
  containers:
  - name: kube-scheduler
    image: registry.k8s.io/kube-scheduler:v1.31.0
    command:
    - kube-scheduler
    - --config=/etc/kubernetes/my-scheduler-config.yaml
    volumeMounts:
    - name: config
      mountPath: /etc/kubernetes/my-scheduler-config.yaml
      readOnly: true
  volumes:
  - name: config
    hostPath:
      path: /etc/kubernetes/my-scheduler-config.yaml
```

### Leader election

With several control plane nodes, the default scheduler uses leader election so only one is active. For a custom one on the same lock, set `leaderElect: false` or use a different `resourceName`/`resourceNamespace`.

### Using it

```yaml
spec:
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx
```

If the named scheduler doesn't exist or isn't running, the Pod stays Pending.

### Verify

```bash
kubectl get events -o wide                  # SOURCE column shows my-scheduler
kubectl logs my-scheduler -n kube-system
```

### Troubleshooting

- Pod Pending with no events: that scheduler isn't running or `schedulerName` has a typo.
- Custom scheduler crashing: config path or RBAC (it needs the same permissions as the default scheduler).

### CKA exam tips

- Easiest approach is to copy `/etc/kubernetes/manifests/kube-scheduler.yaml`, rename, and change the config.
- `schedulerName` is in the **Pod** spec.

### Key takeaways

- Multiple schedulers coexist; Pods select with `schedulerName`.
