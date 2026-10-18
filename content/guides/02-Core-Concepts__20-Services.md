### Introduction

A Service gives a stable network endpoint to a dynamic group of Pods. Pods come and go and their IPs change; clients talk to the Service, and Kubernetes forwards to healthy Pods. Services also give load balancing and loose coupling between application tiers.

```
 frontend Pods ──► backend Service ──► backend Pods
                  (stable IP + DNS)     (changing IPs)
```

### Service types

| Type | Reachable from | Typical use |
|---|---|---|
| `ClusterIP` (default) | Inside the cluster only | Internal communication between tiers |
| `NodePort` | Outside, via `NodeIP:NodePort` | Quick external access, labs |
| `LoadBalancer` | Outside, via a cloud load balancer | Production external access on cloud |
| `ExternalName` | Inside, resolves to an external DNS name | Alias to outside services |

Types build on each other: NodePort includes a ClusterIP; LoadBalancer includes a NodePort.

### NodePort in detail

```
 browser ──► NodeIP:30008 ──► Service port 80 ──► Pod targetPort 80
```

Three ports are involved:

| Field | Meaning |
|---|---|
| `targetPort` | Port on the Pod where the app listens |
| `port` | Port of the Service itself (inside the cluster) |
| `nodePort` | Port opened on every node, range **30000–32767** |

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  type: NodePort
  selector:
    app: web          # Pods with this label are backends
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30008
```

Only `port` is mandatory; `targetPort` defaults to `port`; `nodePort` is auto-assigned if omitted.

### How the Service finds Pods

Through the **selector** matched against Pod labels. Kubernetes keeps an Endpoints / EndpointSlice object listing the matching ready Pod IPs.

```bash
kubectl get endpoints web-service
kubectl get pods --show-labels
```

If there are multiple matching Pods across nodes, the Service load balances (random). The NodePort is opened on **every** node, even those not running the Pod.

### Commands

```bash
kubectl apply -f service.yaml
kubectl get svc
kubectl describe svc web-service
kubectl expose pod web --port=80 --target-port=80 --name=web-service
kubectl expose deployment web --port=80 --type=NodePort
curl http://<node-ip>:30008
```

### Troubleshooting

- `Endpoints: <none>`: selector doesn't match any Pod labels, or Pods aren't ready.
- Cannot reach NodePort: firewall or security group; check the node IP.
- Wrong `targetPort`: connection refused.

### CKA exam tips

- Memorise the port range 30000–32767.
- `kubectl expose` creates the Service and the selector for you.
- Always check endpoints when a Service doesn't work.

### Key takeaways

- Services provide stable access and load balancing.
- Selector decides backends; three port fields.
- NodePort exposes on every node.
