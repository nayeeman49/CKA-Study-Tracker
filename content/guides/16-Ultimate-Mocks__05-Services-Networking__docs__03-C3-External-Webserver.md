### How to approach this lab

Pods must reach a web server **outside** the cluster using a Service name.

### Option 1: Service + Endpoints (no selector)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-web
spec:
  ports:
  - port: 80
---
apiVersion: v1
kind: Endpoints
metadata:
  name: external-web
subsets:
- addresses:
  - ip: 192.168.1.100
  ports:
  - port: 80
```

The Endpoints name must equal the Service name.

### Option 2: ExternalName

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-web
spec:
  type: ExternalName
  externalName: web.example.com
```

This creates a DNS CNAME.

### Test

```bash
kubectl exec <pod> -- curl external-web
kubectl get svc,ep external-web
```

### Choosing between the options

| Need | Use |
|---|---|
| External server has a fixed IP | Service without selector + Endpoints |
| External server has a DNS name | `ExternalName` |

`ExternalName` doesn't work with IP addresses and doesn't proxy ports; it only returns a CNAME.
