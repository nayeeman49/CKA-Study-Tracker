@@ 07-Security/02-Kubernetes-Security-Primitives
### What it covers
The first line of defence is the **kube-apiserver**: every action goes through it. Security answers two questions: **who can access** (authentication) and **what can they do** (authorization).

| Layer | Options |
|---|---|
| Authentication | client certificates, static token file (not for production), OIDC/external IdP, service-account tokens |
| Authorization | RBAC (standard), Node, ABAC, Webhook |
| Between components | TLS everywhere (apiserver ↔ etcd, kubelet, scheduler...) |
| Pod ↔ Pod | open by default; restrict with NetworkPolicies |

### Look at your cluster's settings
```
grep -E 'authorization-mode|client-ca-file|enable-admission' /etc/kubernetes/manifests/kube-apiserver.yaml
kubectl auth can-i create deployments --as dev-user -n dev
```
### Watch out
Kubernetes has no User object: identity comes from the credential (certificate CN/O or token claim). Default `authorization-mode` on kubeadm is `Node,RBAC`.

@@ 07-Security/03-Authentication
### What it is
Proving who you are to the API server. Humans (admins/developers) use certificates or an external identity provider; applications use **ServiceAccounts**. You cannot create users with `kubectl`.

### Methods
1. **Client certificates**: signed by the cluster CA (CN = user, O = group). Most common on kubeadm.
2. **Static token/password file** (`--token-auth-file`): insecure, deprecated for real use; basic auth was removed.
3. **OIDC / webhook** with an identity provider.
4. **ServiceAccount tokens**: for Pods and automation.

### How to do it (static token example, lab only)
1. Create `user-details.csv` with `password,user,uid,group` lines.
2. Add `--token-auth-file=/tmp/users/user-details.csv` to the kube-apiserver manifest and mount the file's directory as a hostPath volume.
3. Wait for the API server to restart, then: `curl -v -k https://localhost:6443/api/v1/pods --header "Authorization: Bearer <token>"`.
4. Give the users permissions through RBAC, otherwise they authenticate but are forbidden.

### Watch out
Authenticated is not authorised: a valid token with no Role gets `403 Forbidden`.

@@ 07-Security/04-TLS-Certificates
### What it is
A certificate proves an identity (the **subject**) and binds it to a public key, signed by a **Certificate Authority (CA)**. Clients that trust the CA trust any certificate it signs.

### Key vocabulary
- **Server certificates** (apiserver, etcd, kubelet) vs **client certificates** (admin, scheduler, controller-manager, kube-proxy, kubelet-to-apiserver).
- File names: `.crt`/`.pem` (certificate) and `.key` (private key; never share).
- Kubernetes has a root CA (`ca.crt/ca.key`) and a separate CA for etcd.

### Check a certificate
```
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -issuer -dates -ext subjectAltName
```
### Watch out
The apiserver certificate must list every name/IP clients use (SANs): `kubernetes`, `kubernetes.default`, `kubernetes.default.svc`, `kubernetes.default.svc.cluster.local`, the node IP, the load balancer.

@@ 07-Security/05-TLS-Basics
### The concepts
- **Symmetric encryption**: one shared key; fast, but sharing the key is the problem.
- **Asymmetric**: a key pair; data encrypted with the **public** key is only readable with the **private** key.
- In TLS the client uses the server's public key to securely agree on a symmetric session key.
- A **CA** signs the server's certificate so the client can trust it (browsers ship with CA roots). **mTLS** means the server also verifies a client certificate.

### Commands worth knowing
```
openssl genrsa -out my.key 2048
openssl req -new -key my.key -subj "/CN=kube-admin/O=system:masters" -out my.csr
openssl x509 -req -in my.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out my.crt -days 365
ssh-keygen          # asymmetric keys for SSH, same idea
```
### Why it matters
Every Kubernetes component pair uses these: the next lessons show which certificates exist and how they are made.

