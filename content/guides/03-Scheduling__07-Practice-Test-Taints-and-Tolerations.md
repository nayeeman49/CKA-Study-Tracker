### How to approach this lab

Tasks: check taints, add a taint, create a Pod that tolerates it, remove a taint.

### Commands

```bash
kubectl get nodes
kubectl describe node node01 | grep -i taint
kubectl taint nodes node01 spray=mortein:NoSchedule
kubectl run mosquito --image=nginx            # will be Pending: no toleration
kubectl run bee --image=nginx --dry-run=client -o yaml > bee.yaml
# add tolerations under spec:
#   tolerations:
#   - key: spray
#     value: mortein
#     effect: NoSchedule
#     operator: Equal
kubectl apply -f bee.yaml
kubectl get pods -o wide
kubectl taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-
```

### Understanding results

- A Pod without the toleration stays `Pending` and `describe` says `1 node(s) had untolerated taint`.
- The tolerant Pod can land on the tainted node; not guaranteed unless it's the only option.
- Removing the control-plane taint lets a Pending Pod schedule there.

### Tip

Check `kubectl get pods -o wide` to see which node each Pod uses.
