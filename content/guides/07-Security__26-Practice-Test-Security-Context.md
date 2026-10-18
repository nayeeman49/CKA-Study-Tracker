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

### Worked example

Run `ubuntu-sleeper` as user 1010 and add `SYS_TIME`:

```yaml
spec:
  securityContext:
    runAsUser: 1010
  containers:
  - name: ubuntu
    image: ubuntu
    command: ["sleep","4800"]
    securityContext:
      capabilities:
        add: ["SYS_TIME"]
```

```bash
kubectl replace --force -f p.yaml
kubectl exec ubuntu-sleeper -- id
kubectl exec ubuntu-sleeper -- date -s "12:00"       # works only with SYS_TIME
```

### Common mistakes

- Putting `capabilities` at the Pod level (invalid).
- Quoting UID as a string.
