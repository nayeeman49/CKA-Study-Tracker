### How to approach this lab

Create a ClusterRole for nodes or storage and bind it to a user, then test.

### Commands

```bash
kubectl get clusterroles --no-headers | wc -l
kubectl get clusterrolebindings --no-headers | wc -l
kubectl describe clusterrolebinding cluster-admin
kubectl create clusterrole nodeadmin --verb=get,watch,list,create,delete --resource=nodes
kubectl create clusterrolebinding michelle-binding --clusterrole=nodeadmin --user=michelle
kubectl auth can-i list nodes --as michelle
kubectl create clusterrole storage-admin --resource=persistentvolumes,storageclasses --verb=get,watch,list,create,delete
kubectl create clusterrolebinding michelle-storage-admin --user=michelle --clusterrole=storage-admin
```

### Note

`storageclasses` live in the `storage.k8s.io` group; `kubectl create clusterrole` picks the group automatically from the resource name.

### Worked example

```bash
kubectl create clusterrole nodeadmin --verb=get,watch,list,create,delete --resource=nodes
kubectl create clusterrolebinding michelle-binding --clusterrole=nodeadmin --user=michelle
kubectl auth can-i list nodes --as michelle           # yes
kubectl auth can-i delete pods --as michelle          # no
```

Add storage rights later:

```bash
kubectl create clusterrole storage-admin --resource=persistentvolumes,storageclasses --verb=get,watch,list,create,delete
kubectl create clusterrolebinding michelle-storage-admin --user=michelle --clusterrole=storage-admin
```

### Common mistakes

- Using Role/RoleBinding for nodes or PVs (cluster scoped).
- Forgetting the binding after creating the role.
