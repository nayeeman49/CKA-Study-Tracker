@@ 07-Security/02-Kubernetes-Security-Primitives
### Introduction

Security in Kubernetes is layered. Everything starts at the API Server, because every action goes through it. This page maps the questions you must answer: who can access the cluster, and what can they do?

### Layers

```
 Client ─► [Authentication] ─► [Authorization] ─► [Admission] ─► API action
            who are you?        what may you do?    policy checks
```

### Hosts and components

- Secure the nodes: disable password SSH, use key-based login, disable root login.
- Keep the control plane reachable only by necessary networks.

### Authentication (who)

Mechanisms for the API Server:

- Static password / token files (basic, **not for production**, removed in modern versions).
- Client certificates (X509).
- External identity providers: LDAP, OIDC, Kerberos.
- Service accounts for machines.

### Authorization (what)

- **RBAC** (role based) - standard.
- **ABAC** (attribute based) - old, file-based.
- **Node authorizer** - for kubelets.
- **Webhook** - external service decides.
- `AlwaysAllow` / `AlwaysDeny` - testing.

### Other protections

| Area | Mechanism |
|---|---|
| Communication | TLS between all components |
| Pod-to-Pod | NetworkPolicies (default: all allowed) |
| Workload | SecurityContext, Pod Security Standards |
| Images | Private registries, image pull secrets |
| Secrets | RBAC, encryption at rest |
| Admission | Admission controllers, ValidatingAdmissionPolicy |

### Key takeaways

- Authentication → authorization → admission, all at the API Server.
- Every lesson in this section implements one layer.

@@ 07-Security/03-Authentication
### Introduction

Kubernetes has no user objects. Users are external identities, authenticated by credentials presented to the API Server. Service accounts are the only built-in "machine" identities.

### Types of accounts

| Type | Managed by | Used by |
|---|---|---|
| User | Outside Kubernetes (certs, tokens, OIDC) | Humans, admins |
| Service Account | Kubernetes objects | Pods / applications |

### Methods

#### Client certificates (most common for admins)

The user presents a certificate signed by the cluster CA. The CN becomes the username and O the group. This is how `kubeadm` creates `kubernetes-admin` (group `system:masters`).

#### Bearer tokens

- Service account tokens (JWT, mostly short-lived and projected).
- Static token file: `--token-auth-file`.
- Bootstrap tokens for `kubeadm join`.

#### Static password file (legacy)

```
password,user,uid,group
```

passed with `--basic-auth-file`. Removed from current Kubernetes; do not use.

#### External

OIDC (Google, Keycloak, Dex), webhook token authentication, authenticating proxy.

### Example: static token file (legacy / lab)

```
# /tmp/users/user-token-details.csv
token1,user1,u0001,group1
```

API Server option `--token-auth-file=/tmp/users/user-token-details.csv`, and if run as a Pod you must mount the file.

```bash
curl -v -k https://master:6443/api/v1/pods --header "Authorization: Bearer token1"
```

### Anonymous requests

`--anonymous-auth` allows unauthenticated requests (user `system:anonymous`). Authorization still applies; health endpoints use it.

### Checking who you are

```bash
kubectl auth whoami
kubectl auth can-i create pods
kubectl config view
```

### Key takeaways

- Users aren't objects; credentials identify them.
- Certificates are the standard for humans; tokens for machines.

@@ 07-Security/04-TLS-Certificates
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

@@ 07-Security/05-TLS-Basics
### Introduction

TLS provides encryption in transit and authentication.

### Symmetric vs asymmetric encryption

| | Symmetric | Asymmetric |
|---|---|---|
| Keys | One shared key | Public + private key pair |
| Speed | Fast | Slow |
| Problem | Key distribution | Used to solve it |

A public key encrypts; only the matching private key decrypts. Public keys can be shared freely.

### The TLS handshake

```
 client                                   server
   │ ── hello ─────────────────────────►    │
   │ ◄── certificate (server public key) ── │
   │ verify cert is signed by trusted CA    │
   │ generate symmetric key, encrypt it     │
   │ ── with the server's public key ─────► │
   │      both now use the symmetric key    │
```

### Certificates and CAs

A **certificate** binds a public key to an identity (name), signed by a **Certificate Authority**. Browsers trust public CAs. Inside a cluster you run a **private CA**.

```
 file         role
 *.crt, *.pem public key / certificate
 *.key        private key
```

Generate a key and a signing request:

```bash
openssl genrsa -out my.key 2048
openssl req -new -key my.key -subj "/CN=my-server" -out my.csr
openssl x509 -req -in my.csr -CA ca.crt -CAkey ca.key -out my.crt -days 365
```

### Client certificates

Servers can also demand a client certificate (mutual TLS) to authenticate the client. Used heavily between Kubernetes components.

### PKI

Public Key Infrastructure: CAs, certificates, and the process of issuing and managing them.

### Key takeaways

- Asymmetric encryption exchanges a symmetric key.
- CA-signed certificates prove identity.

@@ 07-Security/06-TLS-in-Kubernetes
### Introduction

A cluster has many certificates. Knowing which is which is key to troubleshooting.

### Certificate map

