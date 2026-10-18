### How to approach this lab

You upgrade a kubeadm cluster by one minor version: the control plane and one or more workers. Follow the same sequence each time.

### Control plane node

```bash
kubectl get nodes
kubeadm version
kubeadm upgrade plan

# install new kubeadm
apt-mark unhold kubeadm
apt-get update
apt-cache madison kubeadm | head
apt-get install -y kubeadm=1.31.2-1.1
apt-mark hold kubeadm

kubeadm upgrade apply v1.31.2

# drain the control plane (optional but advised)
kubectl drain controlplane --ignore-daemonsets

apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.2-1.1 kubectl=1.31.2-1.1
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet
kubectl uncordon controlplane
```

### Worker node

```bash
kubectl drain node01 --ignore-daemonsets          # run on control plane
ssh node01
apt-mark unhold kubeadm ; apt-get update
apt-get install -y kubeadm=1.31.2-1.1
kubeadm upgrade node                              # NOT 'apply'
apt-get install -y kubelet=1.31.2-1.1 kubectl=1.31.2-1.1
systemctl daemon-reload ; systemctl restart kubelet
exit
kubectl uncordon node01
```

### Pointers

- Package names/versions differ by repo; use `apt-cache madison kubeadm`. Check the apt repository is configured for the target minor version (the repo path includes `v1.31`).
- Upgrade **kubeadm first**, then apply, then kubelet.
- The master uses `kubeadm upgrade apply`; workers use `kubeadm upgrade node`.
- Verify: `kubectl get nodes` shows the new VERSION once the kubelet restarts.
