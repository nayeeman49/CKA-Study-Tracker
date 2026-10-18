### Introduction

The scheduler uses resource **requests** to decide where a Pod fits. The kubelet and kernel enforce **limits** while the Pod runs. Setting them well prevents one Pod from starving others.

### Requests vs limits

| | Request | Limit |
|---|---|---|
| Meaning | Guaranteed minimum | Hard maximum |
| Used by | Scheduler (fits on node?) | Kubelet/kernel (cgroups) |
| CPU over limit | Throttled | Throttled |
| Memory over limit | N/A | Container is **OOMKilled** |

```yaml
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:
        cpu: "500m"
        memory: "256Mi"
      limits:
        cpu: "1"
        memory: "512Mi"
```

### Units

- CPU: `1` = 1 vCPU/core; `100m` = 0.1 CPU (milli). Minimum `1m`.
- Memory: `256Mi`, `1Gi` (binary) or `256M`, `1G` (decimal). Beware: `m` means milli, `Mi` is mebibytes.

### Behaviours

```
CPU    Request 1, limit 3 :  can burst to 3 if available, throttled above
Memory Pod exceeds limit  :  OOMKilled (reason in describe pod)
Memory exceeding node     :  eviction of Pods using more than requested
```

If a Pod's request is larger than any node's allocatable resources, it stays Pending with `Insufficient cpu/memory`.

### Defaults: LimitRange

A LimitRange sets default and max/min per namespace, so Pods without resources get defaults:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: cpu-limit-range
spec:
  limits:
  - default:
      cpu: 500m
    defaultRequest:
      cpu: 500m
    max:
      cpu: "1"
    min:
      cpu: 100m
    type: Container
```

### ResourceQuota

Caps the total for a namespace (see Namespaces lesson):

```yaml
spec:
  hard:
    requests.cpu: "4"
    limits.cpu: "10"
    requests.memory: 4Gi
    limits.memory: 10Gi
```

### QoS classes

| Class | Condition | Eviction order |
|---|---|---|
| Guaranteed | request = limit for all resources | last |
| Burstable | some request/limit | middle |
| BestEffort | none | first |

```bash
kubectl describe pod x | grep QoS
kubectl top pod x          # needs metrics-server
```

### Troubleshooting

- `OOMKilled` exit code 137: raise the memory limit or fix the leak.
- Pending with `Insufficient`: lower requests or add nodes.
- CPU throttling causing slowness: raise or remove the CPU limit.

### CKA exam tips

- `kubectl describe node` shows allocated resources and what remains.
- Resource fields can't be changed on a running Pod; delete and recreate.

### Key takeaways

- Requests schedule, limits enforce.
- Memory limit breach kills the container; CPU is throttled.
