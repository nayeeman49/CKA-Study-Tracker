### Introduction

A security context sets privilege and access control for a Pod or container: which user runs the process, Linux capabilities, filesystem restrictions.

### Pod level vs container level

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
spec:
  securityContext:              # applies to all containers
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
  - name: ubuntu
    image: ubuntu
    command: ["sleep","3600"]
    securityContext:            # overrides pod level for this container
      runAsUser: 1001
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        add: ["NET_ADMIN","SYS_TIME"]
        drop: ["ALL"]
```

**Capabilities** are only supported at the container level.

### Common fields

| Field | Meaning |
|---|---|
| `runAsUser`, `runAsGroup` | UID/GID of the process |
| `runAsNonRoot: true` | Refuse to start as root |
| `fsGroup` | Group owning mounted volumes |
| `privileged: true` | Nearly all host access (avoid) |
| `allowPrivilegeEscalation` | Block setuid gaining more privileges |
| `readOnlyRootFilesystem` | Immutable root filesystem |
| `capabilities` | Add/drop Linux capabilities |
| `seccompProfile`, `seLinuxOptions` | Kernel-level restrictions |

### Verify

```bash
kubectl exec web-pod -- whoami
kubectl exec web-pod -- id
kubectl exec web-pod -- ps aux
```

### Pod Security Standards

Namespace labels enforce `privileged`, `baseline`, or `restricted` profiles:

```bash
kubectl label ns dev pod-security.kubernetes.io/enforce=restricted
```

### Key takeaways

- Run as non-root, drop capabilities, read-only filesystem.
