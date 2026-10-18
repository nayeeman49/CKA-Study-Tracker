### How to approach this lab

A worker is `NotReady`; find out why and fix it.

### Steps

```bash
kubectl get nodes
kubectl describe node node01 | grep -A10 Conditions
ssh node01
systemctl status kubelet
journalctl -u kubelet -n 50
```

### Typical faults

- kubelet not running: `systemctl start kubelet` (and `enable`).
- Wrong CA path in `/var/lib/kubelet/config.yaml`: fix, then `systemctl restart kubelet`.
- Wrong API server port in `/etc/kubernetes/kubelet.conf` (for example 6553 instead of 6443): correct and restart.

### Verify

```bash
exit
kubectl get nodes
```

### Worked example

```bash
kubectl get nodes                       # node01 NotReady
ssh node01
systemctl status kubelet                # inactive (dead)
systemctl start kubelet ; systemctl enable kubelet
journalctl -u kubelet -n 30             # still failing? read the error
vi /var/lib/kubelet/config.yaml         # fix clientCAFile path
systemctl restart kubelet
exit ; kubectl get nodes
```
