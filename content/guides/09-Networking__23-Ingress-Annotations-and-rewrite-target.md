### Introduction

Annotations configure controller-specific behaviour. The most common is **rewrite-target**, which changes the URL path passed to the backend.

### The problem

A user visits `/watch`; the Ingress routes to the video Service, which serves content at `/`. Without rewriting, the backend receives `/watch` and returns 404.

### Rewrite

```yaml
metadata:
  name: rewrite
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - http:
      paths:
      - path: /pay
        pathType: Prefix
        backend:
          service:
            name: pay-service
            port: {number: 8282}
```

`rewrite-target: /` makes `http://host/pay` reach the backend as `/`.

### With a capture group

```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
  - http:
      paths:
      - path: /something(/|$)(.*)
        pathType: ImplementationSpecific
        backend: ...
```

`/something/foo` → `/foo`.

### Other useful annotations (NGINX)

| Annotation | Purpose |
|---|---|
| `nginx.ingress.kubernetes.io/ssl-redirect` | Force HTTPS |
| `nginx.ingress.kubernetes.io/proxy-body-size` | Upload limit |
| `nginx.ingress.kubernetes.io/whitelist-source-range` | Allowed IPs |

### Key takeaways

- Annotations are controller specific; rewrite-target fixes path mismatches.
