### Introduction

Pods are ephemeral and their IPs change. A Service gives a stable virtual IP in front of a set of Pods. Kube-proxy is the component that makes that virtual IP actually work on each node.

### Pod network vs Service network

- **Pod network**: every Pod can reach every other Pod directly by IP, with no NAT (provided by the CNI plugin, e.g. Calico, Flannel, Weave, Cilium).
- **Service network**: a virtual range (`--service-cluster-ip-range`, e.g. `10.96.0.0/12`). Service IPs do not exist on any interface. They are only rules.

```
 Pod A ──► Service 10.96.0.15:80 ──► kube-proxy rules ──► Pod B (10.244.1.7)
                                                     └──► Pod C (10.244.2.4)
```

### What kube-proxy does

It runs on every node, watches the API Server for Services and EndpointSlices, and programs the node's kernel so traffic to a Service IP is forwarded to one of the healthy Pods.

Whenever a Service or its Pods change, kube-proxy updates the rules on every node.

### Proxy modes

| Mode | How |
|---|---|
| `iptables` (default) | Adds NAT rules in iptables. Random, stateless selection. |
| `ipvs` | Uses the kernel IPVS load balancer. Better at very large scale, more algorithms. |
| `nftables` | Newer replacement for iptables mode. |
| userspace | Legacy, no longer used. |

Check the mode:

```bash
kubectl -n kube-system get cm kube-proxy -o yaml | grep mode
kubectl -n kube-system logs ds/kube-proxy | head
```

### How it is run

In kubeadm it is a **DaemonSet**, so one Pod per node:

```bash
kubectl get ds -n kube-system
kubectl get pods -n kube-system -o wide | grep kube-proxy
kubectl -n kube-system describe ds kube-proxy
```

Its configuration is in a ConfigMap (`kube-proxy`) mounted in the Pod; `clusterCIDR` and `mode` live there.

### Seeing the rules

On a node:

```bash
iptables -t nat -L KUBE-SERVICES | head
iptables-save | grep my-service
```

Each Service has a chain; each endpoint has a chain with a probability match for load balancing.

### Troubleshooting

- Pod-to-Pod works but Service IP times out: kube-proxy not running on that node, or CNI/iptables problem.
- `kubectl get ds -n kube-system` shows fewer ready kube-proxy than nodes.
- Check `kubectl -n kube-system logs kube-proxy-xxxxx`.
- Wrong `clusterCIDR` in the ConfigMap or wrong Pod network leads to odd NAT behaviour.
- Service has no endpoints: selector doesn't match Pod labels (`kubectl get endpoints svc`).

### CKA exam tips

- Kube-proxy = DaemonSet in `kube-system`.
- It programs rules; it does not itself proxy packets in iptables mode.
- Services are virtual: you cannot `ping` a ClusterIP (no ICMP handling), but TCP/UDP to the port works.

### Key takeaways

- Kube-proxy turns Service IPs into rules that reach Pods.
- One instance per node, usually a DaemonSet.
- iptables is the default mode; ipvs is an alternative.
