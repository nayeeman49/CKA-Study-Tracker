# Extension Interfaces: CNI, CSI, CRI

Curriculum item: "Understand extension interfaces (CNI, CSI, CRI, etc.)". Kubernetes defines interfaces so vendors can plug in implementations without changing core code.

| Interface | Plugs in | Called by | Examples | Where to look |
|---|---|---|---|---|
| **CRI** Container Runtime Interface | Container runtime | kubelet (gRPC) | containerd, CRI-O | `crictl`, `/run/containerd/containerd.sock`, kubelet `--container-runtime-endpoint` |
| **CNI** Container Network Interface | Pod networking | the runtime, when a Pod sandbox starts | Calico, Cilium, Flannel, Weave | `/etc/cni/net.d`, `/opt/cni/bin` |
| **CSI** Container Storage Interface | Storage | kubelet + external controllers (sidecars) | EBS, Ceph, NFS CSI drivers | `kubectl get csidrivers,storageclass`, driver Pods in `kube-system` |
| **CCM** Cloud Controller Manager | Cloud integration | control plane | AWS/GCP/Azure | cloud-controller-manager Pod |
| **SMI / device plugins** | GPUs, special hardware | kubelet | NVIDIA device plugin | `kubectl describe node` (allocatable `nvidia.com/gpu`) |

## CRI in practice
`crictl ps`, `crictl pods`, `crictl images`, `crictl logs <id>`, `crictl inspect` work against the node's runtime and are essential when the API server is down. Configure the endpoint in `/etc/crictl.yaml`.

## CNI in practice
When a Pod starts, the runtime executes the plugin named in the first config file in `/etc/cni/net.d`, which allocates an IP, creates the veth pair and sets routes. Symptoms of CNI problems: nodes `NotReady` ("network plugin not ready"), Pods stuck `ContainerCreating` with `failed to set up sandbox`. To install one on a kubeadm cluster apply its manifest (matching `--pod-network-cidr`). Only some CNIs enforce NetworkPolicy.

## CSI in practice
A CSI driver has a controller plugin (create/attach volumes) and a node plugin (mount); StorageClass `provisioner` names the driver. PVCs stay Pending if the driver Pods are not running.

## Official documentation
- [Container Runtimes](https://kubernetes.io/docs/setup/production-environment/container-runtimes/), [CRI](https://kubernetes.io/docs/concepts/containers/cri/)
- [Network Plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
- [Volumes: CSI](https://kubernetes.io/docs/concepts/storage/volumes/#csi) and [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [Extending Kubernetes](https://kubernetes.io/docs/concepts/extend-kubernetes/)
