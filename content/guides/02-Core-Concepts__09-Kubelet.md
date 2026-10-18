### Introduction

The kubelet is the agent on every node. It is the only Kubernetes component that is *not* normally run as a Pod, because it is the thing that runs Pods. It registers its node with the cluster, receives Pod specs from the API Server, tells the container runtime to run them, and reports back status.

```
 API Server ◄──── status, heartbeat ──── kubelet ───CRI───► containerd
            ───── PodSpecs ───────────►     │
                                            ├──► CNI plugin (Pod network)
                                            └──► CSI plugin (volumes)
```

### What the kubelet does

1. **Registers the node** with the API Server on startup.
2. **Watches** for Pods assigned to its node.
3. **Creates containers** through the runtime (CRI), sets up networking (CNI) and volumes.
4. **Monitors** the Pods: runs liveness, readiness and startup probes, restarts failed containers.
5. **Reports** Pod and node status, and sends heartbeats (node `Lease` objects).
6. Runs **static Pods** from a local folder without needing the API Server.
7. Applies **resource limits** (via cgroups), garbage-collects images and containers, and evicts Pods under node pressure.

### Installing

kubeadm installs the kubelet package for you. It is always a **systemd service** on the node, never a Pod.

```bash
systemctl status kubelet
journalctl -u kubelet --no-pager | tail -50
ps -aux | grep kubelet
```

Note: a cluster built by hand does not install the kubelet automatically on workers. With kubeadm, `kubeadm join` configures it.

### Configuration

| File | Purpose |
|---|---|
| `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` | Systemd drop-in with flags and paths |
| `/var/lib/kubelet/config.yaml` | KubeletConfiguration (e.g. `staticPodPath`, `clusterDNS`, `cgroupDriver`, authentication) |
| `/etc/kubernetes/kubelet.conf` | kubeconfig: how it reaches the API Server |
| `/var/lib/kubelet/kubeadm-flags.env` | Extra flags (runtime socket, etc.) |
| `/etc/kubernetes/pki/ca.crt` | Cluster CA for verifying the API Server |

Check the effective settings on a node:

```bash
ps -aux | grep kubelet           # flags on the command line
cat /var/lib/kubelet/config.yaml
```

### Static Pods

`staticPodPath` in the kubelet config (usually `/etc/kubernetes/manifests`) is watched. Any Pod YAML placed there is started by the kubelet itself. That's how kubeadm runs the control plane. (Covered fully in the Scheduling section.)

### Verifying the node

```bash
kubectl get nodes
kubectl describe node node01      # conditions, capacity, allocatable, Pods
```

Conditions to know: `Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`, `NetworkUnavailable`.

### Troubleshooting a node

If a node is `NotReady`:

```bash
ssh node01
systemctl status kubelet
journalctl -u kubelet -f
systemctl restart kubelet
systemctl enable kubelet
```

Typical causes:

- kubelet service stopped or disabled.
- Wrong path to certificates or kubeconfig in `/etc/kubernetes/kubelet.conf`.
- Wrong CA, or the API Server address changed.
- The container runtime is not running (`systemctl status containerd`).
- Swap enabled (kubelet refuses to start by default).
- `cgroupDriver` mismatch between kubelet and runtime.
- Disk full.

### CKA exam tips

- Kubelet is not in `kubectl get pods -n kube-system` because it is a service.
- The first things to check on a `NotReady` node are `systemctl status kubelet` and `journalctl -u kubelet`.
- `/var/lib/kubelet/config.yaml` is where `staticPodPath` lives.

### Key takeaways

- Kubelet is the node agent: registers the node, runs Pods, reports status.
- It runs as a systemd service.
- Node problems usually start with the kubelet and the runtime.
