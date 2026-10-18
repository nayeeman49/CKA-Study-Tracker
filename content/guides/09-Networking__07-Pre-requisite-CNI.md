### Introduction

Every container runtime repeated the same networking steps. The **Container Network Interface (CNI)** defines a standard so runtimes and network plugins interoperate.

### The standard

For the runtime (kubelet/containerd): create a namespace, identify the network, invoke the plugin on **add** and **delete**, and handle the JSON config.

For the plugin: support `ADD`, `DEL`, `CHECK` commands, take container ID and namespace, assign IPs, set up routes, return results.

```
 runtime ──► plugin ADD(container id, netns, config) ──► IP, routes assigned
```

### Plugins

bridge, vlan, ipvlan, macvlan, host-device (built-in); Weave, Flannel, Calico, Cilium, Cisco ACI, VMware NSX and others (third-party).

**Docker does not implement CNI**; it uses its own CNM (container network model). That's why Kubernetes with Docker created its networking manually with `--network=none` and the CNI plugin.

### Key takeaways

- CNI = plugin standard for container networking; Kubernetes uses it.
