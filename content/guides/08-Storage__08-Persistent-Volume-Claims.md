### Introduction

A **PersistentVolumeClaim (PVC)** is a user's request for storage. Kubernetes binds each PVC to a suitable PV.

### PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myclaim
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
  storageClassName: manual
```

### Binding rules

The controller finds a PV where:

- `capacity` >= requested size
- access modes include the requested one
- `storageClassName` matches
- selectors/labels match if specified (`selector.matchLabels`)

Binding is **one to one**. A 1Gi PV bound by a 500Mi claim wastes the rest. If no PV matches, the PVC stays `Pending` (unless dynamic provisioning applies).

```bash
kubectl get pvc
kubectl get pv
kubectl describe pvc myclaim
```

### Deleting a PVC

Depends on the PV's reclaim policy (Retain/Delete). PVCs in use by a Pod are protected (`kubernetes.io/pvc-protection`) until the Pod is gone.

### Troubleshooting a Pending PVC

- Size too large for any PV.
- Access mode mismatch.
- `storageClassName` mismatch (even empty vs set).
- No PV available, and no default StorageClass.

### Key takeaways

- PVC requests, PV supplies; match on size, access mode, class.
