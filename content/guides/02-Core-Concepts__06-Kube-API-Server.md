### Introduction

The kube-apiserver is the front door of Kubernetes. Every command you type, every controller, the scheduler and every kubelet talk to it, and it is the only component that reads and writes ETCD. If the API Server is down, you cannot manage the cluster even though existing workloads keep running.

### What the API Server does

```
kubectl / client ──► kube-apiserver ──► etcd
                          ▲   ▲   ▲
                scheduler │   │   │ kubelet
                  controller-manager
```

When a request arrives it passes through a fixed pipeline:

```
 Request
    │
    ▼
 1. Authentication    who are you?
    ▼
 2. Authorization     are you allowed to do this?
    ▼
 3. Admission control may the request be changed or rejected?
    ▼
 4. Validation        is the object valid?
    ▼
 5. Persist to etcd   then respond to the client
```

#### Authentication

Identifies the caller using client certificates, bearer tokens, service account tokens, or OIDC. Users are not stored as objects in Kubernetes; they are identities proven by a credential.

#### Authorization

Decides what an identity may do. Common modes are `Node`, `RBAC`, `Webhook`, `ABAC`. Set with `--authorization-mode=Node,RBAC`.

#### Admission control

Plugins that inspect or modify requests after authorization. Examples: `NamespaceLifecycle` (stops creating objects in a missing namespace), `LimitRanger`, `ResourceQuota`, `ServiceAccount`, `DefaultStorageClass`, `NodeRestriction`. Enabled with `--enable-admission-plugins`.

### Example: a request without kubectl

kubectl is a convenience wrapper over REST. You can call the API directly:

```bash
kubectl proxy --port=8001 &
curl http://localhost:8001/api/v1/namespaces/default/pods
curl http://localhost:8001/apis/apps/v1/namespaces/default/deployments
```

`kubectl proxy` handles authentication for you. Using `curl` against port 6443 directly needs certificates:

```bash
curl https://<apiserver>:6443/api/v1/pods \
  --cacert ca.crt --cert admin.crt --key admin.key
```

### API groups

The API is organised into groups so it can grow:

| Group | Path | Examples |
|---|---|---|
| core (legacy) | `/api/v1` | pods, services, nodes, namespaces, configmaps, secrets, PVs |
| apps | `/apis/apps/v1` | deployments, replicasets, daemonsets, statefulsets |
| batch | `/apis/batch/v1` | jobs, cronjobs |
| networking.k8s.io | `/apis/networking.k8s.io/v1` | ingresses, networkpolicies |
| rbac.authorization.k8s.io | `/apis/rbac.authorization.k8s.io/v1` | roles, rolebindings, clusterroles |
| storage.k8s.io | `/apis/storage.k8s.io/v1` | storageclasses |

This is why YAML has `apiVersion: apps/v1` for a Deployment and `apiVersion: v1` for a Pod. Each resource has verbs: `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`.

```bash
kubectl api-resources                 # all kinds, short names, namespaced?
kubectl api-versions                  # all group/version pairs
kubectl explain pod.spec.containers   # field documentation
```

### How the API Server is run

In a kubeadm cluster it is a static Pod:

```bash
cat /etc/kubernetes/manifests/kube-apiserver.yaml
kubectl -n kube-system get pod kube-apiserver-controlplane
```

In a cluster built "the hard way" it is a systemd service:

```bash
cat /etc/systemd/system/kube-apiserver.service
ps -aux | grep kube-apiserver
```

### Important options

| Option | Purpose |
|---|---|
| `--advertise-address` | IP the API Server advertises to the cluster |
| `--secure-port` | HTTPS port, default **6443** |
| `--etcd-servers` | ETCD URLs |
| `--etcd-cafile`, `--etcd-certfile`, `--etcd-keyfile` | Client cert to talk to ETCD |
| `--client-ca-file` | CA for verifying client certificates |
| `--tls-cert-file`, `--tls-private-key-file` | Its own serving certificate |
| `--kubelet-client-certificate` / `-key` | Cert to talk to kubelets |
| `--service-cluster-ip-range` | Range for Service ClusterIPs |
| `--authorization-mode` | e.g. `Node,RBAC` |
| `--enable-admission-plugins` | Admission plugins on |
| `--service-account-key-file` | Key to verify service account tokens |

### Troubleshooting

- `kubectl` says "connection refused on 6443": the API Server is not running. On the control plane node use `crictl ps -a | grep apiserver`, then `crictl logs <id>`.
- Pod crash after you edited the manifest: a typo in a flag or wrong certificate path. The kubelet restarts the Pod after each edit. Fix the file and wait a minute.
- Check the log files `/var/log/pods/kube-system_kube-apiserver-*` when `crictl` is not clear.
- `kubectl get pods` returning "Unauthorized/Forbidden": an authentication or authorization problem, not an outage.

### CKA exam tips

- Port **6443**. Config at `/etc/kubernetes/manifests/kube-apiserver.yaml`.
- Always back up a manifest before editing: `cp kube-apiserver.yaml /root/`.
- Use `kubectl api-resources` to find short names and API groups quickly.

### Key takeaways

- Only the API Server talks to ETCD.
- Every request goes through authentication, authorization, admission and validation.
- The REST API is split into groups and versions.
- It runs as a static Pod in kubeadm clusters.
