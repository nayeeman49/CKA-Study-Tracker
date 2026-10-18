@@ 06-Cluster-Maintenance/02-OS-Upgrades
### Introduction

Nodes need operating system patches, kernel upgrades and hardware maintenance. You must be able to take a node out of service without hurting the applications on it.

### What happens when a node goes down

- Pods on the node become unreachable.
- Pods managed by a ReplicaSet/Deployment are recreated elsewhere **after the eviction timeout (default 5 minutes)**, if the node does not come back.
- Pods **not** managed by a controller are lost.
- If the node returns within the timeout, the kubelet restarts its Pods.

For planned work, don't rely on the timeout. Drain the node.

### cordon, drain, uncordon

```
 cordon    mark node unschedulable (existing Pods stay)
 drain     cordon + evict all Pods (they're recreated elsewhere)
 uncordon  make schedulable again
```

```bash
kubectl drain node01 --ignore-daemonsets
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data --force
kubectl cordon node01
kubectl uncordon node01
kubectl get nodes        # STATUS: Ready,SchedulingDisabled
```

### Drain flags

| Flag | Why |
|---|---|
| `--ignore-daemonsets` | DaemonSet Pods can't be evicted; ignore them (required in practice) |
| `--delete-emptydir-data` | Allow evicting Pods using emptyDir (data lost) |
| `--force` | Evict Pods not managed by a controller (they are **deleted permanently**) |
| `--grace-period`, `--timeout` | Control termination wait |

A drain fails with "cannot delete Pods not managed by ReplicationController, ReplicaSet, Job, DaemonSet or StatefulSet" for bare Pods; `--force` deletes them for good.

### Typical workflow

```bash
kubectl drain node01 --ignore-daemonsets
# patch/reboot the node
ssh node01 'sudo apt update && sudo apt upgrade -y && sudo reboot'
kubectl uncordon node01
```

Pods that moved don't return automatically; they only move back if recreated or rescheduled.

### PodDisruptionBudgets

A PDB limits voluntary evictions so drains don't take down too many replicas at once:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: web
```

A drain waits (retries) if evicting would violate the PDB.

### Troubleshooting

- Drain hangs: a PDB, a Pod with a finalizer, or unreachable node.
- Pods Pending after drain: not enough capacity on remaining nodes.
- Node still `SchedulingDisabled` after maintenance: run `uncordon`.

### CKA exam tips

- `drain` already cordons the node; `uncordon` is needed afterwards.
- Bare Pods need `--force`, which deletes them.

### Key takeaways

- Drain for maintenance, uncordon when finished.

@@ 06-Cluster-Maintenance/03-Practice-Test-OS-Upgrades
### How to approach this lab

Tasks: see where Pods run, drain a node, deal with a bare Pod, uncordon.

### Commands

```bash
kubectl get nodes
kubectl get pods -o wide
kubectl drain node01 --ignore-daemonsets
kubectl get pods -o wide                 # moved Pods
kubectl uncordon node01
kubectl cordon node01
kubectl drain node01 --ignore-daemonsets --force     # for a bare pod (deleted forever)
```

### Notes

- A Pod not part of a ReplicaSet/Deployment (like `hr-app`) can't be rescheduled; the drain refuses until `--force`, and the Pod is lost.
- After `uncordon`, existing Pods do not move back automatically; new Pods can land there.
- `cordon` only blocks new scheduling.

@@ 06-Cluster-Maintenance/04-Kubernetes-Software-Versions
### Introduction

Before upgrading you need to understand how versions work and what is supported.

### Version numbers

```
  v1.31.2
   │  │  └─ patch  (bug fixes, security)
   │  └──── minor  (new features, ~every 4 months)
   └─────── major
