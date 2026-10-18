### How to approach this lab

Questions ask for specific attributes of certificates, or why a component fails because of a bad certificate path.

### Commands

```bash
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep -E "tls-cert|etcd-.*file|client-ca"
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -E "Subject:|Issuer|DNS|Not After"
openssl x509 -in /etc/kubernetes/pki/etcd/server.crt -text -noout | grep -E "Subject:|Not After"
kubeadm certs check-expiration
```

### If the API Server is broken

```bash
crictl ps -a | grep kube-apiserver
crictl logs <id>
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep etcd
ls /etc/kubernetes/pki/etcd/
```

A wrong filename in the manifest (for example `etcd-ca.crt` instead of `ca.crt`) breaks the connection; fix it, wait for the Pod to be recreated.

### Tips

- CN, SAN and Issuer answer most questions.
- Fix manifests carefully; the kubelet restarts the Pod after saving.

### Worked example

Find the SANs of the API server certificate and its expiry:

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A1 "Alternative Name"
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -enddate
openssl x509 -in /etc/kubernetes/pki/etcd/server.crt -noout -subject
```

If ETCD won't start: `grep -E "cert-file|key-file|trusted-ca" /etc/kubernetes/manifests/etcd.yaml`, then `ls /etc/kubernetes/pki/etcd` and fix any name that doesn't exist (for example `server-certificate.crt`).

### Common mistakes

- Reading the wrong CA (ETCD has its own under `pki/etcd`).
- Not waiting for the kubelet to restart the static Pod after a manifest change.
