### Introduction

A Deployment is the standard way to run stateless applications. It manages ReplicaSets, which manage Pods, and adds rolling updates, rollbacks, pausing, and scaling.

```
 Deployment
     │ creates/owns
     ▼
 ReplicaSet (current)       ReplicaSet (old, scaled to 0 after update)
     │
  ┌──┼──┐
  ▼  ▼  ▼
 Pod Pod Pod
```

Why not just ReplicaSets? When you change the image, a ReplicaSet does nothing to running Pods. A Deployment creates a *new* ReplicaSet and gradually moves Pods across, so there's no downtime and you can roll back.

### YAML

The same as a ReplicaSet but `kind: Deployment`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.26
```

### Create it quickly

```bash
kubectl create deployment web --image=nginx --replicas=3
kubectl create deployment web --image=nginx --dry-run=client -o yaml > deploy.yaml
```

### Inspect

```bash
kubectl get deploy
kubectl get all                            # deploy, rs, pods together
kubectl describe deployment web
kubectl get rs                             # name = <deploy>-<pod-template-hash>
kubectl rollout status deployment web
kubectl rollout history deployment web
```

### Update strategies (summary)

Deployments update with a **RollingUpdate** (default) or **Recreate** strategy. The full detail, `maxSurge`, `maxUnavailable`, and `rollout undo`, comes in the Application Lifecycle section, so here just the commands:

```bash
kubectl set image deployment/web nginx=nginx:1.27
kubectl rollout undo deployment/web
kubectl scale deployment web --replicas=5
```

### Scaling and autoscaling

```bash
kubectl scale deploy web --replicas=10
kubectl autoscale deploy web --min=2 --max=10 --cpu-percent=70    # HPA
```

### Naming

Pod names look like `web-6d4cf56db6-xk2tq`: Deployment name, then ReplicaSet hash, then a random suffix.

### Troubleshooting

- `READY 0/3`: look at the Pods (`describe pod`) for image or scheduling problems.
- `kubectl rollout status` hangs: new Pods are not becoming ready.
- Selector mismatch: Deployment's `selector` is immutable after creation.
- Deleting a Pod of a Deployment just makes a new one; delete the Deployment to remove everything.

### CKA exam tips

- `kubectl create deployment` is the fastest way; use `--dry-run=client -o yaml` and edit.
- `kubectl get all` shows the whole chain.
- Use `kubectl scale`, `set image`, `rollout undo` for quick edits.

### Key takeaways

- Deployment → ReplicaSet → Pods.
- Updates create a new ReplicaSet; the old one is kept for rollback.
- Always prefer Deployments to bare ReplicaSets or Pods.
