### Introduction

Some resources are cluster-scoped (nodes, PVs, namespaces), and sometimes you want rights across all namespaces. For those use ClusterRole and ClusterRoleBinding.

### Namespaced vs cluster-scoped

```bash
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
```

### ClusterRole

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-admin
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get","watch","list","create","delete"]
```

### ClusterRoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-admin-binding
subjects:
- kind: User
  name: cluster-admin-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-admin
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl create clusterrole node-admin --verb=get,list,watch --resource=nodes
kubectl create clusterrolebinding node-admin-binding --clusterrole=node-admin --user=michelle
```

### Cluster role with a RoleBinding

A RoleBinding can reference a ClusterRole to grant its permissions **inside one namespace** (reuse of common roles).

### Built-in cluster roles

`cluster-admin`, `admin`, `edit`, `view`, plus system roles (`system:node`, `system:kube-scheduler`...).

```bash
kubectl get clusterroles | wc -l
kubectl describe clusterrole view
```

### Key takeaways

- ClusterRole + ClusterRoleBinding = cluster-wide access.
