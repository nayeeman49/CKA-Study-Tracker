### Introduction

Pods consume claims by referencing them in `volumes`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - mountPath: "/var/www/html"
      name: mypd
  volumes:
  - name: mypd
    persistentVolumeClaim:
      claimName: myclaim
```

The same works for ReplicaSets and Deployments (in the Pod template). The PVC must be in the same namespace as the Pod.

### Check

```bash
kubectl get pod mypod
kubectl describe pod mypod       # Volumes section, events
kubectl exec mypod -- df -h /var/www/html
kubectl exec mypod -- sh -c 'echo hi > /var/www/html/x'
```

### Troubleshooting

- Pod `Pending`: unbound PVC or no schedulable node for the volume.
- `ContainerCreating`: mount failure; see events.
- Data gone: you used `emptyDir` or the PV was `Delete`/hostPath on another node.

### Key takeaways

- Pod → PVC → PV → storage.
