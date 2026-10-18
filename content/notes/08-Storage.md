## What this section is about
Persisting data beyond a container's life: volumes, PersistentVolumes (PV), PersistentVolumeClaims (PVC) and StorageClasses. Storage is 10% of the exam, usually one or two small tasks.

## Volumes
A volume is a directory available to the containers in a Pod. Common types: `emptyDir` (scratch space tied to the Pod's life), `hostPath` (a node path; fine for labs, risky in production), `configMap`/`secret`/`projected`, and PVC references. Declare under `spec.volumes` and mount with `volumeMounts[].mountPath`.

## PersistentVolumes and Claims
- A **PV** is cluster-level storage (admin provisioned or dynamic). A **PVC** is a namespaced request for storage. Kubernetes binds a PVC to a PV that satisfies its size, `accessModes` and `storageClassName`.
- **Access modes**: `ReadWriteOnce` (one node), `ReadOnlyMany`, `ReadWriteMany`, `ReadWriteOncePod` (one Pod).
- **Reclaim policy**: `Retain` (keep data, PV goes `Released`, must be cleaned manually), `Delete` (remove backing storage), `Recycle` (deprecated).
- PVC states: `Pending` until bound. A Pod referencing a PVC stays `Pending` until it binds.
```yaml
volumes:
- name: data
  persistentVolumeClaim:
    claimName: my-claim
```
You can **expand** a PVC if the StorageClass has `allowVolumeExpansion: true` (edit `spec.resources.requests.storage`). You cannot shrink. A PVC in use cannot be deleted immediately (protection finalizer).

## StorageClasses and dynamic provisioning
A StorageClass names a `provisioner` (CSI driver), `parameters`, `reclaimPolicy` and `volumeBindingMode`. `WaitForFirstConsumer` delays binding until a Pod is scheduled (important for topology-aware storage); `Immediate` binds right away. One class may be the default (annotation `storageclass.kubernetes.io/is-default-class: "true"`); PVCs without `storageClassName` use it, and `storageClassName: ""` means "no dynamic provisioning".

## CSI
The Container Storage Interface lets vendors ship drivers as Pods (controller + node plugin) without changing Kubernetes. You normally just reference the StorageClass.

## Exam tips
- A PVC stuck Pending: `describe pvc` events: class mismatch, size too big, access-mode mismatch, or `WaitForFirstConsumer` (no Pod yet).
- Static binding needs matching `storageClassName` (including empty string) on both PV and PVC.
- Check which node a `hostPath` PV lives on; the Pod must land there.

## Official documentation
- [Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [Configure a Pod to Use a PersistentVolume](https://kubernetes.io/docs/tasks/configure-pod-container/configure-persistent-volume-storage/)
- [Change the default StorageClass](https://kubernetes.io/docs/tasks/administer-cluster/change-default-storage-class/)
