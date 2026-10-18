### Introduction

Where and how to run Kubernetes: laptop, on-premise, or cloud; self-managed or managed.

### Local / learning

| Tool | Notes |
|---|---|
| Minikube | Single-node VM or container |
| kind | Clusters in Docker containers, great for CI |
| k3s | Lightweight distribution |
| kubeadm | Bootstraps real clusters on Linux machines |
| Docker Desktop | Single-node built-in |

### Self-hosted (turnkey vs custom)

- **Turnkey**: you provision VMs, a tool configures the cluster (kubeadm, Kubespray, kops, OpenShift, Rancher).
- **Hosted / managed**: the provider runs the control plane (GKE, EKS, AKS, DigitalOcean). You manage workloads and sometimes workers.

| Choice | You manage | Pros | Cons |
|---|---|---|---|
| Self-managed on VMs | Everything | Full control | Operational work |
| Managed | Workloads + workers | Less ops, easy upgrades | Less control, cost |

### Choosing

Consider: team skills, cost, compliance, scale, vendor lock-in, upgrade and support needs.

### Key takeaways

- Learn with kubeadm; run production on managed services unless you need control.
