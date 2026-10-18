### How to approach this lab

Tasks: inspect the default scheduler, deploy another, and use it for a Pod.

### Commands

```bash
kubectl -n kube-system get pods | grep scheduler
kubectl -n kube-system describe pod kube-scheduler-controlplane | grep Image
kubectl get events -o wide
kubectl logs my-scheduler -n kube-system
kubectl apply -f my-scheduler.yaml
kubectl get pods -n kube-system
```

Use the scheduler:

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > nginx.yaml
vi nginx.yaml          # add spec.schedulerName: my-scheduler
kubectl apply -f nginx.yaml
kubectl describe pod nginx      # Events: Scheduled by my-scheduler
```

### Tips

- Pod `Pending` forever: wrong `schedulerName` or scheduler Pod not Running.
- Give the new scheduler a unique `schedulerName` in its configuration.

### Worked example

```bash
cp /etc/kubernetes/manifests/kube-scheduler.yaml /root/my-scheduler.yaml
```

Edit the copy: `name: my-scheduler`, add `--scheduler-name=my-scheduler` (or a config file with the profile name), `--leader-elect=false` (or set a different `--lock-object-name=my-scheduler`), and change the ports (`--secure-port=10260`) so they don't clash with the default one. Move it out of the manifests folder and create it as a normal Pod in `kube-system`, then:

```bash
kubectl apply -f my-scheduler.yaml
kubectl -n kube-system get pods | grep my-scheduler
```

A Pod that uses it:

```yaml
spec:
  schedulerName: my-scheduler
```

Confirm: `kubectl get events -o wide | grep my-scheduler` or `kubectl describe pod` (Scheduled by my-scheduler).

### Common mistakes

- Leaving the copy in `/etc/kubernetes/manifests` (it becomes a second static Pod fighting for ports).
- Reusing the default scheduler's name.
