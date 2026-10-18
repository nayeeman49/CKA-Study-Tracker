### How to approach this lab

The scenario: a Pod is stuck in Pending because the scheduler is down or missing, and you must get it running on a particular node.

### Steps

```bash
kubectl get pods                       # Pod is Pending
kubectl -n kube-system get pods        # scheduler missing or crashing?
kubectl describe pod nginx             # no events = no scheduler
kubectl get nodes                      # pick a node name
```

Set the node:

```bash
kubectl get pod nginx -o yaml > nginx.yaml
# add under spec:  nodeName: node01
kubectl replace --force -f nginx.yaml
kubectl get pods -o wide
```

Or from scratch:

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > nginx.yaml
vi nginx.yaml          # add nodeName: controlplane
kubectl apply -f nginx.yaml
```

### Tips

- The scheduler lives in `kube-system`; its manifest is `/etc/kubernetes/manifests/kube-scheduler.yaml`.
- If a Pod has `nodeName` it will start without the scheduler.

### Worked example

Scenario: Pod `nginx` is `Pending` and `kubectl describe pod nginx` shows **no Events**. Cause: no scheduler is running.

```bash
kubectl -n kube-system get pods | grep scheduler     # missing or crashing
kubectl get nodes                                    # controlplane, node01
kubectl get pod nginx -o yaml > nginx.yaml
sed -i '/^spec:/a\  nodeName: node01' nginx.yaml    # or edit with vi
kubectl replace --force -f nginx.yaml
kubectl get pod nginx -o wide                        # NODE = node01
```

### Common mistakes

- Putting `nodeName` under `containers` instead of `spec`.
- Using `kubectl edit` on a running Pod: `nodeName` cannot be changed, the edit is rejected.
- Typo in the node name, which leaves the Pod stuck.

### Exam angle

A question may say "the scheduler is not working, run Pod X on node Y": set `nodeName`, do not waste time fixing the scheduler unless asked.
