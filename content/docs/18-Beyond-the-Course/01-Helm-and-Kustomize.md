# Helm and Kustomize

Both are in the v1.35 CKA curriculum ("Use Helm and Kustomize to install cluster components") but are not covered by the course repo.

## Helm
Helm is a package manager. A **chart** is a bundle of templated manifests plus default `values.yaml`; a **release** is an installed instance of a chart in a cluster; a **repository** hosts charts.

```
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo nginx
helm show values bitnami/nginx > values.yaml
helm install web bitnami/nginx -n demo --create-namespace -f values.yaml --set replicaCount=2
helm list -A
helm upgrade web bitnami/nginx -n demo --set replicaCount=3
helm history web -n demo
helm rollback web 1 -n demo
helm uninstall web -n demo
helm template web bitnami/nginx > rendered.yaml    # render locally, no install
```
- Values precedence: chart defaults < `-f file` (later files win) < `--set`.
- `helm get values|manifest <release>` shows what was applied; `helm lint` and `helm template` debug charts.
- Release state is stored as Secrets in the release namespace.

## Kustomize
Kustomize customises plain YAML **without templates**, built into kubectl: `kubectl apply -k <dir>` and `kubectl kustomize <dir>` (render only).

```yaml
# base/kustomization.yaml
resources: [deployment.yaml, service.yaml]
# overlays/prod/kustomization.yaml
resources: [../../base]
namePrefix: prod-
namespace: production
commonLabels: {env: prod}
images:
- name: nginx
  newTag: "1.27"
patches:
- path: replicas-patch.yaml
configMapGenerator:
- name: app-config
  literals: [MODE=prod]
```
Typical exam task: apply an overlay, change an image/replica count/namespace, or add a patch, then verify with `kubectl get -k`.

## Which to use
Helm for third-party software with many knobs and release lifecycle (install/upgrade/rollback); Kustomize for environment variants of your own manifests. They combine: `helm template ... | kubectl kustomize`.

## Official documentation
- [Declarative Management using Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Helm documentation: Using Helm](https://helm.sh/docs/intro/using_helm/) and [Helm commands](https://helm.sh/docs/helm/)
