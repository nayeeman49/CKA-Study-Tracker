### How to approach this lab

Pods are stuck because no CNI is installed. Deploy one (Weave) with the correct Pod CIDR.

### Steps

```bash
kubectl get pods                         # ContainerCreating
kubectl describe pod app                 # no CNI / network plugin not ready
kubectl apply -f <weave-net-manifest>
kubectl -n kube-system get pods | grep weave
kubectl get pods -w
```

### Pod CIDR conflict

If the Weave default range overlaps with the node network, set `IPALLOC_RANGE` in the DaemonSet:

```yaml
containers:
- name: weave
  env:
  - name: IPALLOC_RANGE
    value: 10.32.0.0/16
```

```bash
kubectl edit ds weave-net -n kube-system
```

### Verify

Pods become `Running` and get IPs from the range; test connectivity between Pods.

### Worked example

Symptoms: new Pods stay in `ContainerCreating`; `kubectl describe pod` shows `network plugin is not ready: cni config uninitialized`.

```bash
ls /etc/cni/net.d            # empty
kubectl apply -f weave-daemonset.yaml
kubectl -n kube-system get pods -l name=weave-net
kubectl get pods             # now Running
```

Check the Pod CIDR (`kubectl cluster-info dump | grep -m1 cluster-cidr`) and set `IPALLOC_RANGE` in the weave container env if the default range overlaps with your nodes.

### Common mistakes

- Applying a manifest meant for a different Kubernetes version.
- Leaving a previous CNI config in `/etc/cni/net.d` (the first file alphabetically wins).
