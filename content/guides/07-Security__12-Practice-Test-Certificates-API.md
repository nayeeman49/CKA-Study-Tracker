### How to approach this lab

Create a CSR for a user, approve it, and reject a suspicious one.

### Commands

```bash
cat akshay.csr | base64 -w 0
vi akshay-csr.yaml
kubectl apply -f akshay-csr.yaml
kubectl get csr
kubectl certificate approve akshay
kubectl get csr agent-smith -o yaml        # examine requested groups
kubectl certificate deny agent-smith
kubectl delete csr agent-smith
```

### Notes

- A CSR that requests `system:masters` is suspicious; deny it.
- `base64 -w 0` avoids line wraps in the YAML value.
- The CSR YAML needs `usages: ["client auth"]` and `signerName: kubernetes.io/kube-apiserver-client`.

### Worked example

```bash
cat akshay.csr | base64 -w 0
```

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: akshay
spec:
  groups: [system:authenticated]
  signerName: kubernetes.io/kube-apiserver-client
  usages: [client auth]
  request: <paste base64>
```

```bash
kubectl apply -f akshay.yaml
kubectl get csr
kubectl certificate approve akshay
kubectl get csr agent-smith -o yaml | grep -A3 groups      # requests system:masters?
kubectl certificate deny agent-smith
```

### Common mistakes

- Line breaks inside the base64 string.
- Forgetting `signerName`.
