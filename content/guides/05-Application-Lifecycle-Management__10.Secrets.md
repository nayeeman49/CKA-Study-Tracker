### Introduction

A Secret holds sensitive data such as passwords, tokens and keys. It is similar to a ConfigMap, but values are base64-encoded and Kubernetes treats it more carefully (access controls, not printed in `describe`).

**Base64 is encoding, not encryption.** Anyone who can read the Secret can decode it.

### Create

```bash
kubectl create secret generic db-secret \
  --from-literal=DB_Host=mysql --from-literal=DB_User=root --from-literal=DB_Password=passwd
kubectl create secret generic db-secret --from-file=creds.txt
```

Declaratively (values must be base64):

```bash
echo -n 'passwd' | base64        # cGFzc3dk
echo -n 'cGFzc3dk' | base64 -d
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  DB_Password: cGFzc3dk
# or use stringData to avoid encoding:
stringData:
  DB_User: root
```

Use `-n` with `echo` or a newline is encoded.

### Types

| Type | Use |
|---|---|
| `Opaque` | Generic |
| `kubernetes.io/tls` | TLS certs (`tls.crt`, `tls.key`) |
| `kubernetes.io/dockerconfigjson` | Image registry credentials |
| `kubernetes.io/basic-auth`, `ssh-auth` | Credentials |
| `kubernetes.io/service-account-token` | Service account tokens |

### Inject into a Pod

```yaml
envFrom:
- secretRef:
    name: db-secret
```

```yaml
env:
- name: DB_Password
  valueFrom:
    secretKeyRef:
      name: db-secret
      key: DB_Password
```

```yaml
volumes:
- name: secret-vol
  secret:
    secretName: db-secret
containers:
- name: app
  volumeMounts:
  - name: secret-vol
    mountPath: /etc/secret
    readOnly: true
```

Each key becomes a file under the mount path. Volume-mounted secrets update automatically; env vars don't.

### View

```bash
kubectl get secret db-secret -o yaml
kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d
```

### Security practices

- Secrets are stored **unencrypted in ETCD** by default. Enable **encryption at rest** (`EncryptionConfiguration`, `--encryption-provider-config` on the API Server).
- Use RBAC to limit who can `get`/`list` secrets.
- Prefer volume mounts to env vars (env vars leak into logs, child processes).
- Consider external secret stores (Vault, cloud KMS).
- Don't commit secrets to Git.

### Encryption at rest outline

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: [secrets]
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64 32 byte key>
  - identity: {}
```

```bash
# API server flag
--encryption-provider-config=/etc/kubernetes/enc/enc.yaml
# re-encrypt existing
kubectl get secrets -A -o json | kubectl replace -f -
```

Verify with `etcdctl get /registry/secrets/default/db-secret` — an encrypted value starts with `k8s:enc:aescbc:v1:`.

### CKA exam tips

- `kubectl create secret generic` is fastest.
- Remember `echo -n` and `base64 -d`.

### Key takeaways

- Secrets are base64, not encrypted, unless you enable encryption at rest.
