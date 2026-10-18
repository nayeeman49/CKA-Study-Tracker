### How to approach this lab

Explore the interfaces, routes and ports of the lab cluster.

### Commands

```bash
kubectl get nodes -o wide                    # INTERNAL-IP
ip a | grep -B2 192.168                      # interface for that IP
ip link show eth0                            # MAC address
ip route
ip link show cni0 ; ip link show flannel.1
netstat -natulp | grep kube-scheduler
netstat -natulp | grep etcd | grep LISTEN
```

### Typical answers

| Question | How |
|---|---|
| Interface used for the cluster network | The one with the node's INTERNAL-IP |
| Default gateway | `ip route` default line |
| Port the scheduler listens on | `netstat -nplt \| grep scheduler` (10259) |
| ETCD ports | 2379 and 2380 (2379 has more connections) |
| CNI bridge / interface name | `ip link` (cni0, docker0, flannel.1) |

### Worked example

```bash
kubectl get nodes -o wide                    # INTERNAL-IP 192.168.121.x
ip -o -4 addr show | grep 192.168.121        # interface eth0
ip link show eth0 | grep link/ether          # MAC
ip route | grep default                      # gateway
ss -tlnp | grep -E "kube-sched|etcd"
```

Ports: scheduler 10259, controller manager 10257, etcd 2379 (client) and 2380 (peer). The etcd client port has more connections because every API server connects to it.
