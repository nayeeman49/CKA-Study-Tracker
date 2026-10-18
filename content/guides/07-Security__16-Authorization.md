### Introduction

Once authenticated, the API Server must decide whether the identity can perform an action. Authorization restricts users to the minimum permissions they need.

### Mechanisms

| Mode | Description |
|---|---|
| **Node** | Authorises kubelets (identities `system:node:<name>` in group `system:nodes`) to read what their Pods need |
| **ABAC** | Policy file of user/action pairs; must restart API Server to change; not recommended |
| **RBAC** | Roles bound to users/groups/service accounts; standard |
| **Webhook** | Ask an external service |
| AlwaysAllow / AlwaysDeny | Testing |

Set with:

```
--authorization-mode=Node,RBAC,Webhook
```

Modes are evaluated **in order**; the first that approves or denies decides. `Node` is checked first. If a mode says "no opinion", the next one is consulted. If none approve, the request is denied.

### Check the current mode

```bash
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep authorization-mode
ps -aux | grep kube-apiserver | grep authorization
```

### Testing

```bash
kubectl auth can-i create deployments
kubectl auth can-i delete nodes
kubectl auth can-i create pods --as dev-user
kubectl auth can-i create pods --as dev-user --namespace test
kubectl auth can-i --list
```

### Key takeaways

- Node,RBAC is the kubeadm default.
- `kubectl auth can-i` verifies permissions.
