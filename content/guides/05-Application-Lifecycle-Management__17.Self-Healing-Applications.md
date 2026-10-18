### Introduction

Kubernetes keeps applications running through restarts and replacements. Several mechanisms contribute.

### Layers of self healing

| Layer | What heals | Mechanism |
|---|---|---|
| Container | A crashed container | kubelet restarts it per `restartPolicy` |
| Pod | A deleted/failed Pod | ReplicaSet/Deployment recreates it |
| Node | A dead node | Pods rescheduled by controllers |
| Application | A hung but running process | **Probes** |

### Probes

```yaml
containers:
- name: app
  image: nginx
  livenessProbe:
    httpGet:
      path: /healthz
      port: 80
    initialDelaySeconds: 10
    periodSeconds: 5
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /ready
      port: 80
    periodSeconds: 5
  startupProbe:
    httpGet:
      path: /healthz
      port: 80
    failureThreshold: 30
    periodSeconds: 10
```

| Probe | If it fails |
|---|---|
| **liveness** | Container is **restarted** |
| **readiness** | Pod is removed from Service endpoints (not restarted) |
| **startup** | Gives slow apps time; liveness/readiness paused until it passes |

Probe types: `httpGet`, `tcpSocket`, `exec` (command, exit 0 = success), `grpc`.

### Restart policy

`Always` (default), `OnFailure`, `Never`. Restarts use exponential back-off (10s, 20s, 40s ... up to 5 minutes) shown as `CrashLoopBackOff`.

### Seeing it work

```bash
kubectl get pod -w                        # RESTARTS column increases
kubectl describe pod app | grep -A5 -i liveness
kubectl describe pod app                  # events: Liveness probe failed
```

### Pitfalls

- A liveness probe that depends on another service can cause restart storms.
- Readiness probe too strict: Pod never receives traffic (`0/1 READY`).
- `initialDelaySeconds` too small for slow apps; use a startup probe.

### CKA exam tips

- Know YAML for liveness and readiness; copy from docs.
- READY 0/1 with Running status = readiness probe failing.

### Key takeaways

- Restarts, controllers and probes together keep apps alive and traffic safe.
