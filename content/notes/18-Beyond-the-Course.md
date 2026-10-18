## Why this section exists
The course repo was written for an older exam. The current CKA curriculum (v1.35) also expects:
- **Helm and Kustomize** to install cluster components
- **Gateway API** for ingress traffic
- **Workload autoscaling** (HPA)
- **CRDs and operators**
- **Extension interfaces** (CNI, CSI, CRI)
These five short lessons fill the gaps. Treat them as required, since each can appear as an exam task.

## How to study these
Do each one **hands-on** after reading: install a chart with Helm and roll it back, kustomize an overlay, route traffic through an HTTPRoute, scale a Deployment with an HPA under load, write a tiny CRD and create a CR, and use `crictl` on a node.

## Official documentation
- [Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/), [Helm docs](https://helm.sh/docs/)
- [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
- [Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/), [Operator pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)
- [CKA curriculum (CNCF GitHub)](https://github.com/cncf/curriculum)