@@ 07-Security/06-TLS-in-Kubernetes
### The certificates in a cluster
| Who | Cert type | Notes |
|---|---|---|
| kube-apiserver | server | SANs for all its names/IPs |
| etcd server and peers | server | in `pki/etcd/` |
| kubelet | server | on each node |
| admin, scheduler, controller-manager, kube-proxy | client | to authenticate to the API server |
| apiserver → etcd, apiserver → kubelet | client | `apiserver-etcd-client`, `apiserver-kubelet-client` |
All server/client certs are signed by the cluster CA (etcd may use its own CA).

### Where
kubeadm: `/etc/kubernetes/pki/`; kubeconfigs in `/etc/kubernetes/*.conf`; kubelet certs in `/var/lib/kubelet/pki`.
```
ls -R /etc/kubernetes/pki
kubeadm certs check-expiration
```
### Watch out
Group `system:masters` in a client cert's O field gives cluster-admin. Kubeadm certs expire after one year (CA after ten); renew with `kubeadm certs renew all` or by upgrading the cluster.

@@ 07-Security/07-TLS-in-Kubernetes-Certificate-Creation
### How to do it (manual certificate creation)
1. **Make a CA:**
```
openssl genrsa -out ca.key 2048
openssl req -new -key ca.key -subj "/CN=KUBERNETES-CA" -out ca.csr
openssl x509 -req -in ca.csr -signkey ca.key -out ca.crt -days 3650
```
2. **Client cert (admin):** key → CSR with `/CN=kube-admin/O=system:masters` → sign with the CA (`-CA ca.crt -CAkey ca.key -CAcreateserial`). Same for scheduler (`CN=system:kube-scheduler`) and controller-manager (`CN=system:kube-controller-manager`), kube-proxy (`CN=system:kube-proxy`).
3. **Server cert for the API server:** CSR config with a `[alt_names]` section listing the DNS names and IPs (kubernetes, kubernetes.default, ..., 10.96.0.1, host IP).
4. **Use them:** `curl https://kube-apiserver:6443/api/v1/pods --key admin.key --cert admin.crt --cacert ca.crt`, or put them in a kubeconfig.

### Watch out
kubeadm does all this for you in `pki/`; the exam rarely makes you do it by hand, but you must be able to read and verify certificates.

@@ 07-Security/08-View-Certificate-Details
### How to do it
1. Find which certificate a component uses: look at its manifest, e.g. `grep -E 'crt|pem' /etc/kubernetes/manifests/kube-apiserver.yaml` (`--tls-cert-file`, `--client-ca-file`, `--etcd-certfile`, `--kubelet-client-certificate`).
2. Decode it:
```
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text
```
3. Read: **Subject** (CN), **Subject Alternative Name**, **Issuer** (which CA), **Not After** (expiry).
4. Cluster-wide view: `kubeadm certs check-expiration`.

### Troubleshooting pattern
If a component won't start or cannot connect (when the cluster is broken and `kubectl` doesn't work): read `crictl logs` for `x509: certificate has expired` / `unknown authority` / `valid for X not Y`, fix the manifest path or regenerate the cert (`kubeadm certs renew <name>`), then restart the static Pod.

### Watch out
A certificate path in a manifest pointing at a missing or wrong file is a favourite exam bug; compare with `ls /etc/kubernetes/pki`.

@@ 07-Security/09-Certificate-Health-Check-Spreadsheet
### What it is
A checklist (a downloadable spreadsheet in the course) for auditing every certificate: path, CN, SANs, issuer, expiry, org. It is a way to practise reading certificates systematically rather than an exam task.

### How to do it yourself
For each file in `/etc/kubernetes/pki` run:
```
for f in $(find /etc/kubernetes/pki -name '*.crt'); do
  echo "== $f"; openssl x509 -in $f -noout -subject -issuer -enddate
done
kubeadm certs check-expiration
```
Record: CN, issuer (right CA?), SANs (right names/IPs?), expiry (valid?), purpose.

