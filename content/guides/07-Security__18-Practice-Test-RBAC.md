### How to approach this lab

Inspect existing RBAC, then grant or fix a user's permissions.

### Commands

```bash
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep authorization
kubectl get roles
kubectl get rolebindings -A
kubectl describe role kube-proxy -n kube-system
kubectl describe rolebinding kube-proxy -n kube-system
kubectl get pods --as dev-user
kubectl create role developer --namespace=default --verb=list,create,delete --resource=pods
kubectl create rolebinding dev-user-binding --namespace=default --role=developer --user=dev-user
kubectl edit role developer -n blue        # add resources/apiGroups
kubectl auth can-i create deployments --as dev-user -n blue
```

### Notes

- When a user can't create Deployments, add the `apps` group in a rule.
- `resourceNames` limits to named Pods.
- Always test with `--as`.

### Worked example

User `dev-user` must create, list and delete Pods in `default`, and manage Deployments:

```bash
kubectl create role developer --verb=create,list,delete --resource=pods
kubectl create rolebinding dev-user-binding --role=developer --user=dev-user
kubectl auth can-i delete pods --as dev-user
kubectl auth can-i create deployments --as dev-user       # no
kubectl edit role developer       # add apiGroups: ["apps"], resources: ["deployments"]
```

Inspect an existing grant:

```bash
kubectl describe rolebinding kube-proxy -n kube-system
kubectl describe role kube-proxy -n kube-system
```

### Common mistakes

- Role created in the wrong namespace.
- Missing `apps` group for Deployments.
- Using `--user=dev-user` on a role instead of a binding.
