### How to approach this lab

Tasks: find static Pods, locate the manifest path, create/delete a static Pod, possibly on another node.

### Commands

```bash
kubectl get pods -A                        # names ending with node names
ps -ef | grep kubelet | grep config
grep staticPodPath /var/lib/kubelet/config.yaml
ls /etc/kubernetes/manifests
kubectl run static-busybox --image=busybox --command --dry-run=client -o yaml -- sleep 1000 > /etc/kubernetes/manifests/static-busybox.yaml
```

For a static Pod on another node:

```bash
kubectl get nodes -o wide                  # get the node's IP
ssh node01
grep staticPodPath /var/lib/kubelet/config.yaml
vi /etc/kubernetes/manifests/static-greenbox.yaml
exit
```

### Pointers

- How to know which node: `kubectl get pods -o wide`.
- Remove by deleting the file on that node.

### Worked example

Create a static Pod `static-busybox` on the control plane node:

```bash
kubectl run static-busybox --image=busybox --command --dry-run=client -o yaml -- sleep 1000 \
  > /etc/kubernetes/manifests/static-busybox.yaml
kubectl get pods                      # static-busybox-controlplane
```

Delete a static Pod running on another node:

```bash
kubectl get pods -o wide              # find the node, e.g. node01
ssh node01
grep staticPodPath /var/lib/kubelet/config.yaml
rm /etc/kubernetes/manifests/static-greenbox.yaml
```

### Common mistakes

- Running `kubectl delete pod` on a static Pod (it comes straight back).
- Editing the manifest on the wrong node.
- Using the `-o yaml` output of a running Pod (it contains status and nodeName); generate fresh YAML instead.
