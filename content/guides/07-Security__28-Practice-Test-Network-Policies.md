### How to approach this lab

Inspect existing policies and write a new one.

### Commands

```bash
kubectl get netpol
kubectl describe netpol payroll-policy
kubectl get pods --show-labels
kubectl get ns --show-labels
vi policy.yaml
kubectl apply -f policy.yaml
kubectl exec -it internal -- curl -m 3 payroll:8080
```

### Approach

1. Identify the target Pod label (`podSelector`).
2. Identify who may connect (labels / namespace / IP).
3. Decide Ingress and/or Egress and the port.
4. Apply and test from allowed and denied Pods.

### Notes

- Which Pod a policy applies to: look at `PodSelector` in `describe`.
- Traffic from outside the namespace needs a `namespaceSelector`.
- Test blocked traffic with `curl -m 3`; timeouts show denial.

### Worked example

Allow only `internal` Pods to reach `payroll` on port 8080, and nothing else:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: internal-policy
spec:
  podSelector:
    matchLabels:
      name: payroll
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: internal
    ports:
    - protocol: TCP
      port: 8080
```

```bash
kubectl exec internal -- curl -m 3 payroll:8080     # works
kubectl exec external -- curl -m 3 payroll:8080     # times out
```

### Common mistakes

- Writing `podSelector` under `from` at the wrong indentation (AND vs OR).
- Selecting the wrong Pods in the policy's top-level `podSelector`.
