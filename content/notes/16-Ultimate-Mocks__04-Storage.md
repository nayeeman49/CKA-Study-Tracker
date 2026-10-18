## What this is
A storage scenario around PersistentVolumeClaims. Expect to create or repair a PV/PVC pair and mount it in a Pod or Deployment.

## Checklist
- PV: capacity, `accessModes`, `persistentVolumeReclaimPolicy`, `storageClassName`, backend (`hostPath`/CSI).
- PVC: same class and access mode, request ≤ PV capacity.
- Pod: `volumes[].persistentVolumeClaim.claimName` and a matching `volumeMounts[].mountPath`.
- Verify: `kubectl get pv,pvc` shows `Bound`; `kubectl exec` and write a file; recreate the Pod and confirm the data persists.

## Official documentation
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Configure a Pod to Use a PersistentVolume](https://kubernetes.io/docs/tasks/configure-pod-container/configure-persistent-volume-storage/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
