### Introduction

Node affinity is a more expressive replacement for `nodeSelector`. It supports operators (`In`, `NotIn`, `Exists`, ...) and "preferred" rules that are soft requirements.

### Types

| Type | Meaning |
|---|---|
| `requiredDuringSchedulingIgnoredDuringExecution` | **Hard** rule. Must match to schedule. |
| `preferredDuringSchedulingIgnoredDuringExecution` | **Soft** rule with weight. Scheduler tries, but may fall back. |

"IgnoredDuringExecution" means that changing labels later does not evict running Pods. (A `requiredDuringExecution` type was planned but not available.)

### Example: require Large or Medium

```yaml
spec:
  containers:
  - name: processor
    image: nginx
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: size
            operator: In
            values:
            - Large
            - Medium
```

### Preferred example

```yaml
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 80
      preference:
        matchExpressions:
        - key: disktype
          operator: In
          values: [ssd]
```

### Operators

`In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`.

```yaml
- key: size
  operator: NotIn
  values: [Small]
- key: gpu
  operator: Exists
```

### What happens when no node matches

| Rule | Result |
|---|---|
| required | Pod Pending |
| preferred | Scheduled on any node |

Multiple `matchExpressions` in one term are ANDed. Multiple `nodeSelectorTerms` are ORed.

### Troubleshooting

- Pod Pending: label missing/spelled wrong on nodes, `kubectl get nodes --show-labels`.
- Indentation: `affinity` belongs under `spec`.

### CKA exam tips

- Copy the structure from the docs (`kubectl explain pod.spec.affinity.nodeAffinity` helps).
- `Exists` doesn't need `values`.

### Key takeaways

- Affinity = nodeSelector with operators and soft rules.
- Required = hard, preferred = soft.
