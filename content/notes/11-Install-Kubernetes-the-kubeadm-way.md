## What this section is about
Building a cluster with **kubeadm**: the standard exam skill. You may be asked to bootstrap a control plane, join a worker, or fix a half-installed node.

## Install flow (every node)
1. Prerequisites (see Design section): swap off, kernel modules, sysctls, hostnames.
2. Install and configure a **container runtime** (containerd with `SystemdCgroup = true` in `/etc/containerd/config.toml`).
3. Install `kubeadm`, `kubelet`, `kubectl` from the `pkgs.k8s.io` repo for the target minor version; `apt-mark hold` them.

## Control plane
```
kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=<ip> \
  [--control-plane-endpoint=<lb>:6443 --upload-certs]
mkdir -p $HOME/.kube && cp /etc/kubernetes/admin.conf $HOME/.kube/config
kubectl apply -f <cni-manifest>        # nodes stay NotReady until a CNI exists
```
`kubeadm init` runs preflight checks, generates certificates in `/etc/kubernetes/pki`, writes kubeconfigs and static-pod manifests into `/etc/kubernetes/manifests`, starts the kubelet, then installs CoreDNS and kube-proxy.

## Joining nodes
```
kubeadm token create --print-join-command        # tokens expire after 24h
kubeadm join <ep>:6443 --token ... --discovery-token-ca-cert-hash sha256:...
```
Add `--control-plane --certificate-key ...` to join an extra control-plane node (from `kubeadm init phase upload-certs --upload-certs`).

## Verify and troubleshoot
`kubectl get nodes`, `kubectl get pods -n kube-system`, `systemctl status kubelet`, `journalctl -xeu kubelet`. Start over with `kubeadm reset` (then clean `/etc/cni/net.d`). Common causes of failure: swap still on, runtime cgroup driver mismatch, wrong CIDR, firewall blocking 6443/10250.

## Exam tips
- Do tasks in order: runtime → packages → init/join → CNI → verify.
- Copy join commands exactly; if the token expired, generate a new one.
- The kubeadm configuration can also be given as YAML (`kubeadm init --config`), and `kubeadm config print init-defaults` shows a template.

## Official documentation
- [Installing kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
- [Creating a cluster with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
- [Troubleshooting kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/troubleshooting-kubeadm/)
- [kubeadm join reference](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-join/)
- [Container Runtimes](https://kubernetes.io/docs/setup/production-environment/container-runtimes/)
