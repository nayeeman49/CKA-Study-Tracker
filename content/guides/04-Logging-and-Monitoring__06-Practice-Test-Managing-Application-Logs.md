### How to approach this lab

You'll read logs from a running application, including a multi-container Pod.

### Commands

```bash
kubectl get pods
kubectl logs webapp-1
kubectl logs webapp-2 -c simple-webapp
kubectl logs webapp-2 -c db
kubectl describe pod webapp-2 | grep -A3 "Containers:"
kubectl logs -f webapp-1
kubectl logs webapp-1 | grep -i error
```

### Typical questions

| Question | Approach |
|---|---|
| What is the user that is failing to log in? | `kubectl logs webapp-1` and look for "USER... Failed" |
| Which container is logging an error? | Check each container with `-c` |
| What is the reason for the failure? | Read the last lines or `grep -i warning` |

### Tips

- List container names with `kubectl get pod x -o jsonpath='{.spec.containers[*].name}'`.
- Use `--tail` to see just the end.

### Worked example

```bash
kubectl get pods
kubectl logs webapp-1 | grep -i fail
kubectl get pod webapp-2 -o jsonpath='{.spec.containers[*].name}'
kubectl logs webapp-2 -c simple-webapp --tail=20
```

Example finding: "USER5 Failed to Login as the account is locked due to multiple attempts." Answer: the user is `USER5`; the reason is a locked account.

### Common mistakes

- Reading the wrong container's logs in a multi-container Pod.
- Looking at logs of a restarted container; use `--previous` to see the crashed one.
