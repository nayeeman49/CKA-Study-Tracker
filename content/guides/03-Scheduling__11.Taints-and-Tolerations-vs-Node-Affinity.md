### Introduction

Taints and tolerations only repel. Node affinity only attracts. To dedicate nodes to certain Pods, so those Pods go only there and nothing else goes there, use both.

### Comparison

| | Taints + tolerations | Node affinity |
|---|---|---|
| Set on | Node (taint) + Pod (toleration) | Pod (rule) + Node (label) |
| Effect | Keeps unwanted Pods **off** a node | Draws Pods **to** a node |
| Guarantees Pod lands there? | No | Yes (required) |
| Guarantees others stay away? | Yes (NoSchedule) | No |

### The combined pattern

Goal: nodes Blue, Red and Green are for the blue, red and green Pods only; other Pods go to the remaining nodes.

```
 Taints only            Affinity only           Both
 blue Pod can go to     blue Pod only goes to   blue Pod only on blue node,
 any node, others       blue node, but other    others can't use it either
 can't use blue         Pods may also land
```

Steps:

1. Taint each node: `kubectl taint nodes blue color=blue:NoSchedule`.
2. Label each node: `kubectl label nodes blue color=blue`.
3. In the Pod add the toleration (to be allowed) **and** node affinity or nodeSelector (to be drawn).

```yaml
spec:
  tolerations:
  - key: color
    operator: Equal
    value: blue
    effect: NoSchedule
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: color
            operator: In
            values: [blue]
```

### CKA exam tips

- Read the question: "only on" = affinity or nodeSelector, "no other Pod may run there" = taint.
- If a Pod with a toleration still isn't on the node, you probably forgot the affinity.

### Key takeaways

- Taints keep others out, affinity pulls yours in; dedicated nodes need both.
