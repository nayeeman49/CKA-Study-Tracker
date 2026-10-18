### How to approach this lab

Tasks: see where Pods run, drain a node, deal with a bare Pod, uncordon.

### Commands

```bash
kubectl get nodes
kubectl get pods -o wide
kubectl drain node01 --ignore-daemonsets
kubectl get pods -o wide                 # moved Pods
kubectl uncordon node01
kubectl cordon node01
kubectl drain node01 --ignore-daemonsets --force     # for a bare pod (deleted forever)
```

### Notes

- A Pod not part of a ReplicaSet/Deployment (like `hr-app`) can't be rescheduled; the drain refuses until `--force`, and the Pod is lost.
- After `uncordon`, existing Pods do not move back automatically; new Pods can land there.
- `cordon` only blocks new scheduling.

### Worked example

```bash
kubectl get pods -o wide                      # where do Pods run?
kubectl drain node01 --ignore-daemonsets
kubectl get nodes                             # node01 Ready,SchedulingDisabled
kubectl get pods -o wide                      # recreated on other nodes
kubectl uncordon node01
```

A bare Pod `hr-app` on the node:

```bash
kubectl drain node01 --ignore-daemonsets
# error: cannot delete Pods declare no controller (use --force)
kubectl drain node01 --ignore-daemonsets --force      # hr-app is gone for good
```

Use `cordon` instead when you only want to stop new Pods landing there.

### Common mistakes

- Forgetting `uncordon` afterwards.
- Forgetting `--ignore-daemonsets` (the drain refuses).
- Expecting Pods to move back after uncordon.
