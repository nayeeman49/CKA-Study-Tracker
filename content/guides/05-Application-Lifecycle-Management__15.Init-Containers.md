### Introduction

Init containers run **before** the app containers and must finish successfully, one after another, before the main containers start. They're ideal for setup work.

### Use cases

- Wait for a service/database to be ready.
- Clone a repository or download files into a shared volume.
- Register the Pod with a remote service.
- Set permissions or run migrations.

### YAML

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: myapp-container
    image: busybox:1.28
    command: ['sh','-c','echo The app is running! && sleep 3600']
  initContainers:
  - name: init-myservice
    image: busybox
    command: ['sh','-c','until nslookup myservice; do echo waiting for myservice; sleep 2; done']
  - name: init-mydb
    image: busybox
    command: ['sh','-c','until nslookup mydb; do echo waiting for mydb; sleep 2; done']
```

### Behaviour

```
 init-1 ─► init-2 ─► (all ok) ─► app containers start
   fail ─► retried according to restartPolicy; Pod stuck in Init:N/M
```

Pod statuses: `Init:0/2`, `Init:Error`, `Init:CrashLoopBackOff`, then `PodInitializing`, `Running`.

### Debugging

```bash
kubectl get pod myapp-pod
kubectl describe pod myapp-pod
kubectl logs myapp-pod -c init-myservice
```

### Notes

- Init containers don't support readiness probes.
- They can have different images and permissions than the app.
- Resources: the effective request is the max of init containers or sum of app containers, whichever is larger.

### Key takeaways

- Sequential, run-to-completion, before app containers.
