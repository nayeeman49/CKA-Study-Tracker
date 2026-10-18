### Introduction

When something breaks, you inspect certificates to find wrong names, wrong CA, or expiry.

### Find which certificate a component uses

```bash
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep -E "crt|key|ca"
cat /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
```

### Decode a certificate

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout
```

Items to check:

| Field | Why |
|---|---|
| `Subject: CN=...` | Correct name |
| `X509v3 Subject Alternative Name` | All required names/IPs |
| `Validity: Not After` | Expiry |
| `Issuer` | Right CA |
| `Key Usage / Extended Key Usage` | Server vs client auth |

Quick expiry check:

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -enddate
kubeadm certs check-expiration
```

### Logs when certs are wrong

```bash
journalctl -u etcd.service -l                 # for services
kubectl logs etcd-master                      # for kubeadm
crictl ps -a ; crictl logs <id>               # when kubectl is down
```

### Typical failures

- API server can't talk to ETCD: wrong etcd cert path in its manifest.
- ETCD fails: wrong CA in `--trusted-ca-file`.
- Expired certs: all kubectl commands fail with "certificate has expired".

### Renewing

```bash
kubeadm certs renew all
kubeadm certs renew apiserver
```

then restart the control plane Pods (move manifests out and back, or restart kubelet).

### Key takeaways

- `openssl x509 -text -noout` and `kubeadm certs check-expiration` are the two tools.
