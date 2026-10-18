### How to approach this lab

Questions ask for Service details and for creating Services that expose Deployments.

### Commands

```bash
kubectl get svc
kubectl describe svc kubernetes
kubectl get endpoints <svc>
kubectl get svc -o wide                       # selector column
kubectl expose deployment simple-webapp-deployment --name=webapp-service --target-port=8080 --type=NodePort --port=8080
kubectl create service nodeport webapp --tcp=8080:8080 --node-port=30080
```

### Typical questions

| Question | How |
|---|---|
| How many Services? | `kubectl get svc` |
| What is the Type/targetPort/Endpoints of Service X? | `kubectl describe svc X` |
| How many labels does the selector have? | `describe svc` Selector line |
| Create a Service for a Deployment | `kubectl expose` |
| Set a specific nodePort | `expose` can't set it. Generate YAML with `--dry-run=client -o yaml`, add `nodePort`, apply |

### Setting nodePort

```bash
kubectl expose deployment web --port=8080 --target-port=8080 --type=NodePort --dry-run=client -o yaml > svc.yaml
vi svc.yaml       # add nodePort: 30080 under ports
kubectl apply -f svc.yaml
```

### Tips

- The built-in `kubernetes` Service in default points to the API Server.
- Check `kubectl get endpoints` to confirm Pods are selected.
- `expose` copies the selector from the target resource.
