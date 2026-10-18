### Introduction

Taints and tolerations control which Pods may run on which nodes. A **taint** on a node repels Pods. A **toleration** on a Pod lets it ignore a taint. Think of a bug spray (taint) on a person (node) and bugs (Pods) that are resistant (tolerant).

Important: tolerations *allow* a Pod on a tainted node, but do not *attract* it there. For attraction use node affinity (next lessons).

### Taint a node

```bash
kubectl taint nodes node01 app=blue:NoSchedule
kubectl taint nodes node01 app=blue:NoSchedule-     # remove (trailing -)
kubectl describe node node01 | grep -i taint
```

Format: `key=value:effect`.

### Effects

| Effect | Behaviour |
|---|---|
| `NoSchedule` | New Pods without a toleration won't be scheduled here. Existing Pods stay. |
| `PreferNoSchedule` | Soft version: scheduler tries to avoid, but may use it. |
| `NoExecute` | New Pods won't schedule **and existing Pods without toleration are evicted**. |

### Tolerate in a Pod

```yaml
spec:
  containers:
  - name: nginx
    image: nginx
  tolerations:
  - key: "app"
    operator: "Equal"
    value: "blue"
    effect: "NoSchedule"
```

Exists operator (any value):

```yaml
tolerations:
- key: "app"
  operator: "Exists"
  effect: "NoSchedule"
```

For `NoExecute`, `tolerationSeconds` says how long the Pod may stay after the taint appears.

### Example scenario

```
node01: taint app=blue:NoSchedule

Pod A (no toleration)           -> node02 or node03
Pod B (tolerates app=blue)      -> any node, including node01
```

### The control plane taint

kubeadm taints control plane nodes so workloads don't run there:

```bash
kubectl describe node controlplane | grep Taint
# node-role.kubernetes.io/control-plane:NoSchedule
```

Other built-in taints are added automatically: `node.kubernetes.io/not-ready`, `unreachable`, `disk-pressure`, `memory-pressure`, `unschedulable`.

### Troubleshooting

- Pod Pending with `node(s) had untolerated taint {key: value}`: add a toleration or remove the taint.
- Pods unexpectedly evicted: `NoExecute` taint added.
- Typos: values in quotes in YAML, `effect` must match exactly.

### CKA exam tips

- `kubectl taint` syntax is the most tested bit. Remember the `-` to remove.
- Tolerations are in the **Pod** spec at the same level as `containers`.
- A toleration doesn't force placement.

### Key takeaways

- Taint = node repels, toleration = Pod tolerates.
- Three effects; `NoExecute` evicts.
