### Introduction

In Kubernetes, ETCD is the single source of truth. Every object you create, from a Pod to a Secret, is stored in ETCD by the API Server, and nothing else talks to ETCD directly. This page shows what is stored, how ETCD is deployed in the two common styles, how to connect to it with the right certificates, and how to check its health. Backup and restore get their own lessons later; here the focus is understanding and inspecting it.

### What Kubernetes stores in ETCD

Every cluster object: nodes, Pods, ConfigMaps, Secrets, accounts, roles, bindings, Deployments and more. When you run `kubectl get`, the API Server reads from ETCD (usually through its cache). When you `kubectl apply`, the API Server writes to ETCD. A change is only "real" once it is committed in ETCD.

```
kubectl ──► kube-apiserver ──► etcd
                 ▲
 scheduler, controller manager, kubelet
 (all go through the API Server, never to etcd)
```

Only the **kube-apiserver** is an ETCD client. That is why the API Server flag `--etcd-servers` is so important.

### Two ways ETCD is deployed

#### 1. Stacked ETCD (kubeadm default)

ETCD runs as a **static Pod** on each control plane node, in the `kube-system` namespace.

```
control plane node
┌────────────────────────────────┐
│ kube-apiserver                 │
│ kube-scheduler                 │
│ kube-controller-manager        │
│ etcd  (static Pod)             │
└────────────────────────────────┘
```

```bash
kubectl get pods -n kube-system | grep etcd
# etcd-controlplane   1/1   Running
cat /etc/kubernetes/manifests/etcd.yaml
```

#### 2. External ETCD

ETCD runs on its own servers outside the cluster. The API Server points to it by URL.

```
┌──────────────┐        ┌────────────────────┐
│ control plane│──────► │ etcd-1 etcd-2 etcd-3│
└──────────────┘ https  └────────────────────┘
```

Here ETCD is usually a systemd service, not a Pod.

```bash
systemctl status etcd
cat /etc/systemd/system/etcd.service
```

### How to tell which type you have

```bash
# Look at the API server for the etcd URL
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep etcd-servers
#  --etcd-servers=https://127.0.0.1:2379      -> stacked (local)
#  --etcd-servers=https://10.0.0.11:2379,...   -> external
```

Or check whether a static Pod manifest for etcd exists: `ls /etc/kubernetes/manifests`.

### Important ETCD options

Read the `etcd.yaml` manifest or service file. Key arguments:

| Option | Meaning |
|---|---|
| `--data-dir` | Where the database lives (default `/var/lib/etcd`) |
| `--listen-client-urls` | Where it accepts client connections (2379) |
| `--advertise-client-urls` | URL clients are told to use |
| `--listen-peer-urls` | Member-to-member traffic (2380) |
| `--initial-cluster` | List of members when bootstrapping |
| `--cert-file`, `--key-file` | ETCD's server certificate and key |
| `--trusted-ca-file` | CA that signed client certificates |
| `--peer-*` | Same, for peer communication |
| `--client-cert-auth=true` | Require client certificates |

You need `--data-dir` and the certificate paths for backup and restore.

### Connecting with etcdctl in a kubeadm cluster

Because ETCD requires client certificates, `etcdctl` needs them too. kubeadm places them in `/etc/kubernetes/pki/etcd/`.

```bash
export ETCDCTL_API=3

etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  member list
```

Where to find the correct paths if you forget:

```bash
kubectl -n kube-system describe pod etcd-controlplane | grep -E "cert|key|ca|listen"
# or
grep -E "cert-file|key-file|trusted-ca" /etc/kubernetes/manifests/etcd.yaml
```

To avoid typing flags each time you can export environment variables:

```bash
export ETCDCTL_ENDPOINTS=https://127.0.0.1:2379
export ETCDCTL_CACERT=/etc/kubernetes/pki/etcd/ca.crt
export ETCDCTL_CERT=/etc/kubernetes/pki/etcd/server.crt
export ETCDCTL_KEY=/etc/kubernetes/pki/etcd/server.key
```

### Useful inspection commands

```bash
etcdctl member list -w table              # members and their IDs
etcdctl endpoint health -w table          # is each member healthy?
etcdctl endpoint status -w table          # leader, DB size, raft index
etcdctl get / --prefix --keys-only | head # keys stored
```

### How objects are laid out in ETCD

Kubernetes stores everything under the `/registry` prefix.

```bash
etcdctl get /registry --prefix --keys-only
# /registry/pods/default/nginx
# /registry/deployments/default/web
# /registry/secrets/kube-system/...
# /registry/namespaces/default
```

Values are stored in a binary (protobuf) format, so `etcdctl get` output looks garbled. Secrets are **not encrypted at rest by default**, which is why access to ETCD must be restricted. Encryption at rest is a security topic covered later.

### What happens if ETCD is unhealthy

- API Server logs show timeouts or "etcdserver: ..." errors.
- `kubectl` commands hang or fail.
- Running Pods keep running (the kubelet works from local state), but you cannot change anything.

### Troubleshooting

- **kube-apiserver crashlooping with etcd errors**: check the `--etcd-servers` URL and the certificate paths in `/etc/kubernetes/manifests/kube-apiserver.yaml`.
- **etcd Pod not starting**: inspect `crictl ps -a | grep etcd`, `crictl logs <id>`, and verify `--data-dir` exists and has the right permissions.
- **`etcdctl` hangs or says "context deadline exceeded"**: wrong endpoint, missing certificates, or ETCD is down.
- **Certificate errors**: compare the cert paths used by `etcdctl` with those in the manifest.

### CKA exam tips

- Only the API Server talks to ETCD.
- Know the default data directory `/var/lib/etcd` and certificate folder `/etc/kubernetes/pki/etcd`.
- Find paths from the manifest (`/etc/kubernetes/manifests/etcd.yaml`) instead of guessing.
- Always set `ETCDCTL_API=3` and pass `--cacert`, `--cert`, `--key`, `--endpoints`.
- Stacked vs external changes where you look: Pod vs systemd service.

### Key takeaways

- ETCD holds all cluster state and is the source of truth.
- It runs as a static Pod (stacked) or as an external service.
- Only the API Server is a client; it authenticates with certificates.
- `etcdctl` needs the same TLS files to connect.
- Protect ETCD and back it up; losing it means losing the cluster's state.
