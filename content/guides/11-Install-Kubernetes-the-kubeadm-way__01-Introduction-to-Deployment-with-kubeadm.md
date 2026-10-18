### Introduction

`kubeadm` is the official tool for bootstrapping a Kubernetes cluster on existing machines. It automates certificates, static Pod manifests, and join tokens. It does not provision machines or install a network plugin.

### The process

```
 1. Provision machines (VMs)
 2. Install a container runtime (containerd) + kubeadm, kubelet, kubectl on ALL nodes
 3. kubeadm init   on the control plane node
 4. Install a CNI (Pod network) add-on
 5. kubeadm join   on each worker node
```

### Prerequisites

- 2 CPU, 2 GB RAM minimum per machine for control plane (more for production).
- Unique hostname, MAC address and product_uuid.
- Required ports open (6443, 10250, 2379-2380, 30000-32767).
- Swap disabled.
- Kernel modules `overlay`, `br_netfilter` and sysctl settings for bridged traffic.

### Key takeaways

- kubeadm sets up Kubernetes components; you provide machines, runtime and CNI.
