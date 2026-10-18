### Introduction

A single control plane node is a single point of failure. In an HA cluster you run several control plane nodes behind a load balancer.

```
            kubectl / kubelets
                   │
            ┌──────▼──────┐
            │ Load balancer│  (HAProxy / nginx / cloud LB)  :6443
            └──┬────┬───┬──┘
               ▼    ▼   ▼
             CP1   CP2  CP3
```

### Which components are active

| Component | HA behaviour |
|---|---|
| kube-apiserver | **Active/active**; all instances serve requests |
| kube-scheduler | **Active/passive** via leader election |
| kube-controller-manager | **Active/passive** via leader election |
| ETCD | Raft cluster (leader + followers) |

Leader election uses `--leader-elect=true`, a Lease object in `kube-system`:

```bash
kubectl -n kube-system get lease
```

### Load balancer

Point `kubectl`, kubelets and all components at the LB address, not at a single API server. With kubeadm:

```bash
kubeadm init --control-plane-endpoint "lb.example.com:6443" --upload-certs
kubeadm join lb.example.com:6443 --control-plane --certificate-key <key> --token ...
```

The API server certificate must include the LB DNS name/IP in its SANs.

### Quorum

With ETCD on the control plane nodes you need an odd count: 3 tolerates 1 failure, 5 tolerates 2.

### Key takeaways

- API servers active/active behind an LB; scheduler and controller manager elect a leader.