### Watch out
Look for certificates signed by the wrong CA, expired certificates, and missing SAN entries: these are the classic fault injections in troubleshooting labs.

@@ 07-Security/10-Practice-Test-View-Certificate-Details
### How to work through this lab
1. **API server certificate:** `grep tls-cert-file /etc/kubernetes/manifests/kube-apiserver.yaml`; `openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout` → CN, SANs, validity, issuer.
2. **etcd server cert:** from `/etc/kubernetes/manifests/etcd.yaml` (`--cert-file`) → same openssl command.
3. **Which CA does etcd trust?** `--trusted-ca-file`.
4. **Broken cluster (kube-apiserver down):** `crictl ps -a | grep kube-apiserver`, `crictl logs <id>`; the log names the wrong/expired file. Fix the path in the manifest (e.g. `etcd-ca.crt` instead of `ca.crt`).
5. Wait for the Pod to restart; `kubectl get pods`.

@@ 07-Security/11-Certificate-API
### What it is
A way for users to get certificates signed by the cluster CA **without logging in to the master**: submit a `CertificateSigningRequest` (CSR) object; an admin approves; the controller manager signs it.

### How to do it (new user "jane")
1. Key and CSR:
```
openssl genrsa -out jane.key 2048
openssl req -new -key jane.key -subj "/CN=jane" -out jane.csr
```
2. Create the object (base64 with no line breaks):
```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata: {name: jane}
spec:
  request: <cat jane.csr | base64 -w0>
  signerName: kubernetes.io/kube-apiserver-client
  usages: [client auth]
  expirationSeconds: 86400
```
3. `kubectl get csr` → `kubectl certificate approve jane` (or `deny`).
4. Extract: `kubectl get csr jane -o jsonpath='{.status.certificate}' | base64 -d > jane.crt`.
5. Give permissions via RBAC and use it: `kubectl config set-credentials jane --client-certificate=jane.crt --client-key=jane.key --embed-certs`.

### Watch out
Approval works only if the controller-manager has `--cluster-signing-cert-file/--cluster-signing-key-file`. `signerName` is required in v1. A **group** in the cert's O field maps to RBAC groups.

@@ 07-Security/12-Practice-Test-Certificates-API
### How to work through this lab
1. **Inspect pending CSRs:** `kubectl get csr`; details: `kubectl describe csr agent-smith`.
2. **Approve:** `kubectl certificate approve agent-smith`.
3. **Reject a suspicious request** (e.g. one asking `groups: system:masters`): `kubectl certificate deny agent-smith`.
4. **Delete it:** `kubectl delete csr agent-smith`.
5. **Create your own CSR object** from the supplied request: base64-encode with `cat akshay.csr | base64 -w 0` and fill the template above (add `signerName`, `usages`).
6. Verify status becomes `Approved,Issued` in `kubectl get csr`.

### Tip
Read the CSR's `request` contents to see who is asking: `kubectl get csr <name> -o jsonpath='{.spec.request}' | base64 -d | openssl req -noout -text`.

@@ 07-Security/13-kubeconfig
### What it is
A file telling kubectl **where** the cluster is, **who** you are and which cluster+user+namespace to use together (**context**). Default `~/.kube/config`; override with `--kubeconfig` or `KUBECONFIG`.

### Structure
```yaml
clusters:  [{name: prod, cluster: {server: https://1.2.3.4:6443, certificate-authority: /path/ca.crt}}]
users:     [{name: admin, user: {client-certificate: admin.crt, client-key: admin.key}}]
contexts:  [{name: admin@prod, context: {cluster: prod, user: admin, namespace: finance}}]
current-context: admin@prod
```
### How to do it
```
kubectl config view                      # add --minify for the current context only
kubectl config get-contexts
kubectl config current-context
kubectl config use-context research
kubectl config set-context --current --namespace=dev
kubectl config set-credentials jane --client-certificate=jane.crt --client-key=jane.key
kubectl config --kubeconfig=/root/my-kube-config use-context research
```
### Watch out
Exam tasks tell you a context to use at the start of every question: run it first. Use `certificate-authority-data` (base64) to embed instead of file paths. Wrong file paths in a kubeconfig produce `unable to read certificate-authority`.

