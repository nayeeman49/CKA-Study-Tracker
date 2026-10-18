### Introduction

Applications change: new versions, bug fixes, configuration changes. A Deployment rolls out changes gradually so the application stays available, and can roll back if something goes wrong.

### Rollout and revisions

Whenever a Deployment's Pod template changes (image, env, resources), a **rollout** happens and creates a new **revision**. Scaling does not create a revision.

```bash
kubectl rollout status deployment/web
kubectl rollout history deployment/web
kubectl rollout history deployment/web --revision=2
```

### Deployment strategies

| Strategy | How | Downtime |
|---|---|---|
| **RollingUpdate** (default) | Replace Pods gradually: new ones up, old ones down | None |
| **Recreate** | Delete all old Pods, then create new | Yes |

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%          # extra Pods allowed above replicas
      maxUnavailable: 25%    # Pods that may be unavailable
```

```
 replicas=4, maxSurge=1, maxUnavailable=1

 old ■■■■        new
 old ■■■  new ■    (1 surge, 1 down)
 old ■■   new ■■
 old ■    new ■■■
      new ■■■■
```

Behind the scenes the Deployment creates a **new ReplicaSet** and scales it up while scaling the old one down.

```bash
kubectl get rs      # old RS at 0 replicas is kept for rollback
```

### How to update

```bash
kubectl set image deployment/web nginx=nginx:1.27            # imperative
kubectl edit deployment web                                  # live edit
kubectl apply -f deploy.yaml                                 # declarative
kubectl set resources deployment web --limits=cpu=500m
kubectl rollout restart deployment/web                       # new rollout, same config
```

Record the reason (annotation for `CHANGE-CAUSE`):

```bash
kubectl annotate deployment/web kubernetes.io/change-cause="update to 1.27"
```

(The `--record` flag is deprecated.)

### Rollback

```bash
kubectl rollout undo deployment/web                     # previous revision
kubectl rollout undo deployment/web --to-revision=2
```

### Pause and resume

```bash
kubectl rollout pause deployment/web
kubectl set image deployment/web nginx=nginx:1.28
kubectl set resources deployment/web --limits=memory=256Mi
kubectl rollout resume deployment/web      # one rollout for all changes
```

### Controlling history

`revisionHistoryLimit` (default 10) controls how many old ReplicaSets are kept.

### Watching a rollout

```bash
kubectl rollout status deployment/web
kubectl get pods -w
```

If a rollout stalls (new Pods stay unready) the old Pods keep serving, which is the safety net. `progressDeadlineSeconds` (default 600) marks it failed.

### Troubleshooting

- New Pods `ImagePullBackOff`: wrong tag; `rollout undo`.
- Rollout stuck: readiness probe failing, check `describe pod`.
- `maxUnavailable: 0` and `maxSurge: 0` is invalid.

### CKA exam tips

- Commands: `set image`, `rollout status/history/undo`.
- Container name in `set image` must match the container name in the template.

### Key takeaways

- Rolling update by default; new ReplicaSet each revision.
- `rollout undo` goes back.
