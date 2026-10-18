### Introduction

Nodes need operating system patches, kernel upgrades and hardware maintenance. You must be able to take a node out of service without hurting the applications on it.

### What happens when a node goes down

- Pods on the node become unreachable.
- Pods managed by a ReplicaSet/Deployment are recreated elsewhere **after the eviction timeout (default 5 minutes)**, if the node does not come back.
- Pods **not** managed by a controller are lost.
- If the node returns within the timeout, the kubelet restarts its Pods.

For planned work, don't rely on the timeout. Drain the node.

### cordon, drain, uncordon

```
 cordon    mark node unschedulable (existing Pods stay)
 drain     cordon + evict all Pods (they're recreated elsewhere)
 uncordon  make schedulable again
```

```bash
kubectl drain node01 --ignore-daemonsets
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data --force
kubectl cordon node01
kubectl uncordon node01
kubectl get nodes        # STATUS: Ready,SchedulingDisabled
```

### Drain flags

| Flag | Why |
|---|---|
| `--ignore-daemonsets` | DaemonSet Pods can't be evicted; ignore them (required in practice) |
| `--delete-emptydir-data` | Allow evicting Pods using emptyDir (data lost) |
| `--force` | Evict Pods not managed by a controller (they are **deleted permanently**) |
| `--grace-period`, `--timeout` | Control termination wait |

A drain fails with "cannot delete Pods not managed by ReplicationController, ReplicaSet, Job, DaemonSet or StatefulSet" for bare Pods; `--force` deletes them for good.

### Typical workflow

```bash
kubectl drain node01 --ignore-daemonsets
# patch/reboot the node
ssh node01 'sudo apt update && sudo apt upgrade -y && sudo reboot'
kubectl uncordon node01
```

Pods that moved don't return automatically; they only move back if recreated or rescheduled.

### PodDisruptionBudgets

A PDB limits voluntary evictions so drains don't take down too many replicas at once:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: web
```

A drain waits (retries) if evicting would violate the PDB.

### Troubleshooting

- Drain hangs: a PDB, a Pod with a finalizer, or unreachable node.
- Pods Pending after drain: not enough capacity on remaining nodes.
- Node still `SchedulingDisabled` after maintenance: run `uncordon`.

### CKA exam tips

- `drain` already cordons the node; `uncordon` is needed afterwards.
- Bare Pods need `--force`, which deletes them.

### Key takeaways

- Drain for maintenance, uncordon when finished.
