### Introduction

Kubernetes can scale automatically: Pods (HPA, VPA) and nodes (Cluster Autoscaler). HPA is in the CKA syllabus.

### Horizontal Pod Autoscaler (HPA)

Changes the replica count of a Deployment/StatefulSet based on metrics (CPU, memory, custom). Requires the **Metrics Server** and CPU/memory **requests** on the Pods.

```bash
kubectl autoscale deployment web --cpu-percent=50 --min=2 --max=10
kubectl get hpa
kubectl describe hpa web
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

Formula: `desired = ceil(current * currentMetric / targetMetric)`.

### Test it

```bash
kubectl run load --image=busybox --restart=Never -- /bin/sh -c "while true; do wget -q -O- http://web; done"
kubectl get hpa -w
```

### Vertical Pod Autoscaler (VPA)

Adjusts Pod requests/limits (recommendation, auto modes). It is an add-on, not core.

### Cluster Autoscaler

Adds/removes nodes when Pods are unschedulable or nodes are underused. Provided by cloud integrations.

### Troubleshooting HPA

- `TARGETS <unknown>`: Metrics Server missing, or no resource requests set.
- Not scaling down: stabilization window (5 min default).

### Key takeaways

- HPA needs metrics-server and requests; `kubectl autoscale` creates it.
