@@ 07-Security/15-API-Groups
### Introduction

All Kubernetes capabilities are exposed through the REST API, organised into groups. Understanding groups is needed for RBAC rules (`apiGroups`).

### Two categories

| Category | Path | Resources |
|---|---|---|
| Core (legacy) | `/api/v1` | pods, namespaces, nodes, services, configmaps, secrets, PV, PVC, events |
| Named | `/apis/<group>/<version>` | apps, batch, networking.k8s.io, rbac.authorization.k8s.io, storage.k8s.io, certificates.k8s.io, policy, autoscaling |

```
/api/v1/pods
/apis/apps/v1/deployments
/apis/networking.k8s.io/v1/networkpolicies
/apis/certificates.k8s.io/v1/certificatesigningrequests
```

Within each group are **resources** and **verbs** (`list, get, create, delete, update, patch, watch`).

### Discovering

```bash
kubectl api-resources -o wide              # kind, group, namespaced, verbs
kubectl api-resources --api-group=apps
kubectl api-versions
curl http://localhost:8001/apis | grep name
kubectl proxy 8001 &
```

### Versions

`v1` (stable), `v1beta1` (beta, may change), `v1alpha1` (alpha, disabled by default). Preferred version is chosen by the API Server.

### Why it matters

An RBAC rule must name the right group:

```yaml
rules:
- apiGroups: [""]           # core group is the empty string
  resources: ["pods"]
  verbs: ["get","list"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["create"]
```

### Key takeaways

- Core group is `""`; others have names; check with `kubectl api-resources`.

@@ 07-Security/16-Authorization
### Introduction

Once authenticated, the API Server must decide whether the identity can perform an action. Authorization restricts users to the minimum permissions they need.

### Mechanisms

| Mode | Description |
|---|---|
| **Node** | Authorises kubelets (identities `system:node:<name>` in group `system:nodes`) to read what their Pods need |
| **ABAC** | Policy file of user/action pairs; must restart API Server to change; not recommended |
| **RBAC** | Roles bound to users/groups/service accounts; standard |
| **Webhook** | Ask an external service |
| AlwaysAllow / AlwaysDeny | Testing |

Set with:

```
--authorization-mode=Node,RBAC,Webhook
```

Modes are evaluated **in order**; the first that approves or denies decides. `Node` is checked first. If a mode says "no opinion", the next one is consulted. If none approve, the request is denied.

### Check the current mode

```bash
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep authorization-mode
ps -aux | grep kube-apiserver | grep authorization
```

### Testing

```bash
kubectl auth can-i create deployments
kubectl auth can-i delete nodes
kubectl auth can-i create pods --as dev-user
kubectl auth can-i create pods --as dev-user --namespace test
kubectl auth can-i --list
```

### Key takeaways

- Node,RBAC is the kubeadm default.
- `kubectl auth can-i` verifies permissions.

@@ 07-Security/17-RBAC
### Introduction

Role-Based Access Control grants permissions to roles, then binds roles to subjects (users, groups, service accounts).

```
 Subject ◄── RoleBinding ──► Role ──► rules (apiGroups, resources, verbs)
```

