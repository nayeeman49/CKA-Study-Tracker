### Introduction

How Kubernetes finds and calls the CNI plugin.

### Who invokes CNI

The container runtime (containerd/CRI-O) creates the Pod sandbox and calls the CNI plugin. The kubelet provides the configuration via the runtime settings.

### Where it's configured

```
/opt/cni/bin/               plugin executables (bridge, host-local, flannel, ...)
/etc/cni/net.d/             configuration files (first file alphabetically is used)
```

```bash
ls /opt/cni/bin
ls /etc/cni/net.d
cat /etc/cni/net.d/10-flannel.conflist
```

### A config

```json
{
  "cniVersion": "0.3.1",
  "name": "mynet",
  "type": "bridge",
  "bridge": "cni0",
  "isGateway": true,
  "ipMasq": true,
  "ipam": {
    "type": "host-local",
    "subnet": "10.244.0.0/16",
    "routes": [{ "dst": "0.0.0.0/0" }]
  }
}
```

The `type` is the plugin, `ipam` decides IP allocation, `isGateway` gives the bridge an IP, `ipMasq` enables NAT for outside access.

### Check which plugin runs

```bash
ps aux | grep kubelet           # container-runtime-endpoint
kubectl -n kube-system get pods # weave-net / calico / flannel
```

### Troubleshooting

- Nodes `NotReady` with "network plugin not ready: cni config uninitialized": no CNI installed.
- Pods stuck in `ContainerCreating` with errors about CNI: plugin Pods not running, or config missing.

### Key takeaways

- Binaries in `/opt/cni/bin`, config in `/etc/cni/net.d`.
