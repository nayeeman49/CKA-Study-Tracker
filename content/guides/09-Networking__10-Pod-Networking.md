### Introduction

Kubernetes expects a flat Pod network. The model:

- Every Pod gets its own IP.
- Pods on the same node can communicate.
- Pods on different nodes can communicate **without NAT**.

Kubernetes doesn't implement this; a CNI plugin does.

### Manual illustration

Each node gets a Pod subnet (e.g. 10.244.1.0/24, 10.244.2.0/24). On each node:

```
 node1                                node2
 ┌─────────────────┐                 ┌─────────────────┐
 │ bridge v-net-0  │                 │ bridge v-net-0  │
 │ 10.244.1.1/24   │                 │ 10.244.2.1/24   │
 │ pod 10.244.1.2  │                 │ pod 10.244.2.2  │
 └────────┬────────┘                 └────────┬────────┘
          └────────── node network ───────────┘
 routes: node1: 10.244.2.0/24 via node2 IP ; node2: 10.244.1.0/24 via node1 IP
```

### What the CNI script does

When a Pod is created, the runtime calls the plugin which:

1. Creates a veth pair.
2. Attaches one end to the Pod namespace and the other to the bridge.
3. Assigns an IP (from the node's Pod CIDR) and adds routes.
4. Brings the interfaces up.

On delete it removes them.

### Routes between nodes

Implemented as host routes, an overlay (VXLAN), or BGP (Calico). Plugins do this automatically.

### Key takeaways

- Flat Pod network, no NAT, with per-node Pod CIDRs.
