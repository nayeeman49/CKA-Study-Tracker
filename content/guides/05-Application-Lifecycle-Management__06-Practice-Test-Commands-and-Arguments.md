### How to approach this lab

You'll read an image's behaviour, and create/modify Pods with `command` and `args`.

### Commands

```bash
kubectl describe pod ubuntu-sleeper-2 | grep -A5 Command
kubectl run webapp-green --image=kodekloud/webapp-color -- --color=green
kubectl run ubuntu --image=ubuntu --dry-run=client -o yaml -- sleep 5000 > p.yaml
kubectl get pod x -o yaml > x.yaml ; vi x.yaml
kubectl replace --force -f x.yaml
```

### Common tasks

| Task | Answer |
|---|---|
| Pod runs `sleep 5000` | `command: ["sleep","5000"]` or `args` |
| App needs `--color green` | `args: ["--color","green"]` |
| Change the delay in an existing Pod | Edit the file and replace (fields are immutable) |

### Tips

- Look at the image's Dockerfile to see ENTRYPOINT/CMD.
- Check the result: `kubectl logs` or `kubectl describe`.

### Worked example

Dockerfile: `ENTRYPOINT ["python","app.py"]`, `CMD ["--color","red"]`. Pod needs green:

```yaml
spec:
  containers:
  - name: webapp-green
    image: kodekloud/webapp-color
    args: ["--color","green"]
```

Imperative: `kubectl run webapp-green --image=kodekloud/webapp-color -- --color green`.

Ubuntu sleeper with a custom delay:

```yaml
    command: ["sleep"]
    args: ["5000"]
```

### Common mistakes

- Unquoted numbers in `args`.
- Putting flags and values in one string (`"--color green"`) instead of separate list items.
- Trying to edit `command` on a live Pod.
