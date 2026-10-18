## What this section is about
Authentication, authorization (RBAC), TLS and certificates, kubeconfig, service accounts, image security, security contexts and network policies. RBAC and certificates feature heavily in the *Cluster Architecture* domain (25%); NetworkPolicies appear in *Services & Networking*.

## Request pipeline
Every API request passes: **Authentication** (who are you?) → **Authorization** (are you allowed?) → **Admission control** (mutate/validate) → persisted. Authenticators include client certificates, bearer tokens, OIDC and service-account tokens. Kubernetes has no User object; users are whatever the credential says (certificate CN = user, O = group).

## TLS and certificates
All control-plane communication is mTLS. On kubeadm clusters certificates live in `/etc/kubernetes/pki` (CA, apiserver, apiserver-kubelet-client, etcd/, front-proxy, sa keys). Inspect with:
```
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A2 -E "Subject:|Alternative|Not After"
kubeadm certs check-expiration
kubeadm certs renew all
```
**Certificates API**: create a user by generating a key and CSR, then submit a `CertificateSigningRequest` (`signerName: kubernetes.io/kube-apiserver-client`, base64 CSR in `spec.request`), `kubectl certificate approve <name>`, and fetch `status.certificate`.

## kubeconfig
Holds clusters, users and contexts (`~/.kube/config`). `kubectl config get-contexts`, `use-context`, `set-context --current --namespace=x`, `view --minify`. Use `--kubeconfig` or `KUBECONFIG` to switch files.

## RBAC
- **Role** / **ClusterRole**: lists of `verbs` on `resources` (and `apiGroups`). A Role is namespaced; ClusterRole is cluster-wide or for non-namespaced resources (nodes, PVs).
- **RoleBinding** / **ClusterRoleBinding** attach a role to users, groups or service accounts. A RoleBinding may reference a ClusterRole to grant it only within one namespace.
```
kubectl create role pod-reader --verb=get,list,watch --resource=pods -n dev
kubectl create rolebinding rb --role=pod-reader --user=jane -n dev
kubectl auth can-i list pods -n dev --as jane
kubectl create clusterrole node-admin --verb='*' --resource=nodes
```
RBAC is additive only; there are no deny rules. `kubectl auth can-i --list --as ...` shows effective permissions.

## Service accounts
Pods authenticate to the API as a ServiceAccount. Since 1.24 tokens are short-lived and projected; create a token with `kubectl create token sa-name`. Set `serviceAccountName` in the Pod spec, and `automountServiceAccountToken: false` when it is not needed.

## Image security
Private registries: `kubectl create secret docker-registry regcred --docker-server=... --docker-username=... --docker-password=...` and reference it under `imagePullSecrets`. Prefer pinned tags/digests.

## Security context and Pod Security
`securityContext` at Pod or container level: `runAsUser`, `runAsNonRoot`, `fsGroup`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem`, `capabilities.add/drop`. Container-level settings override Pod-level. **Pod Security Admission** enforces Pod Security Standards (`privileged`, `baseline`, `restricted`) per namespace with labels such as `pod-security.kubernetes.io/enforce: restricted`.

## Network policies
By default all Pods can talk to all Pods. A NetworkPolicy selects Pods (`podSelector`) and, once any policy selects a Pod for a direction, only listed traffic is allowed for it. Rules combine `podSelector`, `namespaceSelector` and `ipBlock`; **items in the same `from` entry are ANDed, separate entries are ORed** (a classic trap). Remember egress to DNS (UDP/TCP 53) if you restrict egress. Enforcement needs a CNI that supports it (Calico, Cilium; Flannel alone does not).

## Exam tips
- `kubectl auth can-i` and `--as` verify your RBAC without guessing.
- Use `kubectl create role/rolebinding ... --dry-run=client -o yaml` and `kubectl explain` for NetworkPolicy fields.
- A wrong/expired apiserver certificate usually shows in the kube-apiserver logs and `openssl` output.

## Official documentation
- [Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Authenticating](https://kubernetes.io/docs/reference/access-authn-authz/authentication/), [Certificate Signing Requests](https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/)
- [Certificate Management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [Configure Service Accounts for Pods](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)
- [Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/), [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Pull an Image from a Private Registry](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/)
- [Organizing cluster access using kubeconfig files](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/)
