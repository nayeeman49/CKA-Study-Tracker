### How to approach this lab

Namespace questions are mostly "find" and "create in the right place".

### Commands

```bash
kubectl get namespaces
kubectl get ns --no-headers | wc -l
kubectl get pods -n research
kubectl get pods --all-namespaces
kubectl run redis --image=redis -n finance
kubectl get pods -A | grep blue
kubectl create ns dev-ns
kubectl describe svc db-service -n marketing
```

### Typical questions

| Question | Answer approach |
|---|---|
| How many namespaces? | `kubectl get ns` |
| How many Pods in namespace X? | `kubectl get pods -n X` |
| In which namespace is Pod Y? | `kubectl get pods -A \| grep Y` |
| Create a Pod in namespace X | `kubectl run NAME --image=IMG -n X` |
| What DNS name connects to a service in another namespace? | `service.namespace.svc.cluster.local` |

### The DNS question

A web app in the default namespace needs to reach `db-service` in `dev`:

```
db-service.dev.svc.cluster.local
```

`db-service` alone resolves only within the same namespace.

### Tips

- Use `-A` and `grep` to find things quickly.
- Use `kubectl config set-context --current --namespace=NS` to switch the default, then check with `kubectl config view --minify`.
