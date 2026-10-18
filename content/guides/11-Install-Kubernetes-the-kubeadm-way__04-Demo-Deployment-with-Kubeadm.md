### Introduction

The full sequence of building a cluster with kubeadm.

### 1. On every node: prepare

```bash
swapoff -a
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
modprobe overlay ; modprobe br_netfilter
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system
```

### 2. Install runtime and Kubernetes packages

```bash
apt-get install -y containerd
mkdir -p /etc/containerd ; containerd config default > /etc/containerd/config.toml
# set SystemdCgroup = true
systemctl restart containerd

apt-get install -y apt-transport-https ca-certificates curl gpg
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.31/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.31/deb/ /' > /etc/apt/sources.list.d/kubernetes.list
apt-get update
apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl
systemctl enable --now kubelet
```

### 3. Initialise the control plane

```bash
kubeadm init --apiserver-advertise-address=192.168.56.2 \
             --pod-network-cidr=10.244.0.0/16
```

Note the `kubeadm join` command printed at the end. Configure kubectl:

```bash
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
```

### 4. Install a CNI

```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
kubectl get pods -n kube-system
```

The Pod CIDR must match `--pod-network-cidr`.

### 5. Join workers

```bash
kubeadm join 192.168.56.2:6443 --token abcdef.0123456789abcdef --discovery-token-ca-cert-hash sha256:...
```

Regenerate the command if the token expired (24h):

```bash
kubeadm token create --print-join-command
```

### 6. Verify

```bash
kubectl get nodes
kubectl get pods -A
```

### Troubleshooting

- Nodes `NotReady`: no CNI yet, or kubelet issues.
- `kubeadm init` pre-flight errors: swap on, ports in use, runtime missing.
- cgroup driver mismatch between kubelet and containerd: set `SystemdCgroup = true`.
- `kubeadm reset` to start over.

### Key takeaways

- Prepare nodes, init, CNI, join, verify.
