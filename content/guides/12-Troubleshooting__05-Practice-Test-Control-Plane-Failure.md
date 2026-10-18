### How to approach this lab

Three or four control plane faults appear one after the other (scheduler, controller manager, kube-system config). Solve them in order.

### Method for each

```bash
kubectl get pods -n kube-system
kubectl describe pod kube-scheduler-controlplane -n kube-system
kubectl logs kube-scheduler-controlplane -n kube-system
crictl ps -a | grep scheduler
vi /etc/kubernetes/manifests/kube-scheduler.yaml
```

### Frequent faults

- Scheduler: bad `command` (`kube-schedulerr`) or wrong kubeconfig path.
- Controller manager: wrong CA path (`/etc/kubernetes/pki/ca.crt` vs `/etc/kubernetes/WRONG-PKI-DIRECTORY/ca.crt`) or hostPath volume mismatch.
- Scaling a Deployment has no effect: controller manager is broken.

### Test

```bash
kubectl scale deployment app --replicas=3
kubectl get pods -w
```

### Worked example

Pods stay Pending, scaling does nothing:

```bash
kubectl get pods -n kube-system
# kube-scheduler-controlplane   CrashLoopBackOff
kubectl -n kube-system logs kube-scheduler-controlplane
# ... unable to read config / invalid path
vi /etc/kubernetes/manifests/kube-scheduler.yaml        # fix --kubeconfig=/etc/kubernetes/scheduler.conf
kubectl -n kube-system get pods -w
```

Then:

```bash
kubectl scale deploy app --replicas=3         # no new Pods
kubectl -n kube-system logs kube-controller-manager-controlplane
vi /etc/kubernetes/manifests/kube-controller-manager.yaml   # hostPath /etc/kubernetes/pki
```

### Common mistakes

- Fixing the flag but not the volume mount, or the reverse.
- Not waiting for the kubelet to recreate the Pod.