### Role (namespaced)

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["list","get","create","update","delete"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["create"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  resourceNames: ["web"]          # restrict to specific objects
  verbs: ["get","update"]
```

Imperative:

```bash
kubectl create role developer --verb=list,get,create --resource=pods -n default
kubectl create role dev --verb=get --resource=pods --resource-name=blue,orange
```

### RoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: devuser-developer-binding
  namespace: default
subjects:
- kind: User
  name: dev-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl create rolebinding devuser-developer-binding --role=developer --user=dev-user
kubectl create rolebinding x --role=developer --group=devs
kubectl create rolebinding x --role=developer --serviceaccount=default:sa1
```

### Inspect

```bash
kubectl get roles
kubectl get rolebindings
kubectl describe role developer
kubectl describe rolebinding devuser-developer-binding
kubectl auth can-i create pods --as dev-user
```

### Key rules

- Roles and RoleBindings are **namespaced** and apply in their namespace only.
- Permissions are additive (no deny rules).
- `roleRef` is immutable after creation.
- A Pod can't get more rights than its service account.

### Troubleshooting

- "forbidden: User ... cannot list resource": missing role/binding, wrong namespace, wrong apiGroup, wrong verb.
- Mismatch between `kind: User` name and certificate CN.

### Key takeaways

- Role (what) + RoleBinding (who).

@@ 07-Security/18-Practice-Test-RBAC
### How to approach this lab

Inspect existing RBAC, then grant or fix a user's permissions.

### Commands

```bash
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep authorization
kubectl get roles
kubectl get rolebindings -A
kubectl describe role kube-proxy -n kube-system
kubectl describe rolebinding kube-proxy -n kube-system
kubectl get pods --as dev-user
kubectl create role developer --namespace=default --verb=list,create,delete --resource=pods
kubectl create rolebinding dev-user-binding --namespace=default --role=developer --user=dev-user
kubectl edit role developer -n blue        # add resources/apiGroups
kubectl auth can-i create deployments --as dev-user -n blue
```

### Notes

- When a user can't create Deployments, add the `apps` group in a rule.
- `resourceNames` limits to named Pods.
- Always test with `--as`.

@@ 07-Security/19-Cluster-Roles
### Introduction

Some resources are cluster-scoped (nodes, PVs, namespaces), and sometimes you want rights across all namespaces. For those use ClusterRole and ClusterRoleBinding.

### Namespaced vs cluster-scoped

```bash
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
```

### ClusterRole

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-admin
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get","watch","list","create","delete"]
```

### ClusterRoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-admin-binding
subjects:
- kind: User
  name: cluster-admin-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-admin
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl create clusterrole node-admin --verb=get,list,watch --resource=nodes
kubectl create clusterrolebinding node-admin-binding --clusterrole=node-admin --user=michelle
```

### Cluster role with a RoleBinding

A RoleBinding can reference a ClusterRole to grant its permissions **inside one namespace** (reuse of common roles).

### Built-in cluster roles

`cluster-admin`, `admin`, `edit`, `view`, plus system roles (`system:node`, `system:kube-scheduler`...).

```bash
kubectl get clusterroles | wc -l
kubectl describe clusterrole view
```

### Key takeaways

- ClusterRole + ClusterRoleBinding = cluster-wide access.

@@ 07-Security/20-Practice-Test-Cluster-Roles
### How to approach this lab

Create a ClusterRole for nodes or storage and bind it to a user, then test.

### Commands

```bash
kubectl get clusterroles --no-headers | wc -l
kubectl get clusterrolebindings --no-headers | wc -l
kubectl describe clusterrolebinding cluster-admin
kubectl create clusterrole nodeadmin --verb=get,watch,list,create,delete --resource=nodes
kubectl create clusterrolebinding michelle-binding --clusterrole=nodeadmin --user=michelle
kubectl auth can-i list nodes --as michelle
kubectl create clusterrole storage-admin --resource=persistentvolumes,storageclasses --verb=get,watch,list,create,delete
kubectl create clusterrolebinding michelle-storage-admin --user=michelle --clusterrole=storage-admin
```

### Note

`storageclasses` live in the `storage.k8s.io` group; `kubectl create clusterrole` picks the group automatically from the resource name.

@@ 07-Security/21-Service-Account
### Introduction

A service account (SA) is an identity for applications running in Pods, used to authenticate to the API Server.

### Basics

```bash
kubectl create serviceaccount dashboard-sa
kubectl get sa
kubectl describe sa dashboard-sa
```

Each namespace has a `default` SA that Pods use unless they specify another.

### Tokens

Modern clusters (v1.24+):

- Pods get a **projected, time-limited token** automatically mounted at `/var/run/secrets/kubernetes.io/serviceaccount/` (token, ca.crt, namespace).
- No long-lived Secret is created automatically.
- Create a token on demand:

```bash
kubectl create token dashboard-sa
kubectl create token dashboard-sa --duration=1h
```

- Legacy long-lived token Secret (if needed):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sa-token
  annotations:
    kubernetes.io/service-account.name: dashboard-sa
type: kubernetes.io/service-account-token
```

### Use in a Pod

```yaml
spec:
  serviceAccountName: dashboard-sa
  automountServiceAccountToken: false     # optional: don't mount a token
  containers:
  - name: app
    image: nginx
```

The SA of an existing Pod can't be changed; Deployments allow it by editing the template.

### Authorising a service account

```bash
kubectl create role pod-reader --verb=get,list --resource=pods
kubectl create rolebinding sa-binding --role=pod-reader --serviceaccount=default:dashboard-sa
```

Subject form: `system:serviceaccount:<namespace>:<name>`.

### Using the token from outside

```bash
TOKEN=$(kubectl create token dashboard-sa)
curl -k https://<api>:6443/api/v1/namespaces/default/pods -H "Authorization: Bearer $TOKEN"
```

### Image pull secrets on a SA

```bash
kubectl patch sa default -p '{"imagePullSecrets":[{"name":"regcred"}]}'
```

### Key takeaways

- SAs are namespaced identities for Pods; bind roles to give permissions.

@@ 07-Security/22-Practice-Test-Service-Accounts
### How to approach this lab

Create an SA, give a Pod that SA, and check its permissions.

### Commands

```bash
kubectl get sa
kubectl describe sa default
kubectl create serviceaccount dashboard-sa
kubectl create token dashboard-sa
kubectl get pod web-dashboard -o yaml > d.yaml
vi d.yaml            # add spec.serviceAccountName: dashboard-sa
kubectl replace --force -f d.yaml
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding read-pods --role=pod-reader --serviceaccount=default:dashboard-sa
kubectl auth can-i list pods --as system:serviceaccount:default:dashboard-sa
```

### Notes

- In a Deployment edit `spec.template.spec.serviceAccountName`; the Pods roll.
- `kubectl describe pod` shows `Service Account:` and the token mount.

@@ 07-Security/23-Image-Security
### Introduction

Images come from registries. Private registries need credentials, which a Pod provides through an image pull secret.

### Image names

```
nginx                          = docker.io/library/nginx:latest
myrepo/app:1.2                 = docker.io/myrepo/app:1.2
gcr.io/project/app:v3          = registry gcr.io
private-registry.io/apps/web   = private registry
```

Avoid `:latest`; pin tags or, better, digests (`image@sha256:...`).

### Using a private registry

1. Create a Docker registry secret:

```bash
kubectl create secret docker-registry regcred \
  --docker-server=private-registry.io \
  --docker-username=registry-user \
  --docker-password=registry-password \
  --docker-email=registry-user@org.com
```

2. Reference it in the Pod:

```yaml
spec:
  containers:
  - name: app
    image: private-registry.io/apps/internal-app
  imagePullSecrets:
  - name: regcred
```

The secret must be in the **same namespace** as the Pod.

### Pull policy

`imagePullPolicy`: `Always`, `IfNotPresent`, `Never`. Default: `Always` for `:latest` or no tag, `IfNotPresent` otherwise.

### Troubleshooting

```bash
kubectl describe pod x      # ErrImagePull / ImagePullBackOff: "pull access denied" or "not found"
kubectl get secret regcred -o yaml
```

Typical causes: typo in name/tag, missing secret, wrong namespace, expired credentials.

### Key takeaways

- docker-registry secret + `imagePullSecrets`.

@@ 07-Security/24-Practice-Test-Image-Security
### How to approach this lab

Find image details of existing Pods and make a Pod pull from a private registry.

### Commands

```bash
kubectl describe pod web | grep Image
kubectl get deploy web -o yaml | grep image
kubectl create secret docker-registry private-reg-cred \
  --docker-username=dock_user --docker-password=dock_password \
  --docker-server=myprivateregistry.com:5000 --docker-email=dock_user@myprivateregistry.com
kubectl edit deploy web           # add imagePullSecrets
kubectl get pods -w
```

Under `spec.template.spec`:

```yaml
imagePullSecrets:
- name: private-reg-cred
```

### Notes

- Image `myprivateregistry.com:5000/nginx:alpine`: registry = `myprivateregistry.com:5000`.
- Check events for `ErrImagePull` after the change.

@@ 07-Security/25-Security-Context
### Introduction

A security context sets privilege and access control for a Pod or container: which user runs the process, Linux capabilities, filesystem restrictions.

### Pod level vs container level

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
spec:
  securityContext:              # applies to all containers
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
  - name: ubuntu
    image: ubuntu
    command: ["sleep","3600"]
    securityContext:            # overrides pod level for this container
      runAsUser: 1001
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        add: ["NET_ADMIN","SYS_TIME"]
        drop: ["ALL"]
```

**Capabilities** are only supported at the container level.

### Common fields

| Field | Meaning |
|---|---|
| `runAsUser`, `runAsGroup` | UID/GID of the process |
| `runAsNonRoot: true` | Refuse to start as root |
| `fsGroup` | Group owning mounted volumes |
| `privileged: true` | Nearly all host access (avoid) |
| `allowPrivilegeEscalation` | Block setuid gaining more privileges |
| `readOnlyRootFilesystem` | Immutable root filesystem |
| `capabilities` | Add/drop Linux capabilities |
| `seccompProfile`, `seLinuxOptions` | Kernel-level restrictions |

### Verify

```bash
kubectl exec web-pod -- whoami
kubectl exec web-pod -- id
kubectl exec web-pod -- ps aux
```

### Pod Security Standards

Namespace labels enforce `privileged`, `baseline`, or `restricted` profiles:

```bash
kubectl label ns dev pod-security.kubernetes.io/enforce=restricted
```

### Key takeaways

- Run as non-root, drop capabilities, read-only filesystem.

@@ 07-Security/26-Practice-Test-Security-Context
### How to approach this lab

Read the user a Pod runs as and change it, or add capabilities.

### Commands

```bash
kubectl exec ubuntu-sleeper -- whoami
kubectl get pod ubuntu-sleeper -o yaml > p.yaml
vi p.yaml           # add securityContext
kubectl replace --force -f p.yaml
kubectl exec ubuntu-sleeper -- id
```

Examples:

```yaml
spec:
  securityContext:
    runAsUser: 1010
  containers:
  - name: ubuntu
    image: ubuntu
    command: ["sleep","4800"]
```

```yaml
    securityContext:
      capabilities:
        add: ["SYS_TIME"]
```

### Notes

- A container-level setting wins over a pod-level one.
- Capabilities go under the container.

@@ 07-Security/27-Network-Policies
### Introduction

By default every Pod can talk to every other Pod. A NetworkPolicy restricts traffic to and from selected Pods, like a firewall. It needs a CNI that enforces it (Calico, Cilium, Weave; Flannel does **not**).

### Traffic model

```
 Ingress: traffic INTO selected Pods
 Egress:  traffic OUT of selected Pods
```

Rules are **allow lists**. As soon as a Pod is selected by a policy for a direction, all traffic in that direction is denied except what is allowed.

### Example: only the API Pod may reach the DB on 3306

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
      namespaceSelector:
        matchLabels:
          name: prod
    - ipBlock:
        cidr: 192.168.5.10/32
    ports:
    - protocol: TCP
      port: 3306
```

### AND vs OR in `from`

```yaml
# OR: two list items
from:
- podSelector: {...}
- namespaceSelector: {...}

# AND: one item with both
from:
- podSelector: {...}
  namespaceSelector: {...}
```

This indentation detail is a frequent exam trap.

### Selectors available

- `podSelector` (Pods in the policy's namespace).
- `namespaceSelector` (all Pods in matching namespaces).
- `ipBlock` (CIDR, with `except`).

### Egress example

```yaml
policyTypes: [Egress]
egress:
- to:
  - ipBlock: {cidr: 192.168.5.10/32}
  ports:
  - protocol: TCP
    port: 80
```

Remember to allow DNS (UDP/TCP 53) if you restrict egress.

### Default policies

```yaml
# deny all ingress
spec:
  podSelector: {}
  policyTypes: [Ingress]
# allow all ingress
spec:
  podSelector: {}
  ingress:
  - {}
  policyTypes: [Ingress]
```

### Commands

```bash
kubectl get netpol
kubectl describe netpol db-policy
kubectl get pods --show-labels
```

### Testing

```bash
kubectl exec -it web -- nc -zv db 3306
kubectl exec -it web -- curl -m 3 http://db:3306
```

### Troubleshooting

- Policy seems ignored: CNI doesn't support NetworkPolicy.
- Everything blocked: you selected the Pod with `policyTypes` but no allow rule; add rules.
- Check labels on Pods and namespaces (namespace labels needed for `namespaceSelector`; `kubernetes.io/metadata.name` is automatic).

### CKA exam tips

- Practise writing these from the docs (search "NetworkPolicy").
- Remember AND/OR and DNS for egress.

### Key takeaways

- Selected Pods become default-deny for the listed directions; add allow rules.

@@ 07-Security/28-Practice-Test-Network-Policies
### How to approach this lab

Inspect existing policies and write a new one.

### Commands

```bash
kubectl get netpol
kubectl describe netpol payroll-policy
kubectl get pods --show-labels
kubectl get ns --show-labels
vi policy.yaml
kubectl apply -f policy.yaml
kubectl exec -it internal -- curl -m 3 payroll:8080
```

### Approach

1. Identify the target Pod label (`podSelector`).
2. Identify who may connect (labels / namespace / IP).
3. Decide Ingress and/or Egress and the port.
4. Apply and test from allowed and denied Pods.

### Notes

- Which Pod a policy applies to: look at `PodSelector` in `describe`.
- Traffic from outside the namespace needs a `namespaceSelector`.
- Test blocked traffic with `curl -m 3`; timeouts show denial.

@@ 07-Security/29-kubectx-and-kubens-commands
### Introduction

`kubectx` and `kubens` are small helper tools to switch clusters (contexts) and namespaces quickly. They are not part of the exam environment, but the same operations are possible with `kubectl config`.

### kubectx

```bash
kubectx                  # list contexts
kubectx prod             # switch
kubectx -                # previous context
```

Equivalent: `kubectl config get-contexts` and `kubectl config use-context prod`.

### kubens

```bash
kubens                   # list namespaces
kubens kube-system       # switch default namespace
kubens -                 # previous
```

Equivalent: `kubectl config set-context --current --namespace=kube-system`.

### Install

```bash
sudo git clone https://github.com/ahmetb/kubectx /opt/kubectx
sudo ln -s /opt/kubectx/kubectx /usr/local/bin/kubectx
sudo ln -s /opt/kubectx/kubens /usr/local/bin/kubens
```

### Key takeaways

- Convenience tools; know the plain `kubectl config` commands for the exam.
