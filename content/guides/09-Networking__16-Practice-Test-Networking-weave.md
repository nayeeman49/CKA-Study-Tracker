### How to approach this lab

Find the Weave agent details and which node a Pod is on.

### Commands

```bash
kubectl get pods -n kube-system -o wide | grep weave
kubectl logs -n kube-system weave-net-xxxx -c weave | grep -i ipalloc
ip addr show weave
ip route | grep weave
kubectl run busybox --image=busybox --command -- sleep 1000
kubectl get pods -o wide
```

### Typical answers

- Weave peers = number of nodes.
- Pod IP range = log line `ipalloc-range`.
- Default gateway for Pods on a node = the weave bridge IP.

### Worked example

```bash
kubectl -n kube-system get pods -o wide | grep weave        # one per node
kubectl -n kube-system logs weave-net-xxxxx -c weave | grep -i ipalloc
ip addr show weave                                          # bridge IP on the node
kubectl run busybox --image=busybox --command -- sleep 1000
kubectl get pod busybox -o wide                             # node + Pod IP
ip route | grep weave
```

The default gateway inside Pods on a node is the weave bridge address on that node.
