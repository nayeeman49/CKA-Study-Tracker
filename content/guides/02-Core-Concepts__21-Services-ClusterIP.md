### Introduction

ClusterIP is the default Service type. It gives a virtual IP reachable only from inside the cluster. It is the glue between tiers of a multi-tier app: frontend → backend → database.

```
  frontend Pods
        │ calls backend-svc
        ▼
  ┌───────────────┐
  │ ClusterIP     │  10.96.14.5:80
  │ backend-svc   │
  └───────┬───────┘
          ▼
   backend Pods (3 replicas, changing IPs)
```

Each tier can scale and restart without breaking the others, because they only know the Service name.

### YAML

```yaml
apiVersion: v1
kind: Service
metadata:
  name: back-end
spec:
  type: ClusterIP        # optional, default
  selector:
    app: myapp
    type: back-end
  ports:
  - port: 80             # service port
    targetPort: 80       # container port
```

```bash
kubectl apply -f service.yaml
kubectl get svc back-end
kubectl describe svc back-end
kubectl expose deployment backend --name=back-end --port=80 --target-port=8080
```

### How clients reach it

By DNS name (CoreDNS) or environment variable:

```
back-end                           (same namespace)
back-end.default                   (from other namespace)
back-end.default.svc.cluster.local (fully qualified)
```

```bash
kubectl run tmp --image=busybox --rm -it --restart=Never -- nslookup back-end
kubectl run tmp --image=curlimages/curl --rm -it --restart=Never -- curl http://back-end
```

### Port mapping example

Service `port: 80` forwarding to `targetPort: 8080` lets clients use the standard port while the app listens elsewhere.

### Session affinity

By default each connection is balanced randomly. To pin a client to a Pod: `sessionAffinity: ClientIP`.

### Headless Services

`clusterIP: None` creates a Service with no virtual IP; DNS returns the Pod IPs directly. Used with StatefulSets.

### Troubleshooting

- Run `kubectl get endpoints back-end`: empty means labels don't match.
- DNS fails: check CoreDNS Pods in `kube-system`.
- Service has the right endpoints but connection fails: wrong `targetPort`, or app not listening.

### CKA exam tips

- Services don't answer ping; test with `curl`/`nc`.
- `kubectl expose` is fast but check selector and ports in the generated object.

### Key takeaways

- ClusterIP is internal only and the default type.
- Clients use DNS names; the IP never needs to be hard coded.
