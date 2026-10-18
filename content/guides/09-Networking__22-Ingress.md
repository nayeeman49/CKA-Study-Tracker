### Introduction

NodePort and LoadBalancer expose one Service each. **Ingress** is a layer 7 (HTTP/HTTPS) router that exposes many Services through one entry point using URL paths or hostnames, and also handles TLS.

```
 Internet ─► [Ingress controller (NodePort/LB)] ─► rules ─► Service A (/wear)
                                                       └──► Service B (/watch)
```

### Two parts

1. **Ingress controller** - the software that does the work (NGINX, Traefik, HAProxy, Istio, Contour). **Not installed by default.**
2. **Ingress resources** - rules the controller reads.

### Deploy a controller (NGINX example)

Needs a Deployment, a Service to expose it (NodePort/LB), a ConfigMap, a ServiceAccount with the right RBAC, and an `IngressClass`.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.0/deploy/static/provider/baremetal/deploy.yaml
kubectl -n ingress-nginx get all
kubectl get ingressclass
```

### Ingress resource

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-wear-watch
  namespace: app-space
spec:
  ingressClassName: nginx
  rules:
  - http:
      paths:
      - path: /wear
        pathType: Prefix
        backend:
          service:
            name: wear-service
            port:
              number: 80
      - path: /watch
        pathType: Prefix
        backend:
          service:
            name: video-service
            port:
              number: 80
```

By host:

```yaml
rules:
- host: wear.my-online-store.com
  http:
    paths:
    - path: /
      pathType: Prefix
      backend: {service: {name: wear-service, port: {number: 80}}}
```

### Imperative

```bash
kubectl create ingress ingress-test --rule="wear.my-online-store.com/wear*=wear-service:80"
kubectl get ingress
kubectl describe ingress ingress-wear-watch
```

### Path types

`Exact`, `Prefix`, `ImplementationSpecific`.

### Default backend

Requests matching no rule go to the default backend (404 page unless configured).

### TLS

```yaml
spec:
  tls:
  - hosts: [shop.example.com]
    secretName: shop-tls
```

### Troubleshooting

- 404 from the controller: path, host or service name/port mismatch; check `describe ingress` for `<error: endpoints ... not found>`.
- 503: Service has no ready endpoints.
- Ingress ignores rules: wrong `ingressClassName`.
- Backend service must be in the same namespace as the Ingress.

### CKA exam tips

- Know `kubectl create ingress` and the YAML shape; `pathType` is required.

### Key takeaways

- Controller + resource; L7 routing by path/host.
