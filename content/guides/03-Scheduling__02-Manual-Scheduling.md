### Introduction

Normally the scheduler picks a node for every Pod. Sometimes you need to place a Pod yourself, for example when the scheduler is broken, or when you want a Pod on one specific node. Manual scheduling means setting the node yourself.

### How the scheduler marks a Pod

Every Pod has a field `spec.nodeName`. When it's empty, the Pod is unscheduled and the scheduler picks it up. The scheduler's only job is to fill that field by creating a **Binding** object.

```
 Pod (nodeName empty) ──► scheduler ──► Binding ──► nodeName = node01
```

### Option 1: set nodeName at creation

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  nodeName: node01        # skip the scheduler
  containers:
  - name: nginx
    image: nginx
```

This is only possible **at creation time**. Once a Pod exists, `nodeName` cannot be changed, and the Pod will be Pending forever if no scheduler is running and `nodeName` is empty.

### Option 2: Binding object (for an existing Pending Pod)

Send a POST to the Pod's binding sub-resource:

```yaml
apiVersion: v1
kind: Binding
metadata:
  name: nginx
target:
  apiVersion: v1
  kind: Node
  name: node02
```

```bash
curl --header "Content-Type: application/json" --request POST \
  --data '{"apiVersion":"v1","kind":"Binding","metadata":{"name":"nginx"},"target":{"apiVersion":"v1","kind":"Node","name":"node02"}}' \
  http://$SERVER/api/v1/namespaces/default/pods/nginx/binding/
```

### Option 3: recreate the Pod

The exam-friendly method: export the Pod, add `nodeName`, force replace.

```bash
kubectl get pod nginx -o yaml > pod.yaml
vi pod.yaml                         # add spec.nodeName
kubectl replace --force -f pod.yaml
```

### What manual scheduling skips

Setting `nodeName` bypasses **all** scheduler logic: taints, affinity, resource checks. If the node is full or tainted, the kubelet may reject or evict the Pod. Control-plane nodes can be targeted this way even when tainted.

### Troubleshooting

- Pod stays `Pending` and `describe` shows no events: the scheduler isn't running. Either fix it or set `nodeName`.
- Wrong node name (typo): Pod sits Pending / fails to start. Names must match `kubectl get nodes`.

### CKA exam tips

- If asked to run a Pod when the scheduler is down, use `nodeName`.
- `kubectl replace --force` deletes and recreates in one step.

### Key takeaways

- The scheduler sets `nodeName`; you can do it yourself.
- `nodeName` can only be set when creating the Pod (or via Binding).
