### Introduction

Reference material for the kubeadm installation: the official documentation (kubernetes.io "Installing kubeadm", "Creating a cluster with kubeadm") and the course repository.

### Useful commands for pre-flight

```bash
cat /sys/class/dmi/id/product_uuid
ip link
nc 127.0.0.1 6443 -zv
swapoff -a ; sed -i '/ swap / s/^/#/' /etc/fstab
lsmod | grep br_netfilter
```

### Documentation habit

In the exam the Kubernetes docs are allowed. Learn how to navigate to the kubeadm pages (search "kubeadm upgrade", "kubeadm init") quickly.

### How to use the docs in the exam

The Kubernetes documentation (kubernetes.io/docs) is available. Bookmark-style paths worth remembering:

| Task | Search for |
|---|---|
| Install / init cluster | "creating a cluster with kubeadm" |
| Upgrade | "upgrading kubeadm clusters" |
| ETCD backup | "operating etcd clusters" |
| NetworkPolicy | "network policies" |
| PV/PVC | "configure a pod to use a persistent volume" |
| Ingress | "ingress" |
| RBAC | "using RBAC authorization" |
| Static Pods | "create static pods" |

Practise reaching each page in under 30 seconds.
