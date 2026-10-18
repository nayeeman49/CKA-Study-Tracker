@@ 06-Cluster-Maintenance/02-OS-Upgrades
### What it is
When a node must be patched or rebooted, move its workloads off first. If a node is unreachable for more than the eviction timeout (about 5 minutes), the controller manager treats its Pods as lost and recreates those that belong to a controller elsewhere. Pods not owned by a controller are gone for good.

### How to do it
```
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data   # cordon + evict
# patch / reboot node01
kubectl uncordon node01                                           # allow scheduling again
kubectl cordon node01                                             # mark unschedulable only
```
### Verify
`kubectl get nodes` shows `SchedulingDisabled` while cordoned; `kubectl get pods -o wide` shows Pods moved off the node.

### Watch out
Drain refuses to evict Pods with no controller; add `--force` only if you accept losing them. DaemonSet Pods need `--ignore-daemonsets`. After a reboot, Pods that moved do **not** come back by themselves; uncordon only allows new ones. PodDisruptionBudgets can block eviction.

@@ 06-Cluster-Maintenance/03-Practice-Test-OS-Upgrades
### How to work through this lab
1. **Which nodes run which apps:** `kubectl get pods -o wide`.
2. **Drain node01 for maintenance:** `kubectl drain node01 --ignore-daemonsets`. If it errors on a bare Pod, either recreate it as a Deployment or use `--force` when allowed.
3. **After maintenance:** `kubectl uncordon node01`.
4. **Cordon only:** `kubectl cordon node01` leaves Pods running but blocks new ones. If a Pod isn't managed by a ReplicaSet, deleting it loses it.
5. **Verify:** `kubectl get nodes` (no `SchedulingDisabled`), `kubectl get pods -o wide`.

@@ 06-Cluster-Maintenance/04-Kubernetes-Software-Versions
### What to know
Releases are `vMAJOR.MINOR.PATCH` (e.g. v1.35.1). A new minor roughly every four months; the project supports the three latest minors. Core components (apiserver, controller-manager, scheduler, kubelet, kube-proxy, kubectl) share the version; etcd and CoreDNS have their own.

### Version skew rules (relative to kube-apiserver)
- kube-controller-manager, kube-scheduler: same version or **one** minor older.
- kubelet, kube-proxy: not newer; up to **three** minors older (supported releases).
- kubectl: one minor newer or older.
So the API server is upgraded first and is never older than anything else.

### Find versions
```
kubectl version
kubectl get nodes                         # kubelet version per node
kubeadm version
kubectl -n kube-system get pods -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | sort -u
```
### Watch out
Never skip minor versions when upgrading (1.33 → 1.34 → 1.35).

@@ 06-Cluster-Maintenance/05-Cluster-Upgrade-Introduction
### Strategy
Upgrade **one minor version at a time**: control plane first, then workers. Workloads keep running during a control-plane upgrade because kubelets and Pods are independent of it; you just can't change the cluster meanwhile. Workers can be upgraded all at once (downtime), rolling one at a time (usual), or by adding new upgraded nodes and removing old ones.

### How to do it with kubeadm
1. Check versions: `kubeadm upgrade plan` (on the control plane).
2. Upgrade the **kubeadm** package on the control plane to the target version.
3. `kubeadm upgrade apply v1.xx.y`.
4. Drain, upgrade `kubelet` and `kubectl`, restart kubelet, uncordon.
5. Repeat on each worker: upgrade kubeadm → `kubeadm upgrade node` → drain (from control plane) → upgrade kubelet → restart → uncordon.
The practice lab gives the exact commands; the docs page "Upgrading kubeadm clusters" is allowed in the exam.

### Watch out
The package repo path is per minor (`pkgs.k8s.io/core:/stable:/v1.35/deb`); update your apt source before `apt-cache madison kubeadm`.

@@ 06-Cluster-Maintenance/06-Practice-Test-Cluster-Upgrade-Process
### How to work through this lab
**Control plane**
```
kubeadm upgrade plan
apt-mark unhold kubeadm && apt-get update && apt-get install -y kubeadm=1.xx.y-1.1 && apt-mark hold kubeadm
kubeadm upgrade apply v1.xx.y
kubectl drain controlplane --ignore-daemonsets
apt-get install -y kubelet=1.xx.y-1.1 kubectl=1.xx.y-1.1
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon controlplane
```
**Worker (run on the node, drain from controlplane)**
```
kubectl drain node01 --ignore-daemonsets          # on controlplane
ssh node01
apt-get install -y kubeadm=1.xx.y-1.1
kubeadm upgrade node
apt-get install -y kubelet=1.xx.y-1.1 && systemctl restart kubelet
exit ; kubectl uncordon node01
```
### Verify
`kubectl get nodes` shows the new version on each node.