@@ 07-Security/14-Practice-Test-KubeConfig
### How to work through this lab
1. **Inspect the default kubeconfig:** `kubectl config view` (cluster name, user name, server address, contexts).
2. **Custom file `my-kube-config`:** `kubectl config view --kubeconfig=/root/my-kube-config`; count contexts; which user/cluster the `research` context uses.
3. **Switch context in the custom file:** `kubectl config --kubeconfig=/root/my-kube-config use-context research`.
4. **Make it permanent:** copy it to `~/.kube/config` (`cp /root/my-kube-config ~/.kube/config`) or `export KUBECONFIG=/root/my-kube-config`.
5. **Troubleshoot a broken kubeconfig:** `kubectl get pods` errors with a wrong file path (e.g. `authority` file name); fix the path in the file (compare with `ls /etc/kubernetes/pki/users`).

### Verify
`kubectl config current-context` and a successful `kubectl get pods`.

@@ 07-Security/15-API-Groups
### What they are
The API is split into groups. **Core (legacy) group** `/api/v1` has Pods, Services, Nodes, Namespaces, ConfigMaps, Secrets, PVs. **Named groups** `/apis/<group>/<version>` have the rest: `apps` (Deployments, ReplicaSets), `networking.k8s.io` (Ingress, NetworkPolicy), `rbac.authorization.k8s.io`, `storage.k8s.io`, `certificates.k8s.io`, `batch`. Each resource has verbs: list, get, create, update, delete, watch.

### How to explore
```
kubectl api-resources                    # kinds, short names, groups, namespaced?
kubectl api-versions
kubectl explain deployment               # shows GROUP/VERSION
kubectl proxy --port=8001 &              # then: curl http://localhost:8001/apis
curl http://localhost:8001/apis/apps/v1/deployments
```
### Why it matters
In RBAC rules you write `apiGroups: [""]` for the core group and `["apps"]` for Deployments. `kubectl proxy` uses your kubeconfig credentials; it is not the same as `kube-proxy`.

@@ 07-Security/16-Authorization
### Authorization modes
After authentication, authorization decides what is allowed. Modes are evaluated in order (`--authorization-mode=Node,RBAC,Webhook`):
- **Node**: lets kubelets access what their node's Pods need.
- **ABAC**: static policy file, needs API server restarts (rare).
- **RBAC**: roles and bindings (standard).
- **Webhook**: ask an external service (e.g. Open Policy Agent).
- AlwaysAllow / AlwaysDeny: testing only.
The first mode that allows wins; if all deny, the request is rejected.

### Check what is configured
`grep authorization-mode /etc/kubernetes/manifests/kube-apiserver.yaml` or `ps aux | grep authorization-mode`.

### Test permissions
`kubectl auth can-i delete nodes`, `kubectl auth can-i create pods --as dev-user -n dev` (admins can impersonate).

@@ 07-Security/17-RBAC
### What it is
Permissions are granted by a **Role** (what) plus a **RoleBinding** (who). Namespaced.

### How to do it
```
kubectl create role developer --verb=list,get,create,update,delete --resource=pods -n dev
kubectl create rolebinding dev-user-binding --role=developer --user=dev-user -n dev
kubectl get roles,rolebindings -n dev
kubectl describe role developer -n dev
kubectl auth can-i create deployments --as dev-user -n dev
```
YAML rule: 
```yaml
rules:
- apiGroups: [""]            # "" = core
  resources: ["pods"]
  verbs: ["get","list","create"]
  resourceNames: ["blue","orange"]     # optional: specific objects
```
Subjects can be `User`, `Group` or `ServiceAccount`.

