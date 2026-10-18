### Introduction

IP Address Management (IPAM) decides how Pods receive unique IP addresses. The CNI plugin delegates to an IPAM plugin.

### Options

- **host-local**: each node has its own subnet and a local file tracks allocations. Simple; the cluster must carve out per-node ranges.
- **Weave's IPAM**: allocates from a shared range, split dynamically among peers. Default range `10.32.0.0/12` divided across nodes.
- **Calico IPAM**, cloud-specific IPAMs.

### Config

```json
"ipam": {
  "type": "host-local",
  "subnet": "10.244.1.0/24"
}
```

### Check

```bash
kubectl get nodes -o jsonpath='{.items[*].spec.podCIDR}'
kubectl get pods -A -o wide     # Pod IPs
```

### Key takeaways

- IPAM ensures unique Pod IPs; the node CIDR (`--pod-network-cidr`, `--cluster-cidr`) matters.
