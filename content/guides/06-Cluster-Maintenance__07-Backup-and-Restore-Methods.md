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
