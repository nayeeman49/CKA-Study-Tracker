### Introduction

Vagrant provisions repeatable VMs for a local lab cluster using VirtualBox (or another provider).

### Steps

```bash
vagrant --version
git clone https://github.com/kodekloudhub/certified-kubernetes-administrator-course
cd certified-kubernetes-administrator-course/kubeadm-clusters/virtualbox
vagrant up
vagrant status
vagrant ssh kubemaster
```

### Vagrantfile concepts

- Defines nodes (`kubemaster`, `kubenode01`, `kubenode02`) with IP addresses, CPU, memory, a base box image.
- Runs provisioning scripts to install packages.

### Tips

- Host needs enough RAM (about 8 GB for 3 small VMs).
- `vagrant halt` stops, `vagrant destroy` removes the VMs.
- Verify networking: each node should reach the others by IP.

### What the lab VMs look like

| VM | Role | Typical IP |
|---|---|---|
| kubemaster | control plane | 192.168.56.11 |
| kubenode01 | worker | 192.168.56.21 |
| kubenode02 | worker | 192.168.56.22 |

### After `vagrant up`

```bash
vagrant ssh kubemaster
hostname -I ; ping -c1 192.168.56.21
```

Note the host-only network IP: use it as `--apiserver-advertise-address` (not the NAT address `10.0.2.15` that every Vagrant VM shares).

### Common mistakes

- Using the NAT interface IP for the API server.
- Starting too many VMs for the host's RAM.
