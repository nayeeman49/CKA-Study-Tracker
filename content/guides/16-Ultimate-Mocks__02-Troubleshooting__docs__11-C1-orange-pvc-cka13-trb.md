### How to approach this lab

Scenario: a Pod using a PVC for "orange" fails.

### Diagnose

```bash
kubectl get pods,pvc,pv -A
kubectl describe pod <pod>              # "persistentvolumeclaim ... not found" or unbound
kubectl describe pvc <pvc>              # why not bound?
kubectl get pv,pvc -o wide              # compare capacity, access modes, storage class
```

### Typical causes

| Cause | Fix |
|---|---|
| `storageClassName` mismatch | recreate PVC with the PV's class (or `""`) |
| Request larger than PV capacity | PVC size ≤ PV size |
| Access mode mismatch | match `ReadWriteOnce` etc. |
| PVC in another namespace | create it in the Pod's namespace |
| Pod `claimName` typo | edit the Pod/Deployment |

PVCs are mostly immutable; delete and recreate. Pods must be recreated if `claimName` changes.

### Verify

`kubectl get pvc,pod` shows `Bound` and `Running`.

### Typical error messages

| Message | Meaning |
|---|---|
| `persistentvolumeclaim "orange-pvc" not found` | PVC missing/wrong name/namespace |
| `waiting for first consumer` | WaitForFirstConsumer; normal until a Pod uses it |
| `no persistent volumes available for this claim` | Size, class or mode mismatch |
| `Multi-Attach error` | RWO volume still attached to another node |
