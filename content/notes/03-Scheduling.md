## What this section is about
How the scheduler decides where Pods run, and every lever you have to influence or override it. Typical exam tasks: schedule a Pod on a specific node, tolerate a taint, add node affinity, set requests/limits, create a DaemonSet or static pod.

## How scheduling works
The scheduler **filters** out nodes that cannot run the Pod (insufficient resources, taints, selectors, affinity) then **scores** the rest and binds the Pod by setting `spec.nodeName`. A Pod stuck in `Pending` with an event like `0/3 nodes are available: 1 node(s) had untolerated taint, 2 Insufficient cpu` tells you exactly which filter failed.

## Ways to place Pods
| Mechanism | Use it when |
|---|---|
| `nodeName` | Bypass the scheduler entirely (manual scheduling). Pod is bound immediately; no checks. |
| `nodeSelector` | Simple "node must have label k=v". |
| Node affinity | Richer rules: `requiredDuringSchedulingIgnoredDuringExecution` (hard) vs `preferredDuring...` (soft), operators `In`, `NotIn`, `Exists`, `Gt`. |
| Pod (anti-)affinity | Co-locate or spread Pods relative to other Pods, using `topologyKey` (e.g. `kubernetes.io/hostname`). |
| Taints + tolerations | Nodes *repel* Pods unless they tolerate the taint. |
| Topology spread constraints | Even spread across zones/nodes. |

### Taints and tolerations
```
kubectl taint nodes node01 app=blue:NoSchedule      # add
kubectl taint nodes node01 app=blue:NoSchedule-     # remove (trailing dash)
```
Effects: `NoSchedule` (new Pods only), `PreferNoSchedule` (soft), `NoExecute` (also evicts running Pods that do not tolerate it). A toleration only *allows* scheduling; it does not *attract*. To dedicate a node, combine a taint (keep others out) with node affinity (pull yours in). The control-plane node carries `node-role.kubernetes.io/control-plane:NoSchedule`.

```yaml
tolerations:
- key: "app"
  operator: "Equal"
  value: "blue"
  effect: "NoSchedule"
```

### Labels and selectors
Labels are key/value pairs on any object; selectors (`-l app=web,tier=frontend`, or `matchLabels`/`matchExpressions`) pick objects. Services, ReplicaSets and affinity all rely on them. `kubectl label node node01 size=large` and `kubectl get pods --show-labels`.

## Resources
- **requests**: what the scheduler reserves; used for placement. **limits**: the ceiling enforced at runtime.
- Exceeding a **memory** limit → container is OOMKilled. Exceeding **CPU** limit → throttled, not killed.
- QoS classes: `Guaranteed` (requests = limits for all containers), `Burstable`, `BestEffort` (evicted first).
- A **LimitRange** sets per-namespace defaults and min/max; a **ResourceQuota** caps the namespace total.

## DaemonSets and static Pods
- **DaemonSet**: one Pod per (matching) node, e.g. log shippers, kube-proxy, CNI agents. Create by generating a Deployment YAML and changing `kind: DaemonSet`, removing `replicas` and `strategy`.
- **Static Pods**: managed directly by the kubelet from manifest files (path in `staticPodPath` of `/var/lib/kubelet/config.yaml`, normally `/etc/kubernetes/manifests`). The API shows a read-only mirror Pod with the node name suffix. Delete the file to delete the Pod. This is how kubeadm runs the control plane.

## Multiple schedulers and profiles
A custom scheduler runs as its own Pod; a Pod opts in with `spec.schedulerName`. Modern clusters usually use **scheduler profiles** in `KubeSchedulerConfiguration` instead. Check the scheduler Pod's logs/events to confirm which scheduler bound a Pod.

## Priority and preemption
`PriorityClass` objects give Pods a priority; when a high-priority Pod is Pending, the scheduler may evict lower-priority ones.

## Exam tips
- Pod stuck Pending: `kubectl describe pod` → Events. Check taints (`kubectl describe node | grep Taints`), requests vs node allocatable, node labels.
- Editing a running Pod's spec is mostly forbidden; export, edit, delete and recreate (`kubectl replace --force -f`).
- Know how to find the static pod path: `ps aux | grep kubelet` then `--config`, then `staticPodPath`.

## Official documentation
- [Kubernetes Scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/), [Assigning Pods to Nodes](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/)
- [Taints and Tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
- [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/), [Static Pods](https://kubernetes.io/docs/tasks/configure-pod-container/static-pod/)
- [Pod Priority and Preemption](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/)
- [Configure Multiple Schedulers](https://kubernetes.io/docs/tasks/extend-kubernetes/configure-multiple-schedulers/)
