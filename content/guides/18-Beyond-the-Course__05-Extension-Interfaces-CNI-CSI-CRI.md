### Introduction

Kubernetes stays small by defining standard interfaces that vendors plug into.

| Interface | Plugs in | Examples | Config location |
|---|---|---|---|
| **CRI** Container Runtime Interface | Container runtimes | containerd, CRI-O | kubelet `--container-runtime-endpoint` |
| **CNI** Container Network Interface | Pod networking | Calico, Cilium, Flannel, Weave | `/etc/cni/net.d`, `/opt/cni/bin` |
| **CSI** Container Storage Interface | Storage | EBS, Ceph, NetApp, local-path | CSIDriver, StorageClass |

```
 kubelet ──CRI──► containerd ──► runc
    │──CNI──► network plugin (Pod IPs, routes)
    └──CSI──► storage driver (attach/mount volumes)
```

### CRI

gRPC API with RuntimeService (Pods, containers) and ImageService (images). `crictl` talks to it.

```bash
crictl --runtime-endpoint unix:///run/containerd/containerd.sock ps
```

### CNI

Plugins executed by the runtime on Pod create/delete (ADD/DEL). Check with `ls /etc/cni/net.d`.

### CSI

Drivers run as a controller (provisioning/attach) plus a node plugin (mount) with sidecars.

```bash
kubectl get csidrivers
kubectl get storageclass
```

### Other extension points

- Device plugins (GPUs), admission webhooks, scheduler plugins, API aggregation, CRDs and operators.

### Key takeaways

- CRI = runtime, CNI = network, CSI = storage; each swappable.