```

Minor releases are roughly three per year. Kubernetes supports the latest **three** minor versions.

### Component versions

All control plane components are released together with the same version, but ETCD and CoreDNS have their own versions.

```bash
kubectl version
kubectl get nodes                # VERSION column is the kubelet version
kubeadm version
```

### Version skew policy

The API Server is the reference, newest of all components.

| Component | Allowed versions relative to kube-apiserver (X) |
|---|---|
| kube-controller-manager, kube-scheduler | X or X-1 |
| kubelet, kube-proxy | X, X-1 or X-2 (never newer) |
| kubectl | X+1, X, X-1 |
| Multiple API servers (HA) | Within one minor |

Example: API server 1.31 → controller manager 1.31 or 1.30; kubelets 1.31, 1.30, 1.29; kubectl 1.32, 1.31, 1.30.

### Upgrade rules

- Upgrade **one minor version at a time** (1.29 → 1.30 → 1.31). Skipping minor versions is not supported.
- Upgrade the control plane first, then worker nodes.
- Patch upgrades can skip patches (1.31.0 → 1.31.4).

### Key takeaways

- Never run a component newer than the API Server (except kubectl +1).
- Minor versions must be stepped through sequentially.

@@ 06-Cluster-Maintenance/05-Cluster-Upgrade-Introduction
### Introduction

You can upgrade a cluster in different ways depending on how it was built: managed service (a few clicks), kubeadm (commands), or manual ("the hard way").

### Strategies for workers

| Strategy | Description |
|---|---|
| All at once | Downtime; rarely used |
| Rolling, one node at a time | Standard. Drain, upgrade, uncordon |
| Blue/green (add new nodes) | Cloud friendly: add upgraded nodes, move workloads, remove old nodes |

### Order with kubeadm

```
 1. Upgrade control plane node(s)
        kubeadm  ──► kubeadm upgrade apply
        kubelet + kubectl
 2. Upgrade each worker node, one at a time
        drain ► kubeadm upgrade node ► kubelet ► uncordon
```

While the control plane is upgrading, workloads keep running; you just can't manage the cluster. Management functions (scaling, new Pods) are unavailable temporarily.

### Plan

```bash
kubeadm upgrade plan        # shows available versions and component changes
```

### Key takeaways

- Control plane first, then workers one at a time.
- kubeadm provides `upgrade plan` and `upgrade apply`.

@@ 06-Cluster-Maintenance/06-Practice-Test-Cluster-Upgrade-Process
### How to approach this lab

You upgrade a kubeadm cluster by one minor version: the control plane and one or more workers. Follow the same sequence each time.

### Control plane node

```bash
kubectl get nodes
kubeadm version
kubeadm upgrade plan

# install new kubeadm
apt-mark unhold kubeadm
apt-get update
apt-cache madison kubeadm | head
apt-get install -y kubeadm=1.31.2-1.1
apt-mark hold kubeadm

kubeadm upgrade apply v1.31.2

# drain the control plane (optional but advised)
kubectl drain controlplane --ignore-daemonsets

apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.2-1.1 kubectl=1.31.2-1.1
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
kubectl uncordon controlplane
```

### Worker node

```bash
kubectl drain node01 --ignore-daemonsets          # run on control plane
ssh node01
apt-mark unhold kubeadm ; apt-get update
apt-get install -y kubeadm=1.31.2-1.1
kubeadm upgrade node                              # NOT 'apply'
apt-get install -y kubelet=1.31.2-1.1 kubectl=1.31.2-1.1
systemctl daemon-reload ; systemctl restart kubelet
exit
kubectl uncordon node01
```

### Pointers

- Package names/versions differ by repo; use `apt-cache madison kubeadm`. Check the apt repository is configured for the target minor version (the repo path includes `v1.31`).
- Upgrade **kubeadm first**, then apply, then kubelet.
- The master uses `kubeadm upgrade apply`; workers use `kubeadm upgrade node`.
- Verify: `kubectl get nodes` shows the new VERSION once the kubelet restarts.

@@ 06-Cluster-Maintenance/07-Backup-and-Restore-Methods
### Introduction

Cluster state lives in ETCD and in the configuration you applied. Backups protect against ETCD loss, bad changes, and disasters.

### What to back up

| Item | How |
|---|---|
| Resource configuration | Keep YAML in Git; or `kubectl get all -A -o yaml > all.yaml` |
| **ETCD** | `etcdctl snapshot save` (preferred), or back up the data directory |
| Persistent volumes | Storage-level snapshots |
| Certificates | `/etc/kubernetes/pki` |

Declarative files (Git) are the best resource backup. Tools such as **Velero** back up objects and volumes.

### Query-based resource backup

```bash
kubectl get all --all-namespaces -o yaml > all-deploy-services.yaml
```

That misses many resource types (secrets, configmaps, CRDs, PVs); good only as a quick extra.

### ETCD backup choices

1. **Snapshot** with `etcdctl` (works for any ETCD).
2. Copy the **data directory** (`--data-dir`, usually `/var/lib/etcd`) while ETCD is stopped, or a filesystem snapshot.
3. Managed clusters: the provider manages ETCD, so use Velero or API-level backups.

### The restore idea

```
 etcdctl snapshot save  ──►  snapshot.db  ──►  etcdutl / etcdctl snapshot restore ──► new data dir
                                                            │
                                    point ETCD at the new data dir and restart
