### Introduction

**Custom Resource Definitions (CRDs)** extend the API with your own object types. **Operators** are controllers that manage those objects, encoding operational knowledge (install, backup, upgrade) in software.

### CRD

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.example.com        # <plural>.<group>
spec:
  group: example.com
  scope: Namespaced
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: ["bk"]
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              schedule: {type: string}
              retention: {type: integer}
```

```yaml
apiVersion: example.com/v1
kind: Backup
metadata:
  name: nightly
spec:
  schedule: "0 2 * * *"
  retention: 7
```

```bash
kubectl get crd
kubectl explain backup.spec
kubectl get backups
kubectl describe crd backups.example.com
```

A CRD by itself only stores data in ETCD; nothing acts on it without a controller.

### Operators

```
 Custom Resource (desired state) ──► Operator (controller) ──► creates Deployments, PVCs, Jobs...
```

Examples: Prometheus Operator, cert-manager, Postgres operators, Argo CD. Installed via manifests or Helm; they bring their own CRDs and RBAC.

### Troubleshooting

- `no matches for kind`: CRD not installed.
- Resource accepted but nothing happens: operator Pod not running.
- Deleting a CRD deletes all its resources.

### Key takeaways

- CRD = new API kind; operator = controller that acts on it.
