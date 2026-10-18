### Introduction

A DaemonSet runs exactly one copy of a Pod on every node (or a chosen subset). When a node is added a Pod appears on it; when a node is removed that Pod is garbage collected.

### Use cases

- Monitoring agents (node-exporter, Datadog)
- Log collectors (Fluentd, Filebeat)
- Networking plugins (kube-proxy, Calico, Weave)
- Storage daemons

```
 node01: [ds-pod]   node02: [ds-pod]   node03: [ds-pod]
```

### YAML

Same as ReplicaSet except `kind: DaemonSet` and there's no `replicas`:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: monitoring-agent
spec:
  selector:
    matchLabels:
      app: monitoring-agent
  template:
    metadata:
      labels:
        app: monitoring-agent
    spec:
      containers:
      - name: monitoring-agent
        image: monitoring-agent
```

### Create quickly

There is no `kubectl create daemonset`. Generate from a Deployment:

```bash
kubectl create deployment elasticsearch --image=k8s.gcr.io/fluentd-elasticsearch:1.20 \
  -n kube-system --dry-run=client -o yaml > ds.yaml
vi ds.yaml     # kind: DaemonSet, delete replicas and strategy: {}
kubectl apply -f ds.yaml
```

### How it schedules

Modern versions use the default scheduler with `nodeAffinity` on each node name. Earlier it set `nodeName`. Either way DaemonSet Pods automatically tolerate some taints (`not-ready`, `unreachable`, `disk-pressure`...). To run on tainted control plane nodes add a toleration.

```yaml
tolerations:
- operator: Exists
```

### Limit to some nodes

Use `nodeSelector` or `affinity` in the template.

### Commands

```bash
kubectl get ds -A
kubectl describe ds kube-proxy -n kube-system
kubectl rollout status ds/monitoring-agent
kubectl rollout undo ds/monitoring-agent
```

### Troubleshooting

- DESIRED < number of nodes: node taints not tolerated or selector excludes nodes.
- One node missing the Pod: check `kubectl get pods -o wide`, `describe`.

### CKA exam tips

- Remember the Deployment-to-DaemonSet YAML conversion trick.
- `kube-proxy` is a DaemonSet in `kube-system`.

### Key takeaways

- One Pod per node, automatic with node changes.