```

Details and exact commands are in the next lesson.

### Key takeaways

- ETCD snapshot + YAML in Git = a solid backup strategy.
- Test restores.

@@ 06-Cluster-Maintenance/08-Working-With-ETCDCTL
### Introduction

`etcdctl` is the tool for ETCD backup and restore. This is one of the most-tested practical topics in the CKA, so know the commands cold.

### Setup

```bash
export ETCDCTL_API=3
etcdctl version
```

Find connection details from the ETCD Pod manifest:

```bash
grep -E "listen-client|cert-file|key-file|trusted-ca|data-dir" /etc/kubernetes/manifests/etcd.yaml
```

Typical kubeadm values:

| Flag | Value |
|---|---|
| `--endpoints` | `https://127.0.0.1:2379` |
| `--cacert` | `/etc/kubernetes/pki/etcd/ca.crt` |
| `--cert` | `/etc/kubernetes/pki/etcd/server.crt` |
| `--key` | `/etc/kubernetes/pki/etcd/server.key` |
| data dir | `/var/lib/etcd` |

### Backup (snapshot save)

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /opt/snapshot-pre-boot.db

etcdctl snapshot status /opt/snapshot-pre-boot.db -w table    # etcdutl on newer versions
```

### Restore (snapshot restore)

Restore writes a **new data directory**; it does not need the certificates because it works on the file.

```bash
# stop API server? With a static Pod, editing the etcd manifest restarts etcd.
etcdutl snapshot restore /opt/snapshot-pre-boot.db --data-dir /var/lib/etcd-from-backup
# (older: ETCDCTL_API=3 etcdctl snapshot restore ... --data-dir ...)
```

Then point ETCD at the new directory by editing `/etc/kubernetes/manifests/etcd.yaml`:

```yaml
  volumes:
  - hostPath:
      path: /var/lib/etcd-from-backup      # was /var/lib/etcd
      type: DirectoryOrCreate
    name: etcd-data
```

Change **only the hostPath** of the `etcd-data` volume; the `--data-dir` flag and the mountPath can stay `/var/lib/etcd` inside the container. The kubelet recreates the etcd Pod. Wait for the API Server to come back (it can take a minute or two).

```bash
watch "crictl ps | grep etcd"
kubectl get pods -A
```

### After restoring

- Objects are exactly as in the snapshot; anything created later is gone.
- If the restore doesn't work: check `crictl logs` of etcd; check permissions and path.

### Important details

- With a **multi-member** or external ETCD, restore on each member with `--name`, `--initial-cluster`, `--initial-advertise-peer-urls` etc., and a fresh `--initial-cluster-token`.
- For external ETCD run as a service, edit the systemd unit's `--data-dir` and `systemctl daemon-reload && systemctl restart etcd`.
- Keep the snapshot off the node.

### Troubleshooting

- `Error: context deadline exceeded`: wrong endpoint or certs.
- `snapshot save` permission denied: run as root and target a writable path.
- API server won't start after restore: etcd path/permissions.

### CKA exam tips

- Always pass `--endpoints --cacert --cert --key` for save.
- Restore needs `--data-dir`; then change the hostPath in the manifest.
- Verify with `kubectl get pods -A` after the restore.

### Key takeaways

- save (with certs) → restore (to new dir) → update manifest.

@@ 06-Cluster-Maintenance/09-Practice-Test-Backup-and-Restore-Methods
### How to approach this lab

Part one is information gathering about ETCD, then a backup and restore on a stacked ETCD.

### Find facts

```bash
kubectl -n kube-system get pods | grep etcd
kubectl -n kube-system describe pod etcd-controlplane | grep -E "Image|data-dir|listen-client|cert|key|ca"
etcdctl version
```

### Take a snapshot

```bash
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /opt/snapshot-pre-boot.db
```

### Restore

```bash
etcdutl snapshot restore /opt/snapshot-pre-boot.db --data-dir /var/lib/etcd-from-backup
vi /etc/kubernetes/manifests/etcd.yaml      # etcd-data hostPath → /var/lib/etcd-from-backup
watch "crictl ps | grep etcd"
kubectl get deploy,svc
```

### Notes

- Objects created after the snapshot will disappear after a restore; that's how you know it worked.
- Wait for the API server to return; `kubectl` errors in the meantime are normal.

@@ 06-Cluster-Maintenance/10-Practice-Test-Backup-and-Restore-Methods-2
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
