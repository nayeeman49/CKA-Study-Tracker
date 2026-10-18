### How to approach this lab

Tasks: inspect strategy, update the image, observe rollout, roll back, change the strategy.

### Commands

```bash
kubectl describe deployment frontend | grep -i -E "strategy|rollingupdate|image"
kubectl set image deployment/frontend simple-webapp=kodekloud/webapp-color:v2
kubectl rollout status deployment/frontend
kubectl rollout history deployment/frontend
kubectl rollout undo deployment/frontend
kubectl edit deployment frontend       # change strategy to Recreate
kubectl get pods -w
```

### Notes

- Find the container name with `describe` or `-o jsonpath='{.spec.template.spec.containers[*].name}'`.
- When switching to `Recreate` you must delete the `rollingUpdate:` block, otherwise validation fails.
- Bad image tags create new Pods in `ImagePullBackOff` while old ones keep running; use `rollout undo`.

### Worked example

```bash
kubectl get deploy frontend -o jsonpath='{.spec.strategy}{"\n"}'
kubectl set image deploy/frontend simple-webapp=kodekloud/webapp-color:v2
kubectl rollout status deploy/frontend
kubectl rollout history deploy/frontend
kubectl set image deploy/frontend simple-webapp=kodekloud/webapp-color:v3    # bad tag
kubectl rollout status deploy/frontend --timeout=30s                          # stuck
kubectl rollout undo deploy/frontend
```

Switching to Recreate:

```bash
kubectl edit deploy frontend
# strategy:
#   type: Recreate        (delete the whole rollingUpdate: block)
```

### Common mistakes

- Using the Deployment name instead of the **container** name in `set image`.
- Leaving `rollingUpdate:` under `type: Recreate` (validation error).
