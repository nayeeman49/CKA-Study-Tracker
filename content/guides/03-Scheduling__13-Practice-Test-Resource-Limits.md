### How to approach this lab

Tasks: read the resources of a Pod, find why a Pod is OOMKilled, and edit the limit.

### Commands

```bash
kubectl describe pod elephant           # State, Last State: Terminated, Reason: OOMKilled
kubectl get pod elephant -o yaml | grep -A6 resources
kubectl get pod elephant -o yaml > elephant.yaml
vi elephant.yaml                         # raise limits.memory
kubectl replace --force -f elephant.yaml
kubectl describe node | grep -A8 "Allocated resources"
```

### Pointers

- Exit code **137** and reason `OOMKilled` mean the memory limit was too low.
- Resources are immutable on existing Pods (in older versions), so replace.
- `kubectl describe` also shows `Limits` and `Requests` per container.
- A LimitRange applies **at creation**; check `kubectl get limitrange -n ns`.

### Worked example

Pod `elephant` keeps restarting:

```bash
kubectl describe pod elephant
#  Last State: Terminated  Reason: OOMKilled  Exit Code: 137
#  Limits: memory 10Mi
```

Raise the limit:

```bash
kubectl get pod elephant -o yaml > e.yaml
sed -i 's/memory: 10Mi/memory: 20Mi/' e.yaml
kubectl replace --force -f e.yaml
kubectl get pod elephant -w
```

### Why this works

Memory is incompressible, so crossing the limit kills the container; CPU is compressible and only slows the process.

### Common mistakes

- Increasing the **request** but not the **limit**.
- Writing `memory: 20m` (milli-bytes) instead of `20Mi`.
- Setting a request above any node's capacity, leaving the Pod Pending.
