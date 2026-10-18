### How to approach this lab

Tasks: count DaemonSets, find which Pods they create, and create a new one.

### Commands

```bash
kubectl get ds -A
kubectl describe ds kube-flannel-ds -n kube-flannel
kubectl get pods -A -o wide | grep flannel
kubectl create deployment elasticsearch --image=registry.k8s.io/fluentd-elasticsearch:1.20 -n kube-system --dry-run=client -o yaml > fluentd.yaml
# edit: kind: DaemonSet, remove replicas: 1 and strategy: {}
kubectl apply -f fluentd.yaml
kubectl get ds -n kube-system
```

### Check list

- `DESIRED/CURRENT/READY` match the node count.
- Edit `selector.matchLabels` and `template.metadata.labels` consistently.
- Remember `-n kube-system` if asked.

### Worked example

```bash
kubectl create deployment elasticsearch --image=registry.k8s.io/fluentd-elasticsearch:1.20 \
  -n kube-system --dry-run=client -o yaml > ds.yaml
```

Edit the file: change `kind: Deployment` to `DaemonSet`, delete `replicas: 1` and `strategy: {}`, and keep the `selector` and template labels equal.

```bash
kubectl apply -f ds.yaml
kubectl get ds -n kube-system
kubectl get pods -n kube-system -o wide | grep elasticsearch   # one per node
```

### Common mistakes

- Leaving `replicas` in the YAML (DaemonSets reject it).
- Forgetting `-n kube-system` when the task asks for it.
- Expecting a Pod on the control plane node without a toleration.
