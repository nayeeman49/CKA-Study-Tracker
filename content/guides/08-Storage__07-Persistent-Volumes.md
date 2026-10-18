### Introduction

Defining storage in every Pod is not scalable. A **PersistentVolume (PV)** is a cluster-wide pool of storage created by an admin. Users claim from it using PVCs.

```
 Admin ─► PV (10Gi)       User ─► PVC (5Gi) ─► binds ─► Pod uses PVC
```

### PV definition

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-vol1
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /tmp/data         # lab only
```

Production: replace `hostPath` with `nfs`, `csi`, cloud disk, etc.

### Access modes

| Mode | Short | Meaning |
|---|---|---|
| ReadWriteOnce | RWO | One node read/write |
| ReadOnlyMany | ROX | Many nodes read-only |
| ReadWriteMany | RWX | Many nodes read/write |
| ReadWriteOncePod | RWOP | One Pod only |

### Reclaim policy

What happens to the PV after its claim is deleted:

| Policy | Result |
|---|---|
| `Retain` (default for manual PVs) | PV stays, `Released`, data kept, needs manual cleanup |
| `Delete` | PV and backing storage are deleted (default for dynamic) |
| `Recycle` | Deprecated |

### Phases

`Available` → `Bound` → `Released` → (`Failed`).

```bash
kubectl get pv
kubectl describe pv pv-vol1
```

PVs are cluster-scoped (no namespace).

### Key takeaways

- PV = the storage resource; capacity, access mode, reclaim policy.
