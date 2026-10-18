### Introduction

In a Pod spec you can override the image's ENTRYPOINT and CMD with `command` and `args`.

### Mapping

| Docker | Kubernetes |
|---|---|
| `ENTRYPOINT` | `command` |
| `CMD` | `args` |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ubuntu-sleeper
spec:
  containers:
  - name: ubuntu-sleeper
    image: ubuntu-sleeper        # ENTRYPOINT ["sleep"], CMD ["5"]
    command: ["sleep2.0"]        # replaces ENTRYPOINT
    args: ["10"]                 # replaces CMD
```

### Rules

| `command` | `args` | Result |
|---|---|---|
| not set | not set | image ENTRYPOINT + CMD |
| set | not set | `command` only; image CMD ignored |
| not set | set | image ENTRYPOINT + `args` |
| set | set | `command` + `args` |

### Syntax tips

- Every element is a separate string; numbers must be quoted: `args: ["--color","green","10"]` or `["10"]`.
- Multi-line args:

```yaml
command: ["sh","-c"]
args:
- |
  echo hello
  sleep 3600
```

### Imperative

```bash
kubectl run web --image=nginx -- --arg1 value        # args after --
kubectl run busybox --image=busybox --command -- sleep 3600
kubectl run x --image=busybox --dry-run=client -o yaml -- sleep 1000
```

`--command` makes the part after `--` the command rather than the args.

### Editing

`command` and `args` are immutable on a running Pod; recreate it.

### Troubleshooting

- `CrashLoopBackOff` with "executable file not found": wrong command path.
- Container exits immediately: the process finishes; give it a long-running command.

### Key takeaways

- command = ENTRYPOINT, args = CMD.
