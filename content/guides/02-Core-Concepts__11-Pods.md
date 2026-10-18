### Introduction

A Pod is the smallest deployable unit in Kubernetes. It wraps one or more containers that share networking and storage and are scheduled together onto one node. You rarely create bare Pods in production (you use Deployments), but everything else is built from them.

### Pod vs container

```
 Pod
┌──────────────────────────────────────────┐
│  shared network namespace (one IP)       │
│  shared volumes                          │
│  ┌────────────┐     ┌────────────┐       │
│  │ container  │     │ container  │       │
│  │  (main)    │     │ (sidecar)  │       │
│  └────────────┘     └────────────┘       │
└──────────────────────────────────────────┘
```

- Containers in a Pod share an IP address and can talk over `localhost`.
- They can share files through volumes.
- They live and die together. To scale, you add more Pods, not more containers in a Pod.
- Usually: one main container per Pod. Extra containers are helpers (sidecars, init containers).

### Creating a Pod

Imperative:

```bash
kubectl run nginx --image=nginx
kubectl run nginx --image=nginx --port=80 --labels="app=web,tier=frontend"
kubectl run busybox --image=busybox --command -- sleep 3600
```

Generate YAML without creating (very useful in the exam):

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
```

Declarative:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: web
spec:
  containers:
  - name: nginx
    image: nginx:1.27
    ports:
    - containerPort: 80
```

```bash
kubectl apply -f pod.yaml
```

The four required top-level fields in every Kubernetes object are `apiVersion`, `kind`, `metadata` and `spec`.

### Inspecting Pods

```bash
kubectl get pods
kubectl get pods -o wide                 # node and IP
kubectl describe pod nginx               # events, state, reasons
kubectl logs nginx
kubectl logs nginx -c sidecar            # specific container
kubectl exec -it nginx -- /bin/sh
kubectl get pod nginx -o yaml
```

### Pod lifecycle and phases

| Phase | Meaning |
|---|---|
| Pending | Accepted but not running: waiting for scheduling or image pull |
| Running | At least one container is running |
| Succeeded | All containers exited successfully (Jobs) |
| Failed | A container exited with an error |
| Unknown | Node unreachable |

Container states: `Waiting`, `Running`, `Terminated`.

### Common statuses and what they mean

| Status | Typical cause | First command |
|---|---|---|
| `Pending` | No node fits, no scheduler | `describe pod` |
| `ContainerCreating` | Pulling image, volume or CNI issue | `describe pod` |
| `ImagePullBackOff` / `ErrImagePull` | Wrong name/tag, private registry | `describe pod` |
| `CrashLoopBackOff` | Container keeps exiting | `logs --previous` |
| `CreateContainerConfigError` | Missing ConfigMap/Secret | `describe pod` |
| `Error` / `OOMKilled` | Crash or out of memory | `describe pod` |

### Editing a Pod

Most Pod fields are immutable. You can change only: `image`, `activeDeadlineSeconds`, `tolerations`, and appended ones. To change others:

```bash
kubectl edit pod nginx          # on rejection, a copy is saved in /tmp
kubectl replace --force -f /tmp/kubectl-edit-xxxx.yaml
# or
kubectl get pod nginx -o yaml > pod.yaml ; vi pod.yaml
kubectl delete pod nginx ; kubectl apply -f pod.yaml
```

### Deleting

```bash
kubectl delete pod nginx
kubectl delete pod nginx --force --grace-period=0   # only when stuck
```

A bare Pod that is deleted is gone for good. Pods managed by a ReplicaSet or Deployment are recreated.

### Restart policy

`restartPolicy` is `Always` (default), `OnFailure` or `Never`, and applies to all containers in the Pod.

```bash
kubectl run job-pod --image=busybox --restart=Never -- echo hi
```

### Why Pods are not enough

Pods don't self-heal after a node failure, can't scale, and can't be updated in a controlled way. Next you meet ReplicaSets and Deployments for that.

### CKA exam tips

- `kubectl run x --image=y --dry-run=client -o yaml` is the fastest way to write Pod YAML.
- Set the namespace with `-n` or by changing the context namespace.
- `kubectl explain pod.spec` shows fields without leaving the terminal.

### Key takeaways

- A Pod is one or more containers sharing network and storage.
- Create with `kubectl run` or YAML with `apiVersion/kind/metadata/spec`.
- Debug with `describe`, `logs`, `exec`.
