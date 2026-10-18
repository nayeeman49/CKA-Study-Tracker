### Introduction

Two ways to manage Kubernetes manifests: **Helm** (a package manager with templates) and **Kustomize** (patch-based customisation built into kubectl). Both are part of the current CKA syllabus.

### Helm

A **chart** is a package of templated manifests. A **release** is an installed instance of a chart. **Repositories** host charts.

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo nginx
helm install my-web bitnami/nginx
helm install my-web bitnami/nginx --set replicaCount=3 -n web --create-namespace
helm install my-web bitnami/nginx -f values.yaml
helm list -A
helm status my-web
helm get values my-web
helm upgrade my-web bitnami/nginx --set replicaCount=5
helm history my-web
helm rollback my-web 1
helm uninstall my-web
helm template my-web bitnami/nginx > out.yaml        # render only
helm pull bitnami/nginx --untar
```

Chart layout:

```
mychart/
  Chart.yaml        name, version
  values.yaml       defaults
  templates/        deployment.yaml uses {{ .Values.replicaCount }}
```

Precedence for values: `--set` > `-f file` > chart `values.yaml`.

### Kustomize

Customises plain YAML without templates, using a `kustomization.yaml`.

```
app/
  base/
    deployment.yaml
    service.yaml
    kustomization.yaml
  overlays/
    prod/
      kustomization.yaml
```

```yaml
# base/kustomization.yaml
resources:
- deployment.yaml
- service.yaml
```

```yaml
# overlays/prod/kustomization.yaml
resources:
- ../../base
namePrefix: prod-
namespace: production
commonLabels:
  env: prod
replicas:
- name: web
  count: 5
images:
- name: nginx
  newTag: "1.27"
patches:
- path: patch-resources.yaml
```

```bash
kubectl kustomize overlays/prod       # render
kubectl apply -k overlays/prod
kubectl delete -k overlays/prod
```

### Helm vs Kustomize

| | Helm | Kustomize |
|---|---|---|
| Approach | Templates + values | Overlays/patches on plain YAML |
| Packaging/versioning | Yes (charts, releases) | No |
| Rollback | `helm rollback` | Git/`kubectl rollout` |
| Built in | Separate binary | In kubectl |

### Key takeaways

- Know basic `helm install/upgrade/rollback/uninstall` and `kubectl apply -k`.