### Verify
`kubectl auth can-i ... --as <user>` (yes/no). A denied call shows `Error from server (Forbidden): pods is forbidden: User "dev-user" cannot ...`.

### Watch out
No deny rules: access is additive. Resource names are plural lowercase (`deployments`), and Deployments are in group `apps`. Roles in one namespace don't apply elsewhere.

@@ 07-Security/18-Practice-Test-RBAC
### How to work through this lab
1. **Inspect the API server authorization mode:** `kubectl describe pod kube-apiserver-controlplane -n kube-system | grep authorization-mode`.
2. **List roles and bindings:** `kubectl get roles,rolebindings -A`; permissions: `kubectl describe role kube-proxy -n kube-system`.
3. **Which user is bound to a role?** `kubectl describe rolebinding <name> -n <ns>`.
4. **Test a user:** `kubectl get pods --as dev-user`.
5. **Create the role and binding** for dev-user: `kubectl create role developer --verb=list,create,delete --resource=pods`; `kubectl create rolebinding dev-user-binding --role=developer --user=dev-user`.
6. **Edit the role** to add a resource/resourceName: `kubectl edit role developer -n blue` (add `apiGroups: ["apps"]`, `resources: ["deployments"]`).

### Verify
`kubectl auth can-i create deployments --as dev-user -n blue`.

@@ 07-Security/19-Cluster-Roles
### What it is
A **ClusterRole** is non-namespaced: for cluster-scoped resources (nodes, PVs, namespaces, CSRs, storage classes) or to reuse one role across namespaces. A **ClusterRoleBinding** grants it cluster-wide; a RoleBinding that references a ClusterRole grants it only in that namespace.

### How to do it
```
kubectl create clusterrole node-admin --verb=get,list,watch,create,delete --resource=nodes
kubectl create clusterrolebinding michelle-binding --clusterrole=node-admin --user=michelle
kubectl create clusterrole storage-admin --verb=list,create,get,watch --resource=persistentvolumes,storageclasses
kubectl api-resources --namespaced=false        # which resources are cluster scoped
```
### Verify
`kubectl auth can-i list nodes --as michelle`.

### Watch out
Built-in ones: `cluster-admin`, `admin`, `edit`, `view`. A ClusterRole with `resources: pods` bound with a ClusterRoleBinding gives access to Pods in **all** namespaces.

@@ 07-Security/20-Practice-Test-Cluster-Roles
### How to work through this lab
1. **List cluster roles and bindings:** `kubectl get clusterroles --no-headers | wc -l`, `kubectl get clusterrolebindings`; subjects: `kubectl describe clusterrolebinding cluster-admin`.
2. **Create `michelle` node access:** `kubectl create clusterrole nodeadmin --verb=get,watch,list,create,delete --resource=nodes` then `kubectl create clusterrolebinding michelle-binding --clusterrole=nodeadmin --user=michelle`.
3. **Add storage access:** create `storage-admin` for `persistentvolumes` and `storageclasses`, bind it to `michelle`.
4. **Test:** `kubectl get nodes --as michelle`; `kubectl auth can-i list storageclasses --as michelle`.

### Watch out
PVs and StorageClasses are cluster scoped: they need a ClusterRole, not a Role.

@@ 07-Security/21-Service-Account
### What it is
Identity for processes in Pods (users are for humans). Each namespace has a `default` ServiceAccount. Since v1.24 no long-lived Secret is created automatically; Pods get a **projected, expiring token** mounted at `/var/run/secrets/kubernetes.io/serviceaccount`.

### How to do it
```
kubectl create serviceaccount dashboard-sa
kubectl create token dashboard-sa                    # short-lived token for external use
kubectl get sa
```
Attach to a Pod: `spec.serviceAccountName: dashboard-sa` (set at creation; for Deployments edit the template). Disable automount with `automountServiceAccountToken: false`. Grant permissions with a RoleBinding/ClusterRoleBinding whose subject is `kind: ServiceAccount, name: dashboard-sa, namespace: default`.

