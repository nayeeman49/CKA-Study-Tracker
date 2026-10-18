### Introduction

Before upgrading you need to understand how versions work and what is supported.

### Version numbers

```
  v1.31.2
   │  │  └─ patch  (bug fixes, security)
   │  └──── minor  (new features, ~every 4 months)
   └─────── major
```

Minor releases are roughly three per year. Kubernetes supports the latest **three** minor versions.

### Component versions

All control plane components are released together with the same version, but ETCD and CoreDNS have their own versions.

```bash
kubectl version
kubectl get nodes                # VERSION column is the kubelet version
kubeadm version
```

### Version skew policy

The API Server is the reference, newest of all components.

| Component | Allowed versions relative to kube-apiserver (X) |
|---|---|
| kube-controller-manager, kube-scheduler | X or X-1 |
| kubelet, kube-proxy | X, X-1 or X-2 (never newer) |
| kubectl | X+1, X, X-1 |
| Multiple API servers (HA) | Within one minor |

Example: API server 1.31 → controller manager 1.31 or 1.30; kubelets 1.31, 1.30, 1.29; kubectl 1.32, 1.31, 1.30.

### Upgrade rules

- Upgrade **one minor version at a time** (1.29 → 1.30 → 1.31). Skipping minor versions is not supported.
- Upgrade the control plane first, then worker nodes.
- Patch upgrades can skip patches (1.31.0 → 1.31.4).

### Key takeaways

- Never run a component newer than the API Server (except kubectl +1).
- Minor versions must be stepped through sequentially.
