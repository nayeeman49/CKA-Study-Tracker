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
