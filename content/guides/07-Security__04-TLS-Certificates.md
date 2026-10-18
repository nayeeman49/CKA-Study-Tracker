### Introduction

An overview of why Kubernetes needs TLS certificates. Each component communicates over TLS, authenticated by certificates, both for encryption and for identity.

### Where certificates are used

```
 admin / kubectl ──► kube-apiserver ◄── scheduler, controller-manager
                         │ ▲                 (client certs)
                         ▼ │
                       etcd         kube-apiserver ──► kubelet
                                    kubelet ──► kube-apiserver
```

Servers have **server certificates**; clients have **client certificates**.

### Key takeaways

- Security of the cluster depends on the PKI.
- The next lessons explain TLS theory and then every certificate in a cluster.

### Certificate roles at a glance

| Who | Presents | Verified against |
|---|---|---|
| kube-apiserver (as server) | `apiserver.crt` | cluster CA |
| kubectl / admin | `admin` client cert | cluster CA |
| scheduler, controller manager, kube-proxy | client certs | cluster CA |
| kube-apiserver → etcd | `apiserver-etcd-client.crt` | etcd CA |
| kube-apiserver → kubelet | `apiserver-kubelet-client.crt` | cluster CA |
| kubelet (server) | kubelet serving cert | cluster CA |

### Why it breaks

Typical TLS failures in Kubernetes: expired cert, wrong CA, missing SAN (name or IP not listed), wrong file path in a manifest. The error text usually says `x509: certificate ...`.

```bash
kubeadm certs check-expiration
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -issuer -dates
```
