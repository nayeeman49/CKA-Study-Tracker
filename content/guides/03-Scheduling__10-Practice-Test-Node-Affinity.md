### How to approach this lab

Tasks combine labels and affinity in Deployments.

### Commands

```bash
kubectl get nodes --show-labels
kubectl label node node01 color=blue
kubectl create deployment blue --image=nginx --replicas=3 --dry-run=client -o yaml > blue.yaml
vi blue.yaml    # add affinity under spec.template.spec
kubectl apply -f blue.yaml
kubectl get pods -o wide
```

Affinity inside a Deployment goes in the **Pod template**:

```yaml
spec:
  template:
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: color
                operator: In
                values: [blue]
```

For "run on the control plane" tasks use the label `node-role.kubernetes.io/control-plane` with `Exists`, and remember the control plane taint requires a toleration as well.

### Tips

- Check nodes carry the label before you apply.
- `kubectl get pods -o wide` confirms placement.

### Worked example

Task: Deployment `blue` (3 replicas) must run only on nodes labelled `color=blue`.

```bash
kubectl label node node01 color=blue
kubectl create deployment blue --image=nginx --replicas=3 --dry-run=client -o yaml > blue.yaml
```

Add under `spec.template.spec`:

```yaml
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: color
                operator: In
                values: [blue]
```

```bash
kubectl apply -f blue.yaml
kubectl get pods -o wide        # all on node01
```

For "controlplane" placement add `key: node-role.kubernetes.io/control-plane`, `operator: Exists`, plus a toleration for `node-role.kubernetes.io/control-plane:NoSchedule`.

### Common mistakes

- Putting `affinity` in the Deployment spec instead of the Pod template.
- Forgetting to label the node first, so Pods stay Pending.
- Mixing up `values` list syntax and quoting.
