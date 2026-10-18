### Introduction

Sometimes two processes must work together and share lifecycle, network and storage: a web server and a log shipper, for example. A multi-container Pod places them in one Pod.

### What containers in a Pod share

- Network: same IP, they reach each other on `localhost`.
- Storage: volumes can be mounted into several containers.
- Lifecycle: created and deleted together, scheduled on the same node.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-logger
spec:
  containers:
  - name: web
    image: nginx
    volumeMounts:
    - name: logs
      mountPath: /var/log/nginx
  - name: log-agent
    image: busybox
    command: ["sh","-c","tail -F /logs/access.log"]
    volumeMounts:
    - name: logs
      mountPath: /logs
  volumes:
  - name: logs
    emptyDir: {}
```

### Commands

```bash
kubectl get pods                        # READY 2/2
kubectl logs web-with-logger -c log-agent
kubectl exec -it web-with-logger -c web -- sh
kubectl describe pod web-with-logger
```

### Considerations

- Different containers cannot listen on the same port.
- Resources are per container; the Pod's total request is the sum.
- If one container crashes, only it restarts (per `restartPolicy`).
- Don't pack unrelated apps in one Pod; they can't scale independently.

### Key takeaways

- Use multi-container Pods for tightly coupled helpers sharing network and storage.
