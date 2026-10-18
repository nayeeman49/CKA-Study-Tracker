### Introduction

`nodeSelector` is the simplest way to say "run this Pod on nodes with this label". It is a plain key/value match.

### Steps

1. Label the node.
2. Add `nodeSelector` to the Pod.

```bash
kubectl label nodes node01 size=Large
kubectl get nodes --show-labels
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  containers:
  - name: processor
    image: busybox
    command: ["sleep","3600"]
  nodeSelector:
    size: Large
```

The scheduler only considers nodes with `size=Large`. If none match, the Pod stays Pending (`didn't match Pod's node affinity/selector`).

### Limits

- Only exact matches, only AND of several labels.
- No `OR`, `NOT`, `In`, or "prefer". For these use **Node Affinity** (next lesson).

### Built-in node labels

Nodes already carry labels such as `kubernetes.io/hostname`, `kubernetes.io/os`, `kubernetes.io/arch`, `topology.kubernetes.io/zone`, `node-role.kubernetes.io/control-plane`.

### CKA exam tips

- If a node is not labelled, the Pod won't schedule; label first.
- `nodeSelector` is in the Pod spec, same level as containers.

### Key takeaways

- Label the node, add `nodeSelector`; simple but inflexible.
