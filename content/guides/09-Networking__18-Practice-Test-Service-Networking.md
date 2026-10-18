### How to approach this lab

Discover ranges and kube-proxy configuration.

### Commands

```bash
ip addr show eth0                                    # node network
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep service-cluster
kubectl get pods -n kube-system | grep proxy
kubectl logs -n kube-system kube-proxy-xxxxx | head       # "Using iptables Proxier"
kubectl -n kube-system get cm kube-proxy -o yaml | grep -E "mode|clusterCIDR"
iptables -t nat -L | grep db-service
kubectl get ds -n kube-system
```

### Typical answers

| Question | Answer |
|---|---|
| Service IP range | API server `--service-cluster-ip-range` |
| Pod IP range | CNI config / `clusterCIDR` / pod CIDR |
| Proxy mode | kube-proxy Pod logs or ConfigMap (default iptables) |
| Where does kube-proxy run | DaemonSet, one per node |

### Worked example

```bash
ip addr show eth0                                              # node network
kubectl cluster-info dump | grep -m1 service-cluster-ip-range
kubectl -n kube-system logs ds/kube-proxy | grep -i proxier     # "Using iptables Proxier"
iptables -t nat -L KUBE-SERVICES -n | head
```

Rules show the Service IP, port and the chain that leads to Pod endpoints.

### Common mistakes

- Confusing the Pod CIDR with the Service CIDR.
- Looking for kube-proxy as a systemd service (it's a DaemonSet in kubeadm clusters).
