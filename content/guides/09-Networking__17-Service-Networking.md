### Introduction

How Service IPs work. Services are cluster-wide virtual objects: no process, no interface. Kube-proxy on every node turns them into forwarding rules.

### Ranges

```
Pod network       10.244.0.0/16     (CNI)
Service network   10.96.0.0/12      (--service-cluster-ip-range on the API server)
```

The two ranges must not overlap with each other or the node network.

```bash
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep service-cluster-ip-range
```

### Creation flow

```
 Service created ─► kube-proxy on each node watches the API
                  ─► adds rules: ClusterIP:port → Pod IP:port
```

### Types as rules

- **ClusterIP**: rule on each node for internal use.
- **NodePort**: also listens on a port on each node (30000–32767).

### See the rules

```bash
iptables -t nat -L -n | grep db-service
iptables -t nat -L KUBE-SERVICES | head
```

Rule comments show `default/db-service`. Log: `/var/log/kube-proxy.log` or Pod logs.

### Mode options

kube-proxy `--proxy-mode`: `iptables` (default), `ipvs`, `nftables`.

### Key takeaways

- Service IPs are virtual and implemented as NAT rules by kube-proxy.
