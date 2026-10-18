### Introduction

Solutions for worker node failures.

### Example flow

1. `kubectl get nodes`: `node01 NotReady`.
2. On node01: `service kubelet status` → inactive/failed.
3. Logs show: `failed to load Kubelet config file ... no such file or directory` or `unable to load client CA file`.
4. Fix the path in `/var/lib/kubelet/config.yaml`; or fix `server: https://controlplane:6443`.
5. `systemctl daemon-reload` (if units changed) then `systemctl restart kubelet`.
6. `kubectl get nodes` shows `Ready`.

### Notes

- A kubelet flag in `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf` or `/var/lib/kubelet/kubeadm-flags.env` can also be wrong.
- If the node was deleted from the cluster, rejoin using `kubeadm token create --print-join-command`.

### Fault catalogue

| Log message | Fix |
|---|---|
| `failed to load Kubelet config file` | correct path in the systemd drop-in |
| `unable to load client CA file ... no such file` | fix `clientCAFile` in `config.yaml` |
| `dial tcp ...:6553: connection refused` | change port to 6443 in `kubelet.conf` |
| `container runtime is not running` | start containerd |

After changes: `systemctl daemon-reload` (for unit files) and `systemctl restart kubelet`.
