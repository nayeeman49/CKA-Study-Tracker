### Introduction

You can upgrade a cluster in different ways depending on how it was built: managed service (a few clicks), kubeadm (commands), or manual ("the hard way").

### Strategies for workers

| Strategy | Description |
|---|---|
| All at once | Downtime; rarely used |
| Rolling, one node at a time | Standard. Drain, upgrade, uncordon |
| Blue/green (add new nodes) | Cloud friendly: add upgraded nodes, move workloads, remove old nodes |

### Order with kubeadm

```
 1. Upgrade control plane node(s)
        kubeadm  ──► kubeadm upgrade apply
        kubelet + kubectl
 2. Upgrade each worker node, one at a time
        drain ► kubeadm upgrade node ► kubelet ► uncordon
```

While the control plane is upgrading, workloads keep running; you just can't manage the cluster. Management functions (scaling, new Pods) are unavailable temporarily.

### Plan

```bash
kubeadm upgrade plan        # shows available versions and component changes
```

### Key takeaways

- Control plane first, then workers one at a time.
- kubeadm provides `upgrade plan` and `upgrade apply`.
