### How to approach this lab

A mixed bag covering upgrades, storage, Pods, Deployments, networking, and backup.

### Typical tasks and how to do them

1. **Upgrade the cluster**: control plane first (`kubeadm upgrade apply`), then nodes (`kubeadm upgrade node`), kubelet restart. See the Cluster Upgrade lab.
2. **Print the list of nodes/PVs to a file** with `jsonpath` or `custom-columns`.
3. **Create a Pod with two containers sharing an `emptyDir`**.
4. **Deployment with a rolling update, change the image, then roll back**: `kubectl set image`, `kubectl rollout undo`.
5. **ETCD backup**: `etcdctl snapshot save` with certificates; restore.
6. **Pod with resource requests/limits, PVC with PV, a Service**.
7. **NetworkPolicy or RBAC** task.

### Approach per task

```bash
kubectl run x --image=nginx $do > x.yaml
vi x.yaml
kubectl apply -f x.yaml
kubectl get/describe        # verify
```

### Review

Rebuild what you struggled with from the docs, with a timer.

### Worked snippets

```bash
# rolling update + rollback
kubectl create deploy web --image=nginx:1.26 --replicas=3
kubectl set image deploy/web nginx=nginx:1.27
kubectl rollout undo deploy/web
# pod with command and emptyDir shared by two containers
kubectl run multi --image=busybox --dry-run=client -o yaml --command -- sleep 3600 > multi.yaml
# etcd snapshot
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=... --cert=... --key=... snapshot save /opt/backup.db
```

Verify each answer with `kubectl get` and `kubectl describe` before moving on.
