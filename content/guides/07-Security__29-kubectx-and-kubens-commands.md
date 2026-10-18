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
