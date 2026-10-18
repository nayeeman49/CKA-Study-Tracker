### Introduction

What networking a Kubernetes cluster needs between its nodes and components.

### Node requirements

- Each node has at least one interface on the node network with an IP, a unique hostname and a unique MAC address.
- Required open ports:

| Port | Component | Where |
|---|---|---|
| 6443 | kube-apiserver | control plane |
| 10250 | kubelet API | all nodes |
| 10259 | kube-scheduler | control plane |
| 10257 | kube-controller-manager | control plane |
| 2379 | etcd client | control plane |
| 2380 | etcd peer | control plane |
| 30000–32767 | NodePort services | workers |

Firewalls and security groups must allow these. (In clusters with multiple control planes, ETCD ports are open between them.)

### Commands to explore

```bash
ip link ; ip addr
ip addr show eth0
ip route
netstat -nplt             # listening ports (or ss -tlnp)
netstat -anp | grep etcd
arp node01
```

### Notable details

- The API server listens on 6443, ETCD on 2379 (clients) and 2380 (peers). Because there are more client connections to 2379, etcd on multiple control planes needs both.
- The kubelet's port 10250 and the control plane component ports are used by health checks and metrics.

### Key takeaways

- Know the port table.
