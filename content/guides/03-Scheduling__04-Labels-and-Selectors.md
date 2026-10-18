### Introduction

Labels are key/value pairs attached to objects. Selectors filter objects by those labels. This pair is how Kubernetes groups things: ReplicaSets find their Pods, Services find their backends, NetworkPolicies pick targets, and the scheduler matches node labels.

```
 Pod A  app=web tier=front env=prod
 Pod B  app=web tier=front env=dev
 Pod C  app=db  tier=back  env=prod

 selector app=web            -> A, B
 selector env=prod           -> A, C
 selector app=web,env=prod   -> A
```

### Defining labels

```yaml
metadata:
  name: web
  labels:
    app: web
    tier: front
    env: prod
```

```bash
kubectl run web --image=nginx --labels="app=web,tier=front"
kubectl label pod web env=prod              # add
kubectl label pod web env=dev --overwrite   # change
kubectl label pod web env-                  # remove
kubectl label node node01 disktype=ssd      # nodes too
```

### Selecting

```bash
kubectl get pods --show-labels
kubectl get pods -l app=web
kubectl get pods -l 'app=web,env=prod'      # AND
kubectl get pods -l 'env in (prod,dev)'
kubectl get pods -l 'env!=prod'
kubectl get pods -l '!env'                  # no env label
kubectl get all -l app=web
```

### Equality vs set-based selectors

| Style | Syntax | Used by |
|---|---|---|
| Equality | `app=web`, `app!=web` | `kubectl -l`, Services (`selector:`) |
| Set-based | `env in (a,b)`, `notin`, `exists` | `matchExpressions` in Deployments/RS/Jobs |

```yaml
selector:
  matchLabels:
    app: web
  matchExpressions:
  - key: env
    operator: In
    values: [prod, dev]
```

### Where labels connect objects

```yaml
# Deployment: selector must match template labels
spec:
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}

# Service: selector picks Pods
spec:
  selector: {app: web}
```

### Labels vs annotations

Labels are for selecting and grouping. **Annotations** hold non-identifying info (build number, contact, tool settings) and can't be selected on.

```bash
kubectl annotate pod web owner="team-a"
```

### Troubleshooting

- Service has no endpoints: Pod labels don't match the selector.
- ReplicaSet creating too many Pods: another Pod carries the same label.
- Label values must be 63 characters or fewer, alphanumeric, `-`, `_`, `.`.

### CKA exam tips

- `--show-labels` and `-l` are used in nearly every troubleshooting question.
- `kubectl get pods -l a=b --no-headers | wc -l` counts quickly.

### Key takeaways

- Labels attach metadata, selectors choose by it.
- Equality selectors for kubectl/Services; set-based for workload selectors.
