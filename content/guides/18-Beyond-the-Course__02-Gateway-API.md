### Introduction

The **Gateway API** is the successor to Ingress. It is more expressive and role-oriented, splitting infrastructure from application routing. It requires installing the CRDs and a controller (Envoy Gateway, NGINX Gateway Fabric, Istio, Cilium).

### Resources and roles

```
 GatewayClass   ← infrastructure provider (which controller)
      │
   Gateway      ← cluster operator (listeners: port, protocol, hostname)
      │
   HTTPRoute    ← application developer (routing rules to Services)
```

### Examples

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: web-gateway
spec:
  gatewayClassName: nginx
  listeners:
  - name: http
    protocol: HTTP
    port: 80
    allowedRoutes:
      namespaces:
        from: Same
```

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
spec:
  parentRefs:
  - name: web-gateway
  hostnames: ["shop.example.com"]
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /wear
    backendRefs:
    - name: wear-service
      port: 80
  - matches:
    - path: {type: PathPrefix, value: /watch}
    backendRefs:
    - name: video-service
      port: 80
      weight: 90
```

### Commands

```bash
kubectl get gatewayclass,gateway,httproute -A
kubectl describe gateway web-gateway       # Accepted, Programmed conditions
kubectl describe httproute web-route       # ResolvedRefs
```

### Features beyond Ingress

Header-based matching, traffic splitting with weights, request redirects/rewrites, TLS routes, TCP/UDP/gRPC routes, cross-namespace sharing with `ReferenceGrant`.

### Migrating from Ingress

Map each Ingress rule to an HTTPRoute path match; map TLS to Gateway listener `tls`.

### Key takeaways

- GatewayClass → Gateway → HTTPRoute; check status conditions when routes don't work.
