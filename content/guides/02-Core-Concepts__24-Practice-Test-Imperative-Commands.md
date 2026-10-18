### How to approach this lab

The lab drills the shortcuts from the previous lesson. Aim for speed and accuracy.

### Task patterns and answers

```bash
# Deploy a pod named nginx-pod using the nginx:alpine image
kubectl run nginx-pod --image=nginx:alpine

# Deploy a redis pod with label tier=db
kubectl run redis --image=redis:alpine --labels="tier=db"

# Create a service redis-service to expose the redis pod on port 6379
kubectl expose pod redis --port=6379 --name=redis-service

# Create a deployment webapp with image kodekloud/webapp-color and 3 replicas
kubectl create deployment webapp --image=kodekloud/webapp-color --replicas=3

# Create a pod custom-nginx with port 8080 exposed
kubectl run custom-nginx --image=nginx --port=8080

# Create namespace dev-ns and a deployment redis-deploy in it
kubectl create ns dev-ns
kubectl create deployment redis-deploy --image=redis -n dev-ns --replicas=2

# Create a pod httpd with image httpd:alpine and expose it as a ClusterIP service on port 80
kubectl run httpd --image=httpd:alpine --port=80 --expose
```

### Verify everything

```bash
kubectl get pods --show-labels
kubectl get svc
kubectl get endpoints redis-service
kubectl get deploy
```

### Tips

- If the service created by `expose pod` shows no endpoints, check that the Pod has labels (a `kubectl run` Pod gets `run=<name>`).
- For fields not available imperatively, generate YAML and edit.
