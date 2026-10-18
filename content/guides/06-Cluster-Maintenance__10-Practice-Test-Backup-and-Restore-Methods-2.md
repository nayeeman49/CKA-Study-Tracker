### How to approach this lab

This lab uses multiple clusters and an **external ETCD** server. You need to work out which cluster you are on and how ETCD is hosted.

### Orientation

```bash
kubectl config get-contexts
kubectl config use-context cluster1
kubectl get nodes
kubectl -n kube-system get pods | grep etcd           # none => external
kubectl -n kube-system describe pod kube-apiserver-* | grep etcd-servers
ssh etcd-server
ps -ef | grep etcd                                    # find the flags and data dir
systemctl status etcd
```

### Restoring an external ETCD

```bash
ssh etcd-server
ETCDCTL_API=3 etcdctl snapshot restore /root/cluster2.db --data-dir /var/lib/etcd-data-new
chown -R etcd:etcd /var/lib/etcd-data-new
vi /etc/systemd/system/etcd.service        # --data-dir=/var/lib/etcd-data-new
systemctl daemon-reload
systemctl restart etcd
systemctl restart kube-apiserver kube-controller-manager kube-scheduler   # if running as services
```

On a kubeadm control plane, restart the control plane Pods by touching their manifests (move out and back) or restarting the kubelet.

### Notes

- Use the right kubectl context before running commands.
- Ownership of the new data dir matters for the `etcd` user.
- Validate: `etcdctl member list` and check the objects from the backup exist.
