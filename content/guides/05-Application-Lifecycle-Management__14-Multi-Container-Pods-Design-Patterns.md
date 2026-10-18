### Introduction

Three classic multi-container patterns describe what the extra container does.

### Sidecar

Extends or enhances the main container without changing it.

```
 ┌───────────── Pod ─────────────┐
 │ [web app] ──logs──► [log agent]│──► central store
 └────────────────────────────────┘
```

Examples: log shipping, config reloader, service mesh proxy (Envoy/Istio), certificate renewers.

Modern Kubernetes (1.29+) supports **native sidecars**: an init container with `restartPolicy: Always` that starts before the main containers and stays running.

### Adapter

Transforms the main container's output into a standard format.

```
 [app emits custom metrics] ──► [adapter converts] ──► Prometheus format
```

### Ambassador

Acts as a proxy between the app and the outside world.

```
 [app] ──localhost:6379──► [ambassador] ──► redis-dev / redis-prod
```

The app always connects to localhost; the ambassador decides where to route.

### Comparison

| Pattern | Direction | Example |
|---|---|---|
| Sidecar | Adds capability | Log shipper |
| Adapter | Standardises output | Metrics format converter |
| Ambassador | Proxies outbound | DB connection router |

### Key takeaways

- Same Pod mechanics; the pattern describes purpose.
