### Introduction

How to create certificates for a cluster yourself using OpenSSL (done automatically by kubeadm). Understand the pattern, because the CKA asks you to inspect and sometimes create them.

### 1. Create the CA

```bash
openssl genrsa -out ca.key 2048
openssl req -new -key ca.key -subj "/CN=KUBERNETES-CA" -out ca.csr
openssl x509 -req -in ca.csr -signkey ca.key -out ca.crt -days 3650
```

### 2. Client certificate (admin)

```bash
openssl genrsa -out admin.key 2048
openssl req -new -key admin.key -subj "/CN=kube-admin/O=system:masters" -out admin.csr
openssl x509 -req -in admin.csr -CA ca.crt -CAkey ca.key -out admin.crt
```

- `CN` is the user name.
- `O` is the group; `system:masters` gives full admin rights.

Other component names: `system:kube-scheduler`, `system:kube-controller-manager`, `system:kube-proxy`.

### 3. Using the certificate

```bash
curl https://kube-apiserver:6443/api/v1/pods --key admin.key --cert admin.crt --cacert ca.crt
```

or in a kubeconfig.

### 4. Server certificates

Need the right names. The API Server certificate must contain every name or IP clients use as **Subject Alternative Names**:

```
kubernetes, kubernetes.default, kubernetes.default.svc,
kubernetes.default.svc.cluster.local, 10.96.0.1, <master IP>, <load balancer name/IP>
```

```ini
# openssl.cnf
[req]
req_extensions = v3_req
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
IP.1 = 10.96.0.1
IP.2 = 192.168.5.10
```

```bash
openssl req -new -key apiserver.key -subj "/CN=kube-apiserver" -out apiserver.csr -config openssl.cnf
openssl x509 -req -in apiserver.csr -CA ca.crt -CAkey ca.key -out apiserver.crt -extensions v3_req -extfile openssl.cnf
```

### 5. Kubelet certificates

Server certs named after each node, and client certs with `CN=system:node:<nodename>` and `O=system:nodes`.

### Key takeaways

- CA first, then sign everything with it.
- CN = user, O = group, SANs for servers.
