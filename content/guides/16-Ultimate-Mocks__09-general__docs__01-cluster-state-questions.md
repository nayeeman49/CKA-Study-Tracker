### How to approach this lab

Quickly gather facts about the cluster and write answers to files.

### Command map

| Question | Command |
|---|---|
| Kubernetes version | `kubectl version`, `kubectl get nodes` |
| Number of nodes/Pods | `kubectl get nodes --no-headers \| wc -l` |
| Runtime/OS | `kubectl get nodes -o wide` |
| Pod / service CIDR | `kubectl cluster-info dump \| grep -E 'cluster-cidr\|service-cluster-ip-range'` |
| CNI | `ls /etc/cni/net.d` |
| Static Pod path | `grep staticPodPath /var/lib/kubelet/config.yaml` |
| Certificate expiry | `kubeadm certs check-expiration` |
| ETCD version/data dir | `describe pod etcd-*` |
| DNS domain | `kubectl -n kube-system get cm coredns -o yaml` |

Write answers exactly in the requested format and file path.

### More one-liners

```bash
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.kubeletVersion}'
kubectl get pods -A --field-selector=status.phase!=Running
kubectl api-resources --namespaced=false | wc -l
kubectl -n kube-system get cm kubeadm-config -o yaml | grep -E "podSubnet|serviceSubnet"
```