### Tip
If the lab has pinned packages, change the apt repo to the target minor first; follow the docs commands exactly.

@@ 06-Cluster-Maintenance/07-Backup-and-Restore-Methods
### What to back up
1. **Resource configuration:** keep manifests in Git (the best way); export from a live cluster with `kubectl get all -A -o yaml > all.yaml` (misses CRDs and some types) or use Velero.
2. **etcd:** the authoritative state: snapshot it.
3. **Persistent volumes** with your storage provider's tooling.

### How to do it
```
ETCDCTL_API=3 etcdctl snapshot save /opt/snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
ETCDCTL_API=3 etcdctl snapshot status /opt/snapshot.db --write-out=table
```
### Restore (next lessons)
Stop the API server (static pod will do), `etcdutl snapshot restore ... --data-dir`, point the etcd manifest at the new data dir.

### Watch out
Managed clusters (EKS/GKE/AKS) hide etcd: back up resources/volumes instead.

@@ 06-Cluster-Maintenance/08-Working-With-ETCDCTL
### Why this lesson
Know exactly how to call `etcdctl`. In a kubeadm cluster etcd needs TLS, so every command needs four options.

### Reference
```
export ETCDCTL_API=3
etcdctl version
etcdctl snapshot save|status|restore ...
etcdctl member list --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
```
Get the values from the manifest: `grep -E 'cert-file|key-file|trusted-ca-file|listen-client-urls|data-dir' /etc/kubernetes/manifests/etcd.yaml`, or `kubectl -n kube-system describe pod etcd-controlplane`.

### Tools
`etcdctl` is the client; since 3.5 offline snapshot restore moved to **`etcdutl snapshot restore`** (older `etcdctl snapshot restore` still works with warnings). If `etcdctl` isn't installed: `apt install etcd-client`, or exec into the etcd pod.

### Watch out
Forgetting `ETCDCTL_API=3` on old versions gives v2 commands. Wrong endpoint scheme (http vs https) or certificate paths cause "context deadline exceeded".

@@ 06-Cluster-Maintenance/09-Practice-Test-Backup-and-Restore-Methods
### How to work through this lab
1. **Find etcd info:** `kubectl -n kube-system describe pod etcd-controlplane` (version in the image tag, endpoint `--listen-client-urls`, cert and key paths, `--data-dir`).
2. **Take a snapshot:**
```
ETCDCTL_API=3 etcdctl snapshot save /opt/snapshot-pre-boot.db --endpoints=https://127.0.0.1:2379 \
 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
```
3. **Restore it** (cluster state was changed after the snapshot):
```
etcdutl snapshot restore /opt/snapshot-pre-boot.db --data-dir /var/lib/etcd-from-backup
```
4. **Edit `/etc/kubernetes/manifests/etcd.yaml`:** change the `etcd-data` hostPath `path:` to `/var/lib/etcd-from-backup`. The kubelet recreates etcd (wait a minute or two).
5. **Verify:** `kubectl get pods,deploy,svc` shows the older state.

### Watch out
Don't change `--data-dir` in the container args; only the **hostPath volume**. If the etcd pod doesn't return, `crictl ps -a` and `crictl logs`.

@@ 06-Cluster-Maintenance/10-Practice-Test-Backup-and-Restore-Methods-2
### How to work through this lab
Scenario: a cluster uses an **external etcd** (not a static Pod) and you must restore it.
1. **Check the API server's etcd:** `kubectl -n kube-system describe pod kube-apiserver-... | grep etcd` shows `--etcd-servers=https://<ip>:2379`: if the IP isn't localhost, etcd is external.
2. **SSH to the etcd server** (`ssh etcd-server`) and look at `ps -ef | grep etcd` for `--data-dir`, `--cert-file`, `--key-file`, `--trusted-ca-file`; it runs as a **systemd service**.
3. **Restore:** `ETCDCTL_API=3 etcdctl snapshot restore /root/cluster2.db --data-dir /var/lib/etcd-data-new`.
4. Edit `/etc/systemd/system/etcd.service` (or the unit file): change `--data-dir`; `chown -R etcd:etcd /var/lib/etcd-data-new`.
5. `systemctl daemon-reload && systemctl restart etcd` (also restart `kube-apiserver`/controller-manager/scheduler/kubelet if needed).
6. **Verify:** `ETCDCTL_API=3 etcdctl member list ...` and `kubectl get pods` on the right cluster (`kubectl config use-context cluster2`).

### Watch out
Make sure you are on the right context/host for each step; restore wrong data-dir ownership and etcd won't start.
