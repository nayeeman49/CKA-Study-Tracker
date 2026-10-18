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
