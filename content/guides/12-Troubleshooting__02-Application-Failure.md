### Introduction

Troubleshooting an application: follow the request path and check each hop.

### Typical architecture

```
 user ─► web Service ─► web Pods ─► db Service ─► db Pods
```

### Method

1. Start from the user's symptom (cannot reach the app).
2. Walk each layer: Service, Pods, dependencies, configuration.
3. Use logs and events.

### Checks, in order

```bash
# Service
kubectl get svc
kubectl describe svc web-service           # selector, port, targetPort, Endpoints
kubectl get endpoints web-service          # empty means no matching ready Pods
kubectl get pods --show-labels             # compare labels with selector

# Pods
kubectl get pods
kubectl describe pod web
kubectl logs web
kubectl logs web --previous                # after a restart

# Dependencies (DB)
kubectl get svc mysql-service ; kubectl describe svc mysql-service
kubectl get pods ; kubectl logs mysql
```

### Common causes

| Symptom | Likely cause |
|---|---|
| Service has no endpoints | Selector/labels mismatch, Pods not Ready |
| Connection refused | Wrong `targetPort`, app not listening |
| `CrashLoopBackOff` | Bad command, missing config, DB unreachable |
| App can't reach DB | DB service name/port, env variables, DB credentials, namespace |
| Intermittent errors | Probes, resource limits, node issues |

### Test connectivity

```bash
kubectl exec web -- curl -s db-service:3306
kubectl run tmp --rm -it --image=busybox --restart=Never -- nslookup db-service
```

### Key takeaways

- Check Service → Endpoints → Pod → logs → dependencies.
