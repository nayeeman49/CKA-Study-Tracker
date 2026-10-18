### Introduction

All Kubernetes capabilities are exposed through the REST API, organised into groups. Understanding groups is needed for RBAC rules (`apiGroups`).

### Two categories

| Category | Path | Resources |
|---|---|---|
| Core (legacy) | `/api/v1` | pods, namespaces, nodes, services, configmaps, secrets, PV, PVC, events |
| Named | `/apis/<group>/<version>` | apps, batch, networking.k8s.io, rbac.authorization.k8s.io, storage.k8s.io, certificates.k8s.io, policy, autoscaling |

```
/api/v1/pods
/apis/apps/v1/deployments
/apis/networking.k8s.io/v1/networkpolicies
/apis/certificates.k8s.io/v1/certificatesigningrequests
```

Within each group are **resources** and **verbs** (`list, get, create, delete, update, patch, watch`).

### Discovering

```bash
kubectl api-resources -o wide              # kind, group, namespaced, verbs
kubectl api-resources --api-group=apps
kubectl api-versions
curl http://localhost:8001/apis | grep name
kubectl proxy 8001 &
```

### Versions

`v1` (stable), `v1beta1` (beta, may change), `v1alpha1` (alpha, disabled by default). Preferred version is chosen by the API Server.

### Why it matters

An RBAC rule must name the right group:

```yaml
rules:
- apiGroups: [""]           # core group is the empty string
  resources: ["pods"]
  verbs: ["get","list"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["create"]
```

### Key takeaways

- Core group is `""`; others have names; check with `kubectl api-resources`.
