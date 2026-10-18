### How to approach this lab

Inspect classes and create a PVC and Pod that use a local StorageClass with delayed binding.

### Commands

```bash
kubectl get sc
kubectl describe sc local-storage
kubectl get pvc
kubectl describe pvc local-pvc          # Pending: waiting for first consumer
kubectl apply -f pod.yaml               # PVC binds once the Pod is scheduled
kubectl get pv
```

### Notes

- `WaitForFirstConsumer` keeps the PVC `Pending` until a Pod uses it; that is expected.
- `no-provisioner` means PVs are created by hand.
- Check the provisioner column and reclaim policy.

### Worked example

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {name: delayed-volume-sc}
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

```bash
kubectl get pvc local-pvc          # Pending (waiting for first consumer) - normal
kubectl apply -f nginx-pod.yaml    # uses the PVC
kubectl get pvc,pv                 # Bound once the Pod is scheduled
```

### Common mistakes

- Treating a `WaitForFirstConsumer` Pending PVC as an error.
- Forgetting that `no-provisioner` needs a PV created by hand.
