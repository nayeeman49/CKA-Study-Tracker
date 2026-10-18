### Introduction

Kubernetes originally had storage code built in for each backend. The **Container Storage Interface (CSI)** is a standard so any storage vendor can write a plugin without modifying Kubernetes.

### The three interfaces

| Interface | Standardises |
|---|---|
| CRI | Container runtimes (Docker, containerd, CRI-O) |
| CNI | Networking plugins |
| CSI | Storage plugins |

### What CSI defines

Remote procedure calls the orchestrator uses, such as `CreateVolume`, `DeleteVolume`, `ControllerPublishVolume`. The storage vendor implements them in a **CSI driver**, usually deployed as a controller Deployment plus a node DaemonSet.

```
 Kubernetes ──CSI RPC──► driver (Portworx, EBS, Ceph, NetApp...) ──► storage backend
```

### In practice

```bash
kubectl get csidrivers
kubectl get storageclass
kubectl -n kube-system get pods | grep csi
```

A StorageClass names the driver in `provisioner:`.

### Key takeaways

- CSI is the standard storage plugin API; it works with any container orchestrator.
