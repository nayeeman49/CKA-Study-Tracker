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
