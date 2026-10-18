### Introduction

Manual PV creation does not scale. A **StorageClass (SC)** enables **dynamic provisioning**: when a PVC requests the class, the provisioner creates the storage and PV automatically.

```
 PVC (storageClassName: fast) ─► StorageClass fast ─► provisioner ─► disk + PV created ─► bound
```

### Definition

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: google-storage
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: none
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

### Fields

| Field | Meaning |
|---|---|
| `provisioner` | Driver that creates volumes (CSI driver name) |
| `parameters` | Provisioner-specific settings (type, IOPS) |
| `reclaimPolicy` | `Delete` (default) or `Retain` for created PVs |
| `volumeBindingMode` | `Immediate` or `WaitForFirstConsumer` (wait for a Pod to be scheduled) |
| `allowVolumeExpansion` | Allow resizing PVCs |

### PVC using the class

```yaml
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: google-storage
  resources:
    requests:
      storage: 500Mi
```

### Default class

```bash
kubectl get sc                           # (default) marker
kubectl patch sc standard -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

A PVC without `storageClassName` uses the default class; `storageClassName: ""` means no class (static binding only).

### Local storage

`provisioner: kubernetes.io/no-provisioner` plus `WaitForFirstConsumer` for local PVs, where you create PVs yourself.

### Key takeaways

- StorageClass = automatic PV creation with chosen parameters.
