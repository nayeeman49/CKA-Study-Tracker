# Gateway API

Gateway API is the role-oriented successor to Ingress and is named explicitly in the current CKA curriculum ("Use the Gateway API to manage Ingress traffic").

## Resources
- **GatewayClass**: which controller implements gateways (like IngressClass). Installed by the provider.
- **Gateway**: listeners (port, protocol, hostname, TLS) that instantiate a load balancer/proxy. Owned by the cluster operator.
- **HTTPRoute** (also GRPCRoute, TCPRoute, TLSRoute): routing rules owned by app teams, attached to a Gateway with `parentRefs`.
- **ReferenceGrant**: allows cross-namespace references.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: {name: web-gw, namespace: infra}
spec:
  gatewayClassName: example-class
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    allowedRoutes: {namespaces: {from: All}}
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: shop, namespace: shop}
spec:
  parentRefs: [{name: web-gw, namespace: infra}]
  hostnames: ["shop.example.com"]
  rules:
  - matches: [{path: {type: PathPrefix, value: /pay}}]
    backendRefs: [{name: pay-svc, port: 80}]
  - backendRefs:
    - {name: shop-v1, port: 80, weight: 90}
    - {name: shop-v2, port: 80, weight: 10}
```

## Ingress vs Gateway API
| | Ingress | Gateway API |
|---|---|---|
| Roles | One object | Split: class / gateway / routes |
| Features | Host + path; extras via annotations | Header/method matching, weights, redirects, rewrites in the spec |
| Protocols | HTTP(S) | HTTP, gRPC, TCP, TLS, UDP |
Gateway API CRDs are **not** installed by default (`kubectl get crd | grep gateway`), and nothing happens without a controller. Check status: `kubectl describe gateway` shows `Accepted`/`Programmed` conditions; `kubectl describe httproute` shows whether the route was accepted by its parent.

## Exam tips
- Migrating an Ingress to a Gateway/HTTPRoute is a likely task: map host → `hostnames`, path → `matches`, backend service → `backendRefs`.
- Find the Gateway's address in `kubectl get gateway` and test with `curl -H "Host: ..."`.

## Official documentation
- [Gateway API (kubernetes.io)](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Gateway API project documentation](https://gateway-api.sigs.k8s.io/)
- [Migrating from Ingress](https://gateway-api.sigs.k8s.io/guides/migrating-from-ingress/)
