### Introduction

Namespaces divide one physical cluster into multiple virtual clusters. They give you separate scopes for names, access control, and resource limits. A house with rooms: each team has its own room but shares the building.

### Default namespaces

| Namespace | Purpose |
|---|---|
| `default` | Where objects go if you don't say otherwise |
| `kube-system` | Kubernetes system components (API server, DNS, proxy...) |
| `kube-public` | Readable by everyone, mostly cluster info |
| `kube-node-lease` | Node heartbeat Lease objects |

### Why use them

- **Isolation**: dev, test, prod in the same cluster without name collisions.
- **Resource control**: a `ResourceQuota` limits CPU/memory/object counts per namespace.
- **Access control**: RBAC Roles and RoleBindings are namespaced.
- **Organisation** by team or application.

Not everything is namespaced. Nodes, PersistentVolumes, Namespaces, ClusterRoles, StorageClasses are cluster-wide. `kubectl api-resources --namespaced=false` lists them.

### Creating

```bash
kubectl create namespace dev
kubectl create ns dev --dry-run=client -o yaml
```

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev
```

### Using a namespace

```bash
kubectl get pods -n dev
kubectl get pods --namespace=dev
kubectl get pods -A                       # all namespaces
kubectl run nginx --image=nginx -n dev
kubectl apply -f pod.yaml -n dev
```

Or specify it in the YAML metadata (this wins over default):

```yaml
metadata:
  name: nginx
  namespace: dev
```

### Switching the default namespace of your context

```bash
kubectl config set-context --current --namespace=dev
kubectl config view --minify | grep namespace
```

This is a handy exam time-saver, but remember to switch back.

### DNS across namespaces

Services get a DNS name per namespace:

```
<service>.<namespace>.svc.cluster.local
```

Inside the same namespace you can use just `db-service`. From another namespace use `db-service.dev` or the full name.

### Resource quota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: dev
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 5Gi
    limits.cpu: "10"
    limits.memory: 10Gi
```

### Deleting

Deleting a namespace deletes **everything** inside it:

```bash
kubectl delete ns dev
```

### CKA exam tips

- Always check which namespace a question refers to; objects in the wrong namespace score nothing.
- If `kubectl get` returns nothing, you may be in the wrong namespace: try `-A`.
- Use `kubectl config set-context --current --namespace=` to avoid typing `-n` repeatedly.

### Key takeaways

- Namespaces scope names, RBAC and quotas.
- Four exist by default; `default` is where you land.
- Cross-namespace DNS uses `svc.namespace`.
