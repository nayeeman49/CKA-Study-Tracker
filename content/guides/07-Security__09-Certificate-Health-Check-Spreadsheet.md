### Introduction

A systematic way to audit certificates: list each certificate in a table and verify attributes. It's an organisation tool and helps in troubleshooting questions.

### Suggested table

| Component | Type | Cert path | CN | SAN | Org | Issuer | Expiry |
|---|---|---|---|---|---|---|---|
| kube-apiserver | server | /etc/kubernetes/pki/apiserver.crt | kube-apiserver | kubernetes, kubernetes.default, svc, IPs | | kubernetes | |
| apiserver-etcd-client | client | .../apiserver-etcd-client.crt | kube-apiserver-etcd-client | | system:masters | etcd-ca | |
| apiserver-kubelet-client | client | .../apiserver-kubelet-client.crt | kube-apiserver-kubelet-client | | system:masters | kubernetes | |
| etcd server | server | .../etcd/server.crt | controlplane | localhost, IP | | etcd-ca | |
| scheduler | client | scheduler.conf | system:kube-scheduler | | | kubernetes | |

### How to fill it in

1. Find the path in the component's manifest.
2. `openssl x509 -in <path> -text -noout`.
3. Copy CN, SAN, Issuer, Not After.
4. Compare with what is expected.

### Key takeaways

- Auditing each certificate quickly shows mismatches (wrong CA, expired, missing SAN).
