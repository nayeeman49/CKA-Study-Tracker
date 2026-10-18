### Introduction

A ReplicaSet makes sure a specified number of identical Pods is running at all times. If a Pod dies, the ReplicaSet creates a replacement. If you have too many, it deletes extras. It provides **high availability** and **load sharing** by running several copies.

### Replication Controller vs ReplicaSet

The Replication Controller (`apiVersion: v1`, `kind: ReplicationController`) is the old technology. ReplicaSet (`apps/v1`) replaces it and adds one important feature: a `selector` with set-based matching. In practice you use Deployments, which create ReplicaSets for you.

### Anatomy

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web          # which Pods this RS owns
  template:             # the Pod blueprint
    metadata:
      labels:
        app: web        # MUST match the selector
    spec:
      containers:
      - name: nginx
        image: nginx
```

Three key parts: **replicas**, **selector**, **template**.

```
 ReplicaSet (replicas=3, selector app=web)
        │
   ┌────┼────┐
   ▼    ▼    ▼
 Pod  Pod  Pod      labels: app=web
```

`apiVersion: apps/v1` requires `selector`. If the template labels don't match the selector, the API Server rejects the object.

### Why labels matter

The ReplicaSet doesn't track Pods by name. It finds Pods by label selector. If a Pod with `app=web` already exists (even one you made manually), the ReplicaSet will count it. If you remove the label from a Pod, the RS no longer owns it and creates another.

### Commands

```bash
kubectl apply -f rs.yaml
kubectl get rs
kubectl describe rs web-rs
kubectl get pods
kubectl delete rs web-rs                # deletes Pods too
```

### Scaling

```bash
# 1. edit the file replicas, then
kubectl replace -f rs.yaml
# 2. imperative
kubectl scale rs web-rs --replicas=6
kubectl scale --replicas=6 -f rs.yaml
# 3. edit live
kubectl edit rs web-rs
```

### Self-healing demo

```bash
kubectl get pods
kubectl delete pod web-rs-xxxxx
kubectl get pods        # a new one already starting
```

### Fixing a broken ReplicaSet

If Pods use a bad image, editing the ReplicaSet does **not** change the existing Pods. Delete the Pods so the RS recreates them with the new template:

```bash
kubectl edit rs web-rs
kubectl delete pod -l app=web
```

(This is exactly why Deployments exist: they do this as a controlled rollout.)

### Troubleshooting

- `selector does not match template labels`: fix labels.
- Replicas not created: check `kubectl describe rs` Events; maybe a quota or admission error.
- Pods stay Pending: scheduling, not the ReplicaSet.

### CKA exam tips

- `kubectl explain rs.spec`.
- Create the YAML from a Deployment dry run and change `kind` if asked for a ReplicaSet.
- Scale shortcut: `kubectl scale rs NAME --replicas=N`.

### Key takeaways

- ReplicaSets maintain a replica count using a label selector and a Pod template.
- Template labels must match the selector.
- Editing the template affects only new Pods.
