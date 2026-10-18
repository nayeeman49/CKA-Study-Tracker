### How to approach this lab

This lab tests the basics from the Pods lesson. The questions are always answered by looking at the cluster, so build a habit of using a handful of commands.

### Useful commands

```bash
kubectl get pods                        # how many pods?
kubectl get pods -o wide                # which node, which IP
kubectl describe pod <name>             # image, containers, ready, events
kubectl get pod <name> -o yaml          # full spec
kubectl run <name> --image=<image>      # create a pod
kubectl run <name> --image=<image> --dry-run=client -o yaml > pod.yaml
kubectl delete pod <name>
kubectl edit pod <name>                 # fix image names etc.
```

### Typical questions and how to answer them

| Question | How |
|---|---|
| How many Pods exist in the default namespace? | `kubectl get pods --no-headers \| wc -l` |
| What image is used? | `kubectl describe pod x \| grep Image` |
| Which node is it on? | `kubectl get pods -o wide` |
| How many containers in the Pod? | `READY` column `x/y`, y is the total |
| Why is a Pod not ready? | `describe pod`, look at Events and container State |
| Why does one Pod show `ErrImagePull`? | The image name or tag is wrong; fix with `kubectl edit pod` (image is editable) |
| Create a Pod with a given name and image | `kubectl run redis --image=redis` |
| Create a Pod from a YAML file and fix it | `kubectl apply -f`, then read errors |

### Reading the READY column

`READY 1/2` means one of two containers is ready. `kubectl describe pod` shows each container's state: `Waiting` with a reason, `Running`, or `Terminated` with an exit code.

### Fixing a Pod with a bad image

```bash
kubectl edit pod webapp           # change image: nginx → correct image
kubectl get pod webapp -w
```

If the edit is rejected (field immutable), save the temp file path printed, then:

```bash
kubectl replace --force -f /tmp/kubectl-edit-XXXX.yaml
```

### Tips

- Delete a Pod in the lab with `kubectl delete pod name`; add `--force --grace-period=0` only if it hangs.
- Use `-A` or `-n kube-system` to inspect system Pods.
- Practise: write Pod YAML from `--dry-run` rather than from scratch. Speed matters in the exam.
