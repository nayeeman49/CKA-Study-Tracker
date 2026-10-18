### How to approach this lab

Deployments sit on top of ReplicaSets, so most answers come from `kubectl get all` and `describe`.

### Commands

```bash
kubectl get deployments
kubectl get all
kubectl describe deployment <name>       # strategy, image, replicas, events
kubectl get rs
kubectl create deployment http-frontend --image=httpd:2.4-alpine --replicas=3
kubectl create deployment x --image=nginx --dry-run=client -o yaml > d.yaml
kubectl scale deployment <name> --replicas=N
kubectl set image deployment/<name> <container>=<image>
kubectl delete deployment <name>
```

### Typical questions

| Question | How to find it |
|---|---|
| How many Deployments/ReplicaSets/Pods? | `kubectl get all` |
| Image used by a Deployment's Pods? | `kubectl describe deployment x \| grep Image` |
| Why is the Deployment not READY? | Check the Pod events; usually a wrong image tag |
| Create a Deployment with N replicas | `kubectl create deployment NAME --image=IMG --replicas=N` |
| Delete a Pod, what happens? | The ReplicaSet recreates it |

### Fixing a Deployment with a wrong YAML

Common mistakes in provided files: `kind: Deployment` written as `Deployment` in lowercase, `apiVersion: v1` instead of `apps/v1`, missing `selector`, template labels not matching selector.

```bash
kubectl apply -f deployment-definition-1.yaml
kubectl explain deployment.spec.selector
```

### Tips

- Pods created by a Deployment have names with two hash segments.
- To change an image in the Deployment use `kubectl set image` or `kubectl edit deployment`; both cause a rolling update.
- Always look at `kubectl rollout status` if updates seem slow.
