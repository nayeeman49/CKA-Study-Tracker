# Workload Autoscaling

Part of the Workloads & Scheduling domain ("Configure workload autoscaling").

## Horizontal Pod Autoscaler (HPA)
Changes the **replica count** of a Deployment/StatefulSet based on metrics. It needs **metrics-server** (CPU/memory) and containers with CPU/memory **requests** (utilisation is relative to requests).
```
kubectl autoscale deployment web --cpu-percent=60 --min=2 --max=10
kubectl get hpa -w
kubectl describe hpa web
```
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: web}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: web}
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource: {name: cpu, target: {type: Utilization, averageUtilization: 60}}
  behavior:
    scaleDown: {stabilizationWindowSeconds: 300}
```
Algorithm: `desired = ceil(current × currentMetric / targetMetric)`. `behavior` tunes speed and stabilisation to avoid flapping. If `TARGETS` shows `<unknown>`, metrics-server is missing or requests are not set.

## Vertical Pod Autoscaler (VPA)
An add-on (not built in) that adjusts Pod **requests/limits** (modes `Off`, `Initial`, `Auto`). Don't combine VPA and HPA on the same CPU/memory metric.

## Cluster Autoscaler
Adds or removes **nodes** when Pods can't be scheduled or nodes are idle; provider-specific, not testable on kubeadm labs.

## Related
In-place Pod resize lets resources change without a restart on recent versions; `kubectl scale` remains the manual route.

## Exam tips
- Create with `kubectl autoscale`; check with `kubectl get hpa`. Add `resources.requests.cpu` to the Deployment first if missing.
- Generate load for testing with a busybox loop (`while true; do wget -q -O- http://web; done`).

## Official documentation
- [Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
- [HPA Walkthrough](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)
- [Resource metrics pipeline](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
