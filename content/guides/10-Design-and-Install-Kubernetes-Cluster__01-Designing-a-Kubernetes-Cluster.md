### Introduction

Before building a cluster, decide what it is for, how big it must be, and what it will run. The design drives the infrastructure choice, node sizes and high-availability needs.

### Purpose

| Purpose | Suggested setup |
|---|---|
| Education / learning | Minikube, kind, k3s, or a single-node kubeadm cluster on a laptop or cloud VM |
| Development / testing | Multi-node cluster, one control plane, several workers; managed service is fine |
| Production hosting | HA control plane (3 nodes), multiple workers, monitoring, backups |

### Production guidance

- Up to **5,000 nodes**, **150,000 Pods**, **300,000 containers**, **100 Pods per node** are the documented upper limits.
- HA: multiple control plane nodes, ideally across failure zones.
- Workers: size to the workload (CPU, memory, disk type, network).
- Use SSD-backed disks for ETCD; consider running ETCD on dedicated nodes for big clusters.

### Workload considerations

| Workload | Needs |
|---|---|
| CPU/memory heavy | Large instances, dedicated node pools, taints |
| Disk intensive | SSD, local storage, fast StorageClasses |
| GPU | GPU nodes with device plugin, taints/tolerations |
| Many small Pods | Many medium nodes |

### Node basics

- 64-bit Linux, a supported container runtime (containerd).
- Control plane nodes do not run workloads (taints).
- Master nodes can host ETCD (stacked) or use external ETCD.

### Key takeaways

- Define purpose, scale, and workload type first; the answers decide the rest.
