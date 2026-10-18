## What this section is about
Keeping a cluster healthy over time: draining nodes for OS maintenance, upgrading Kubernetes with kubeadm, and backing up and restoring etcd. These are high-value *Cluster Architecture* tasks; expect at least one upgrade or etcd question.

## Node maintenance
```
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data   # cordon + evict
# ... patch / reboot ...
kubectl uncordon node01
kubectl cordon node01      # just mark unschedulable
```
Drain evicts Pods (respecting PodDisruptionBudgets); Pods not managed by a controller block the drain unless you use `--force` (they are lost). If a node is down longer than `pod-eviction-timeout` (about 5 minutes) its Pods are recreated elsewhere.

## Versions and skew
Versions look like `v1.35.2` (major.minor.patch). Rules: the API server is the newest component; kubelet may be up to three minor versions behind (as of recent releases), `kubectl` one minor either side. **Upgrade one minor version at a time**, never skipping.

## Upgrading with kubeadm (control plane first, then workers)
On the control-plane node:
```
apt-mark unhold kubeadm && apt-get update && apt-get install -y kubeadm=1.35.x-*
kubeadm upgrade plan
kubeadm upgrade apply v1.35.x
kubectl drain controlplane --ignore-daemonsets
apt-get install -y kubelet=1.35.x-* kubectl=1.35.x-*
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon controlplane
```
On each worker: upgrade the `kubeadm` package, run `kubeadm upgrade node`, drain from the control plane, upgrade kubelet/kubectl, restart kubelet, uncordon. Always read the docs page for the exact package-repo commands; the repo path changes per minor version (`pkgs.k8s.io/core:/stable:/v1.xx`).

## Backup and restore of etcd
```
ETCDCTL_API=3 etcdctl snapshot save /opt/snap.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

etcdutl snapshot restore /opt/snap.db --data-dir /var/lib/etcd-restore
```
After restoring, edit `/etc/kubernetes/manifests/etcd.yaml` so the `etcd-data` hostPath volume points at the new data directory; the kubelet restarts etcd. Find the certificate paths with `kubectl -n kube-system describe pod etcd-<node>`. Also back up resource definitions (`kubectl get all -A -o yaml`) or use a tool such as Velero for application state.

## Exam tips
- Use the exact versions the question gives; `apt-cache madison kubeadm` lists what is available.
- Don't forget `uncordon` at the end; unschedulable nodes are a common lost-marks mistake.
- With an external (stacked vs external) etcd, the endpoint and cert paths differ. Read the etcd Pod's command line.

## Official documentation
- [Safely Drain a Node](https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/)
- [Upgrading kubeadm clusters](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/)
- [Operating etcd clusters (backup/restore)](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/)
- [Version Skew Policy](https://kubernetes.io/releases/version-skew-policy/)
