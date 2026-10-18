### How to approach this lab

Network problems with CNI or kube-proxy: Pods can't communicate, Services unreachable, DNS failing.

### Checks

```bash
kubectl get pods -n kube-system
kubectl get ds -n kube-system                       # kube-proxy, CNI
kubectl logs -n kube-system kube-proxy-xxxxx
kubectl -n kube-system get cm kube-proxy -o yaml
kubectl get endpoints svc
kubectl run t --image=busybox:1.28 --rm -it --restart=Never -- nslookup kubernetes
```

### Typical faults

| Symptom | Cause |
|---|---|
| CNI Pods crash | Missing/incorrect CNI config |
| Service not reachable | kube-proxy DaemonSet misconfigured (wrong config path, wrong `kubeconfig.conf` in ConfigMap) |
| DNS fails | CoreDNS Pods or ConfigMap errors; NetworkPolicy blocking 53 |
| Pods Pending | No CNI installed |

### Fixing kube-proxy

```bash
kubectl -n kube-system describe ds kube-proxy         # command path, configmap name
kubectl -n kube-system edit ds kube-proxy             # fix --config path
kubectl -n kube-system rollout restart ds kube-proxy
```

The kubeadm default command is `/usr/local/bin/kube-proxy --config=/var/lib/kube-proxy/config.conf --hostname-override=$(NODE_NAME)`.
