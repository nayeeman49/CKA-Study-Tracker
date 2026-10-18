### How to approach this lab

Create a Pod with a hostPath volume, then a PV, a PVC, and use the claim.

### Commands

```bash
kubectl get pv,pvc
kubectl describe pvc claim-log-1
kubectl apply -f pv.yaml
kubectl apply -f pvc.yaml
kubectl get pvc          # STATUS Bound
kubectl delete pvc claim-log-1
kubectl get pv           # Released / Retain
```

### Notes

- A Pending PVC usually has a bigger request than the PV or a different access mode.
- Deleting a PVC used by a Pod: the PVC stays `Terminating` until the Pod is deleted.
- With `Retain`, the PV is `Released` and not reusable without cleanup.
- Remember `storageClassName` in both PV and PVC when set.

### Worked example

```yaml
apiVersion: v1
kind: PersistentVolume
metadata: {name: pv-log}
spec:
  capacity: {storage: 100Mi}
  accessModes: [ReadWriteMany]
  persistentVolumeReclaimPolicy: Retain
  hostPath: {path: /pv/log}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: claim-log-1}
spec:
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 50Mi}}
```

The claim above stays `Pending`: the PV offers `ReadWriteMany` only. Change the claim to `ReadWriteMany` (PVCs can't be edited, so delete and recreate) and it binds.

```bash
kubectl get pv,pvc
kubectl delete pvc claim-log-1          # PV becomes Released (Retain)
```

### Common mistakes

- Different `storageClassName` on PV and PVC.
- Requesting more storage than the PV offers.
