### How to approach this lab

Identify which CNI the cluster uses and its settings.

### Commands

```bash
ls /etc/cni/net.d
cat /etc/cni/net.d/*.conflist
ls /opt/cni/bin
kubectl -n kube-system get pods -o wide
ps -aux | grep kubelet | grep -i container-runtime
ip link
```

### Typical answers

| Question | Where |
|---|---|
| Which plugin is configured | file name / `type` in `/etc/cni/net.d` |
| Binary executed | `/opt/cni/bin/<type>` |
| Which runtime | kubelet flag `--container-runtime-endpoint` |
| Pod subnet | `ipam.subnet` or `kubeadm` pod CIDR |

### Worked example

```bash
ls /etc/cni/net.d/                      # 10-weave.conflist
grep -E '"type"' /etc/cni/net.d/*.conflist
ls /opt/cni/bin | head
ps aux | grep kubelet | grep -o "container-runtime-endpoint=[^ ]*"
kubectl -n kube-system get pods | grep weave
```

The plugin binary a Pod uses is the one named by `type` (for Weave: `weave-net`, plus `weave-ipam`).
