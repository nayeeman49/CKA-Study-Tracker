### How to approach this lab

Questions in this lab ask you to read ReplicaSet state, fix a broken one, and scale it.

### Commands

```bash
kubectl get rs                          # DESIRED / CURRENT / READY
kubectl describe rs <name>              # image, selector, events
kubectl get rs <name> -o yaml
kubectl get pods
kubectl delete pod <pod>                # test self-healing
kubectl scale rs <name> --replicas=5
kubectl edit rs <name>
kubectl delete rs <name>
```

### What the columns mean

| Column | Meaning |
|---|---|
| DESIRED | `spec.replicas` |
| CURRENT | Pods the RS has created |
| READY | Pods that passed readiness |

### Typical tasks

1. **How many ReplicaSets/Pods exist?** `kubectl get rs`, `kubectl get pods`.
2. **What image does the RS use?** `kubectl describe rs new-replica-set | grep Image`.
3. **Why aren't Pods ready?** Check Pod events: usually a bad image tag. Fix with `kubectl edit rs`, then **delete the existing Pods** so they are recreated.
4. **Delete one of the Pods.** Watch the RS bring it back. Number stays the same.
5. **Create a ReplicaSet from a file with errors.** Common mistakes: `apiVersion: v1` (should be `apps/v1`), selector labels not matching template labels, mis-indented `template`.
6. **Scale up and down.** `kubectl scale rs name --replicas=N`.

### Fixing a YAML error

```bash
kubectl apply -f replicaset-definition-1.yaml
# error: unable to recognize ... no matches for kind "ReplicaSet" in version "v1"
vi replicaset-definition-1.yaml        # apiVersion: apps/v1
kubectl apply -f replicaset-definition-1.yaml
```

### Tips

- Check `kubectl get pods --show-labels` to compare labels with the selector.
- Remember editing the RS template does not fix running Pods.
