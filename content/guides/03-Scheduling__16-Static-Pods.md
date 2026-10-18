### Introduction

A static Pod is created and managed directly by the kubelet on a node, without the API Server, scheduler or controllers. The kubelet watches a folder and runs whatever Pod YAML is in it.

```
 /etc/kubernetes/manifests/web.yaml
            │ watched by
            ▼
        kubelet ──► container runtime ──► Pod
            │
            └──► creates a read-only "mirror Pod" in the API Server so kubectl can see it
```

### Configure the folder

In the kubelet config:

```yaml
# /var/lib/kubelet/config.yaml
staticPodPath: /etc/kubernetes/manifests
```

Older style: the flag `--pod-manifest-path`. Find it:

```bash
ps -aux | grep kubelet
grep -i staticPodPath /var/lib/kubelet/config.yaml
```

### Create / delete

```bash
# on the node whose kubelet reads the folder
kubectl run static-busybox --image=busybox --dry-run=client -o yaml --command -- sleep 1000 > /etc/kubernetes/manifests/static-busybox.yaml
# delete by removing the file
rm /etc/kubernetes/manifests/static-busybox.yaml
```

Deleting the mirror Pod with `kubectl delete pod` does nothing; the kubelet recreates it.

### Recognising static Pods

- The Pod name ends with the node name: `static-busybox-controlplane`.
- `kubectl get pod x -o yaml | grep -A5 ownerReferences` shows `kind: Node`.

### Why they matter

The control plane of kubeadm clusters is built from static Pods (apiserver, etcd, scheduler, controller-manager). That lets Kubernetes bootstrap itself without needing itself.

### Static Pods vs DaemonSets

| | Static Pod | DaemonSet |
|---|---|---|
| Created by | kubelet | DaemonSet controller via API Server |
| Scheduler involved | No | Yes |
| Used for | Control plane components | Cluster-wide agents |
| Managed with kubectl | Read only | Fully |

### Troubleshooting

- Pod doesn't appear: wrong folder, YAML error (check kubelet logs `journalctl -u kubelet`).
- Pod name has node suffix, to find the node: `kubectl get pods -o wide`.
- To remove a static Pod find the node and its `staticPodPath` first.

### CKA exam tips

- SSH to the right node, find `staticPodPath`, put the YAML there.
- Control plane component changes happen by editing files in this folder.

### Key takeaways

- Static Pods are kubelet-owned; manage them via files.
