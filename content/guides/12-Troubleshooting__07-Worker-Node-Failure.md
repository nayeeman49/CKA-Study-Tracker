### Introduction

Worker problems usually show up as a node in `NotReady` or `Unknown`.

### Diagnose

```bash
kubectl get nodes
kubectl describe node worker-1
```

Look at **Conditions**: `Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`, `NetworkUnavailable`. `Unknown` means the kubelet stopped reporting (crash, network, node down).

On the node:

```bash
top ; df -h ; free -m
systemctl status kubelet
journalctl -u kubelet
systemctl status containerd
ss -tlnp | grep 10250
```

### Certificates

```bash
openssl x509 -in /var/lib/kubelet/worker-1.crt -text -noout      # validity and issuer
```

An expired or wrong kubelet certificate prevents registration.

### Typical causes

| Cause | Fix |
|---|---|
| kubelet stopped | `systemctl start kubelet`, `enable` |
| Wrong CA / kubeconfig path | edit `/etc/kubernetes/kubelet.conf` or `/var/lib/kubelet/config.yaml` |
| Wrong API server address/port | fix `server:` in `kubelet.conf` (6443) |
| Runtime stopped | `systemctl restart containerd` |
| Disk full | clean up |
| Swap on | disable |

### Key takeaways

- `describe node` for conditions, `journalctl -u kubelet` for reasons.
