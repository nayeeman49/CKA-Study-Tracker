# CRDs and Operators

Curriculum item: "Understand CRDs, install and configure operators."

## Custom Resource Definitions
A **CRD** teaches the API server a new resource type; instances are **custom resources (CRs)**. They are stored in etcd, served by the API (so `kubectl get`, RBAC and watches work), but do nothing by themselves.
```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata: {name: backups.example.com}   # <plural>.<group>
spec:
  group: example.com
  scope: Namespaced
  names: {plural: backups, singular: backup, kind: Backup, shortNames: [bk]}
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
```
kubectl get crd
kubectl explain backup.spec
kubectl api-resources | grep example.com
```
Exactly one version has `storage: true`. A CR missing a required schema field is rejected on create.

## Operators
An **operator** = CRDs + a **controller** that watches the CRs and drives the cluster to the desired state, encoding operational knowledge (provision a database, take backups, upgrade). The controller itself is a Deployment with RBAC.
Installing an operator typically means: apply CRDs → apply controller Deployment/RBAC (a manifest, Helm chart or OLM subscription) → create a CR → watch the controller create the Pods/Services.
Troubleshoot like any app: operator Pod logs, `kubectl describe` on the CR (look at `status` and Events), and whether CRDs are installed (`kubectl get crd`).

## Exam tips
- "List all CRDs" or "get a CR by short name" → `kubectl get crd`, `kubectl get <kind>`.
- Deleting a CRD **deletes all its custom resources**.

## Official documentation
- [Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/)
- [Operator pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)
