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
