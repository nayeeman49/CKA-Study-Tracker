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

### Worked example

```bash
kubectl -n kube-system describe pod etcd-controlplane | grep -E "Image:|--data-dir|--listen-client|--cert-file|--key-file|--trusted-ca"
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/snapshot-pre-boot.db
etcdutl snapshot restore /opt/snapshot-pre-boot.db --data-dir /var/lib/etcd-from-backup
vi /etc/kubernetes/manifests/etcd.yaml      # hostPath of etcd-data -> /var/lib/etcd-from-backup
```

Wait for etcd and the API server to restart (`watch crictl ps`), then check that the objects from the snapshot exist and later ones are gone.

### Common mistakes

- Changing `--data-dir` and mountPath as well (only the hostPath changes in the standard solution).
- Running restore with the certificate flags (not needed) or forgetting `--data-dir`.
- Reading from the API before it has recovered.
