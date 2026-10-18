### Introduction

When the cluster itself misbehaves, check the control plane components and their configuration.

### Quick checks

```bash
kubectl get nodes
kubectl get pods -n kube-system
```

If `kubectl` itself fails, the API server is down: use the node.

### kubeadm cluster (components are static Pods)

```bash
kubectl logs kube-apiserver-controlplane -n kube-system
crictl ps -a | grep kube
crictl logs <container-id>
ls /etc/kubernetes/manifests
journalctl -u kubelet
```

### Service-based cluster

```bash
systemctl status kube-apiserver
journalctl -u kube-apiserver
service kube-controller-manager status
```

### Common failures and where to look

| Symptom | Component | Typical cause |
|---|---|---|
| `kubectl` connection refused | kube-apiserver | wrong flag/cert path in manifest, ETCD unreachable |
| Pods stay Pending, no events | kube-scheduler | scheduler down, bad kubeconfig path |
| Deployments don't create Pods | kube-controller-manager | down, bad config |
| Replica counts wrong | controller manager | |
| API timeouts | etcd | wrong data dir / certs |
| Node NotReady | kubelet | service down, config |

### Manifest mistakes to look for

- Typo in a flag or filename (`--kubeconfig=/etc/kubernetes/scheduler.conff`).
- Wrong path in `volumes.hostPath` versus the `volumeMounts` (certificates).
- Wrong image name or tag.
- Wrong port or command (`kube-schedulerr`).

### Fix procedure

1. Read the logs.
2. Edit `/etc/kubernetes/manifests/<component>.yaml`.
3. Wait for the kubelet to restart the Pod (may take a minute).
4. Verify.

Always keep a backup copy before editing.

### Key takeaways

- Identify the failing component, read its logs, fix the manifest.