### Long-lived token (only if required)
Create a Secret of type `kubernetes.io/service-account-token` with annotation `kubernetes.io/service-account.name: dashboard-sa`.

### Verify
`kubectl describe pod` (Service Account, token mount); inside the Pod: `cat /var/run/secrets/kubernetes.io/serviceaccount/token`.

@@ 07-Security/22-Practice-Test-Service-Accounts
### How to work through this lab
1. **List service accounts:** `kubectl get sa`; `kubectl describe sa default`.
2. **Which SA does the Pod use?** `kubectl describe pod web-dashboard | grep -i service`.
3. **Create a SA:** `kubectl create serviceaccount dashboard-sa`.
4. **Grant it pod-reader permissions:** apply the provided Role/RoleBinding YAML (bind `dashboard-sa` as subject).
5. **Create a token:** `kubectl create token dashboard-sa` and paste it into the dashboard app.
6. **Change the Pod's SA:** edit the Deployment (`kubectl edit deploy web-dashboard`) → `spec.template.spec.serviceAccountName: dashboard-sa` (Pod YAML is immutable; Deployment will roll).

### Verify
The dashboard lists Pods; `kubectl describe pod` shows the new SA.

@@ 07-Security/23-Image-Security
### What it is
Images come from registries (`docker.io/library/nginx` → `nginx`). A **private registry** needs credentials; Kubernetes stores them in a `docker-registry` Secret and Pods reference it via `imagePullSecrets`.

### How to do it
```
kubectl create secret docker-registry regcred \
  --docker-server=private-registry.io --docker-username=registry-user \
  --docker-password=registry-password --docker-email=registry-user@org.com
```
```yaml
spec:
  containers:
  - name: nginx
    image: private-registry.io/apps/internal-app
  imagePullSecrets:
  - name: regcred
```
Attach to the default SA to apply to all Pods: `kubectl patch sa default -p '{"imagePullSecrets":[{"name":"regcred"}]}'`.

### Verify
`kubectl describe pod` Events show `Successfully pulled image`; failures show `ErrImagePull`/`ImagePullBackOff` with `pull access denied`.

### Watch out
The Secret must be in the same namespace as the Pod. Prefer pinned tags/digests (`image@sha256:...`) and never `latest` in production.

@@ 07-Security/24-Practice-Test-Image-Security
### How to work through this lab
1. **Which image is a Pod using?** `kubectl describe pod <name> | grep -i image`. The registry host is the part before the first `/` (no host → Docker Hub).
2. **Create a Secret** for the private registry: `kubectl create secret docker-registry private-reg-cred --docker-username=dock_user --docker-password=dock_password --docker-server=myprivateregistry.com:5000 --docker-email=dock_user@myprivateregistry.com`.
3. **Update the Deployment** to use it: `kubectl edit deploy web` → under `spec.template.spec` add `imagePullSecrets: - name: private-reg-cred`; `image: myprivateregistry.com:5000/nginx:alpine`.
4. **Verify:** Pods Running; `kubectl rollout status deployment web`.

@@ 07-Security/25-Security-Context
### What it is
Settings controlling the privileges of containers: user ID, group, Linux capabilities, privilege escalation, read-only filesystem. Set at **Pod level** (applies to all containers) or **container level** (overrides Pod level; only container supports `capabilities`).

### How to do it
```yaml
spec:
  securityContext:          # pod level
    runAsUser: 1000
    fsGroup: 2000
  containers:
  - name: ubuntu
    image: ubuntu
    command: ["sleep","3600"]
    securityContext:        # container level
      runAsUser: 1001
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_ADMIN","SYS_TIME"]
```
### Verify
`kubectl exec <pod> -- whoami` / `id`; `kubectl exec <pod> -- ps aux` shows the UID of the main process.

### Watch out
`runAsNonRoot: true` makes the Pod fail to start if the image is root. Capabilities can't be set at Pod level. `kubectl exec ... -- sh -c 'touch /x'` tests read-only filesystems.

