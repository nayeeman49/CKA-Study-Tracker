### How to approach this lab

Create storage resources to specification ("olive").

### Steps

1. Read names, sizes, access modes, storage class and namespace carefully.
2. Create the PV if needed (hostPath or local), then the PVC.
3. Mount the PVC in the Pod/Deployment.
4. Verify.

```bash
kubectl get pv,pvc
kubectl exec <pod> -- sh -c 'echo test > /mnt/data/t; cat /mnt/data/t'
```

### Watch out

- Requests must fit the PV.
- `storageClassName: ""` for static binding when a default class exists.
- Pod and PVC share a namespace.
- Retain vs Delete as requested.

### Example manifests

```yaml
apiVersion: v1
kind: PersistentVolume
metadata: {name: olive-pv}
spec:
  capacity: {storage: 1Gi}
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  hostPath: {path: /mnt/olive}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: olive-pvc}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  resources: {requests: {storage: 500Mi}}
```
