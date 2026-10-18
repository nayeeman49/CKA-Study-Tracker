### Introduction

Role-Based Access Control grants permissions to roles, then binds roles to subjects (users, groups, service accounts).

```
 Subject ◄── RoleBinding ──► Role ──► rules (apiGroups, resources, verbs)
```

### Role (namespaced)

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["list","get","create","update","delete"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["create"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  resourceNames: ["web"]          # restrict to specific objects
  verbs: ["get","update"]
```

Imperative:

```bash
kubectl create role developer --verb=list,get,create --resource=pods -n default
kubectl create role dev --verb=get --resource=pods --resource-name=blue,orange
```

### RoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: devuser-developer-binding
  namespace: default
subjects:
- kind: User
  name: dev-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl create rolebinding devuser-developer-binding --role=developer --user=dev-user
kubectl create rolebinding x --role=developer --group=devs
kubectl create rolebinding x --role=developer --serviceaccount=default:sa1
```

### Inspect

```bash
kubectl get roles
kubectl get rolebindings
kubectl describe role developer
kubectl describe rolebinding devuser-developer-binding
kubectl auth can-i create pods --as dev-user
```

### Key rules

- Roles and RoleBindings are **namespaced** and apply in their namespace only.
- Permissions are additive (no deny rules).
- `roleRef` is immutable after creation.
- A Pod can't get more rights than its service account.

### Troubleshooting

- "forbidden: User ... cannot list resource": missing role/binding, wrong namespace, wrong apiGroup, wrong verb.
- Mismatch between `kind: User` name and certificate CN.

### Key takeaways

- Role (what) + RoleBinding (who).
