### Introduction

Instead of manually signing certificates with the CA key, Kubernetes has a **Certificates API** (CSR objects). Users submit a request, an admin approves it, and the controller manager signs it.

### Workflow for a new user

```
 user: key + csr ─► admin creates CertificateSigningRequest ─► approve ─► user gets certificate
```

1. User creates key and CSR:

```bash
openssl genrsa -out jane.key 2048
openssl req -new -key jane.key -subj "/CN=jane" -out jane.csr
```

2. Admin creates a CSR object (request is base64 of the file):

```bash
cat jane.csr | base64 -w 0
```

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: <base64 here>
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: 86400
  usages:
  - client auth
```

3. Review and approve:

```bash
kubectl get csr
kubectl certificate approve jane
kubectl certificate deny jane
kubectl delete csr jane
```

4. Extract the certificate:

```bash
kubectl get csr jane -o jsonpath='{.status.certificate}' | base64 -d > jane.crt
```

### Who does the signing

The **kube-controller-manager** (CSR-APPROVING and CSR-SIGNING controllers) uses the CA key and cert configured by:

```
--cluster-signing-cert-file=/etc/kubernetes/pki/ca.crt
--cluster-signing-key-file=/etc/kubernetes/pki/ca.key
```

### After the certificate

Give the user permissions with RBAC and a kubeconfig entry:

```bash
kubectl config set-credentials jane --client-certificate=jane.crt --client-key=jane.key --embed-certs
kubectl create role ... ; kubectl create rolebinding ...
```

### Troubleshooting

- CSR stays `Pending`: not approved yet.
- Approved but no certificate: controller manager down or not configured with signing keys.
- `signerName` is required in v1.

### Key takeaways

- CSR object → approve → certificate is issued by the controller manager.
