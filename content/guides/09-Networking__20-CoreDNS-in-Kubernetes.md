### Introduction

CoreDNS is the cluster DNS. It runs as a Deployment (two replicas) in `kube-system` behind the `kube-dns` Service.

### Components

```bash
kubectl -n kube-system get deploy coredns
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get cm coredns -o yaml
```

### Corefile ConfigMap

```
.:53 {
    errors
    health { lameduck 5s }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
    loadbalance
}
```

- `kubernetes` plugin handles `cluster.local`.
- `forward . /etc/resolv.conf` sends everything else to the node's resolvers.
- Edit the ConfigMap and CoreDNS reloads (`reload` plugin) or restart the Pods: `kubectl -n kube-system rollout restart deploy coredns`.

### How Pods find CoreDNS

The kubelet sets `--cluster-dns=10.96.0.10` and `--cluster-domain=cluster.local` in `/var/lib/kubelet/config.yaml`:

```bash
grep -A2 clusterDNS /var/lib/kubelet/config.yaml
```

### Troubleshooting DNS

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
kubectl get endpoints kube-dns -n kube-system
kubectl run t --image=busybox:1.28 --rm -it --restart=Never -- nslookup kubernetes.default
```

Common causes: CoreDNS Pods down, wrong Corefile, loop plugin detecting a loop with `/etc/resolv.conf` pointing to itself, NetworkPolicy blocking port 53, wrong `clusterDNS`.

### Key takeaways

- CoreDNS Deployment + `kube-dns` Service + Corefile ConfigMap.