```
                 CA (ca.crt/ca.key)
        signs ───────┬──────────────────────┐
                     ▼                      ▼
 Server certificates              Client certificates
  apiserver.crt/key                admin.crt/key
  etcd server.crt/key              scheduler.crt/key
  kubelet server certs             controller-manager.crt/key
                                   kube-proxy.crt/key
                                   apiserver-etcd-client.crt/key
                                   apiserver-kubelet-client.crt/key
```

| Component | Role | Certificate |
|---|---|---|
| kube-apiserver | server | `apiserver.crt` |
| kube-apiserver | client of etcd | `apiserver-etcd-client.crt` |
| kube-apiserver | client of kubelets | `apiserver-kubelet-client.crt` |
| etcd | server | `etcd/server.crt` |
| etcd peers | server/client | `etcd/peer.crt` |
| kubelet | server | `kubelet.crt` |
| kubelet | client of API server | `kubelet-client-current.pem` |
| scheduler, controller manager, kube-proxy, admin | client | each own client cert |

### Multiple CAs

The cluster CA signs most; ETCD can use its own CA (`/etc/kubernetes/pki/etcd/ca.crt`). The front proxy has another.

### Locations (kubeadm)

```
/etc/kubernetes/pki/
   ca.crt  ca.key
   apiserver.crt  apiserver.key
   apiserver-etcd-client.crt/key
   apiserver-kubelet-client.crt/key
   front-proxy-ca.crt ...
   sa.key  sa.pub                  # service account signing
   etcd/ca.crt  server.crt  peer.crt ...
/etc/kubernetes/*.conf              # kubeconfigs for admin, scheduler, controller manager, kubelet
/var/lib/kubelet/pki/               # kubelet certs
```

### Key takeaways

- Every component needs a cert; servers and clients.
- Know the files and where they live.

@@ 07-Security/07-TLS-in-Kubernetes-Certificate-Creation
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

@@ 07-Security/08-View-Certificate-Details
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

@@ 07-Security/09-Certificate-Health-Check-Spreadsheet
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

@@ 07-Security/10-Practice-Test-View-Certificate-Details
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

@@ 07-Security/11-Certificate-API
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

@@ 07-Security/12-Practice-Test-Certificates-API
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

@@ 07-Security/13-kubeconfig
### Introduction

A kubeconfig file stores how to reach clusters and who you are, so you don't pass certificates on every command. Default location `$HOME/.kube/config`.

### Structure

```yaml
apiVersion: v1
kind: Config
current-context: dev-user@dev-cluster
clusters:
- name: dev-cluster
  cluster:
    server: https://dev:6443
    certificate-authority: /etc/kubernetes/pki/ca.crt
    # or certificate-authority-data: <base64>
users:
- name: dev-user
  user:
    client-certificate: /path/dev.crt
    client-key: /path/dev.key
contexts:
- name: dev-user@dev-cluster
  context:
    cluster: dev-cluster
    user: dev-user
    namespace: dev
```

Three sections: **clusters** (where), **users** (who), **contexts** (cluster + user + namespace).

### Commands

```bash
kubectl config view
kubectl config get-contexts
kubectl config current-context
kubectl config use-context prod-user@production
kubectl config set-context --current --namespace=dev
kubectl config set-cluster ...
kubectl config set-credentials ...
kubectl config set-context ...
kubectl config delete-context ...
```

### Using a different file

```bash
kubectl --kubeconfig=/root/my-kube-config get pods
export KUBECONFIG=/root/my-kube-config
export KUBECONFIG=~/.kube/config:~/other-config      # merged
KUBECONFIG=/root/my-kube-config kubectl config use-context research
```

To make a file the default, copy it to `~/.kube/config`.

### Certificates in a kubeconfig

Use paths (`certificate-authority`) or embed base64 (`certificate-authority-data`).

### Namespace in a context

A context can set a default namespace, which changes where `kubectl` commands apply.

### Troubleshooting

- "The connection to the server localhost:8080 was refused": no kubeconfig found.
- Wrong server address or CA path: errors mention x509.
- Use `kubectl config view --minify` to see the active context only.

### CKA exam tips

- Many exam tasks begin with `kubectl config use-context <name>`; always run the command provided.

### Key takeaways

- Clusters + users + contexts; switch with `use-context`.

@@ 07-Security/14-Practice-Test-KubeConfig
### How to approach this lab

Inspect the default kubeconfig, switch contexts, and repair a broken file.

### Commands

```bash
kubectl config view
kubectl config get-contexts
kubectl config use-context research --kubeconfig /root/my-kube-config
kubectl config current-context --kubeconfig /root/my-kube-config
export KUBECONFIG=/root/my-kube-config
vi /root/.kube/config          # fix path/typos
cp /root/my-kube-config /root/.kube/config
```

### Fixing a broken kubeconfig

Typical issue: the `certificate-authority` or client certificate path has a typo (`ca.crt` vs `ca.crt`), or wrong port. Compare to files in `/etc/kubernetes/pki/users/`.

### Notes

- Count entries: clusters, users, contexts via `kubectl config view`.
- `--kubeconfig` overrides the default location for that command.
