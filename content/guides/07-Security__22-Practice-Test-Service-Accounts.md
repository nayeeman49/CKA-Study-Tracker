### How to approach this lab

Create an SA, give a Pod that SA, and check its permissions.

### Commands

```bash
kubectl get sa
kubectl describe sa default
kubectl create serviceaccount dashboard-sa
kubectl create token dashboard-sa
kubectl get pod web-dashboard -o yaml > d.yaml
vi d.yaml            # add spec.serviceAccountName: dashboard-sa
kubectl replace --force -f d.yaml
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding read-pods --role=pod-reader --serviceaccount=default:dashboard-sa
kubectl auth can-i list pods --as system:serviceaccount:default:dashboard-sa
```

### Notes

- In a Deployment edit `spec.template.spec.serviceAccountName`; the Pods roll.
- `kubectl describe pod` shows `Service Account:` and the token mount.

### Worked example

```bash
kubectl create serviceaccount dashboard-sa
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding dashboard-sa-binding --role=pod-reader --serviceaccount=default:dashboard-sa
kubectl set serviceaccount deploy/web-dashboard dashboard-sa
kubectl create token dashboard-sa --duration=24h
kubectl auth can-i list pods --as system:serviceaccount:default:dashboard-sa
```

### Common mistakes

- Using `--user` instead of `--serviceaccount namespace:name`.
- Editing a bare Pod's `serviceAccountName` (immutable; recreate it).