@@ 07-Security/26-Practice-Test-Security-Context
### How to work through this lab
1. **Which user runs the Pod?** `kubectl exec ubuntu-sleeper -- whoami`.
2. **Edit to run as user 1010:** Pod YAML is immutable for this field → `kubectl get pod ubuntu-sleeper -o yaml > p.yaml`; add `securityContext: runAsUser: 1010` under `spec`; `kubectl replace --force -f p.yaml`.
3. **Pod level vs container level:** a container-level `runAsUser` wins over the Pod-level one.
4. **Add capabilities:** under the container's `securityContext: capabilities: add: ["SYS_TIME"]` (and `NET_ADMIN`), then recreate the Pod.
5. Verify with `kubectl exec <pod> -- whoami` and check the Pod is `Running`.

@@ 07-Security/27-Network-Policies
### What it is
Firewall rules for Pods. By default every Pod can talk to every Pod. A **NetworkPolicy** selects Pods (`podSelector`) and lists allowed `ingress` and/or `egress`. Once a Pod is selected by any policy for a direction, **only** listed traffic is allowed in that direction. Needs a CNI that enforces policies (Calico, Cilium, Weave; **not** Flannel alone).

### How to do it
Example: only `api-pod` in namespace `prod` may reach `db` on 3306:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-policy}
spec:
  podSelector: {matchLabels: {role: db}}
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector: {matchLabels: {name: api-pod}}
      namespaceSelector: {matchLabels: {name: prod}}   # same list item = AND
    - ipBlock: {cidr: 192.168.5.10/32}                  # separate item = OR
    ports: [{protocol: TCP, port: 3306}]
```
### Verify
`kubectl get netpol`; `kubectl describe netpol db-policy`; test from a client Pod with `wget -qO- -T2 db:3306` or `nc -zv`.

### Watch out
**AND vs OR**: `podSelector` and `namespaceSelector` in the *same* `from` entry are ANDed; separate `-` entries are ORed. If you restrict egress, allow DNS (UDP/TCP 53). Policies are additive (union of all matching policies). Policies don't affect traffic to the same Pod's node IP in some CNIs.

@@ 07-Security/28-Practice-Test-Network-Policies
### How to work through this lab
1. **Inspect:** `kubectl get netpol`; `kubectl describe netpol payroll-policy` (which Pods it applies to, allowed sources/ports).
2. **Which Pods are affected?** compare `PodSelector` with `kubectl get pods --show-labels`.
3. **Create a policy** that allows ingress to `internal` only from `payroll` on 8080 and egress to `mysql` 3306 and `payroll` 8080:
write YAML with `policyTypes: [Egress]`, `podSelector: {matchLabels: {name: internal}}`, `egress:` rules with `to.podSelector` and `ports`; `kubectl apply -f policy.yaml`.
4. **Test:** from a test Pod `kubectl exec -it internal -- sh -c 'nc -zv payroll 8080'`.

### Tip
Use the docs example as a template (search "network policies"). Remember `namespaceSelector` needs the namespace labelled: `kubectl label ns prod name=prod` (or use `kubernetes.io/metadata.name`).

@@ 07-Security/29-kubectx-and-kubens-commands
### What they are
Convenience tools to switch **contexts** (`kubectx`) and default **namespaces** (`kubens`) quickly. Not installed on the exam, so know the plain kubectl equivalents.

### How to do it
```
kubectx                    # list contexts           = kubectl config get-contexts
kubectx dev                # switch context          = kubectl config use-context dev
kubens                     # list namespaces
kubens kube-system         # set default namespace   = kubectl config set-context --current --namespace=kube-system
```
Install on your own machine: `brew install kubectx`, or from https://github.com/ahmetb/kubectx.

### Exam tip
Your first command for each question is the `kubectl config use-context ...` line given in the task; add `alias kn='kubectl config set-context --current --namespace'` to switch namespaces fast.
