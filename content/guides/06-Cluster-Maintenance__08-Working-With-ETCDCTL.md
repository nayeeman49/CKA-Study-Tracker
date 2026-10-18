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
