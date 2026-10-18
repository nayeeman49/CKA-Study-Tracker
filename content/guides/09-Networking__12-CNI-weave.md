### Introduction

Weave Net is a CNI plugin that creates an overlay network. A Weave agent runs on each node, they learn about each other and encapsulate traffic between nodes.

```
 node1: weave peer ◄═══ encapsulated traffic ═══► weave peer :node2
        pod A ──► weave bridge                      weave bridge ──► pod B
```

### Deploying

Weave runs as a DaemonSet, one Pod per node:

```bash
kubectl apply -f https://reweave.azurewebsites.net/k8s/v1.29/net.yaml
kubectl get pods -n kube-system | grep weave
kubectl logs -n kube-system weave-net-xxxxx -c weave
```

### Inspect

```bash
ip link | grep weave            # weave bridge
ip addr show weave
kubectl -n kube-system get ds weave-net
```

Default Pod network range `10.32.0.0/12`.

### Other CNI choices

| Plugin | Notes |
|---|---|
| Flannel | Simple overlay; **no NetworkPolicy** |
| Calico | BGP/routing; NetworkPolicy; popular |
| Cilium | eBPF; NetworkPolicy, observability |
| Weave | Overlay; NetworkPolicy support |

### Key takeaways

- Weave = DaemonSet overlay; check its Pods and bridge interface.
