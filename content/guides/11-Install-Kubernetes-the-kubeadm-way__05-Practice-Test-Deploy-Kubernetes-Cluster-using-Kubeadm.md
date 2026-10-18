### How to approach this lab

Build a cluster from fresh nodes, similar to the demo.

### Checklist

1. Check the target version from the task and install matching `kubeadm`, `kubelet`, `kubectl`.
2. `kubeadm init` with the right `--apiserver-advertise-address` and `--pod-network-cidr`.
3. Copy `admin.conf` to `~/.kube/config`.
4. Install the CNI the task names (Flannel/Calico/Weave) using the matching Pod CIDR.
5. Print the join command: `kubeadm token create --print-join-command`; run on the worker.
6. `kubectl get nodes` until all `Ready`.

### Troubleshooting

- Nodes NotReady: look at the CNI Pods and `journalctl -u kubelet`.
- Join fails: token expired, wrong API address, firewall on 6443.
- Pods CIDR mismatch causes CNI crashes (flannel needs `10.244.0.0/16` by default).

### Worked example

```bash
# controlplane
kubeadm init --apiserver-advertise-address=$(hostname -I | awk '{print $1}') --pod-network-cidr=10.244.0.0/16
mkdir -p ~/.kube && cp /etc/kubernetes/admin.conf ~/.kube/config
kubectl apply -f kube-flannel.yml
kubeadm token create --print-join-command
# node01
kubeadm join <ip>:6443 --token ... --discovery-token-ca-cert-hash sha256:...
# controlplane
kubectl get nodes -w
```

### Common mistakes

- Pod CIDR in the CNI manifest not matching `--pod-network-cidr`.
- Running `kubeadm join` before the control plane is ready.
- Forgetting to copy `admin.conf`.
