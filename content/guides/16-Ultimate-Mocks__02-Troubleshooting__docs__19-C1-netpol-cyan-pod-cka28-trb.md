### How to approach this lab

Scenario: a Pod ("cyan") can't be reached because of a NetworkPolicy.

### Diagnose

```bash
kubectl get netpol -A
kubectl describe netpol <name>          # PodSelector, Allowing ingress from..., ports
kubectl get pods --show-labels
kubectl get ns --show-labels
```

### Fix

Edit the policy so the client is allowed by `podSelector` and/or `namespaceSelector` and the correct `ports`. Watch AND vs OR (one `from` item vs two). Policies are additive; if the task forbids deleting the policy, edit it.

### Test

```bash
kubectl exec <client> -- wget -qO- -T2 <svc>:<port>
```

Timeout = blocked; the page = allowed.

### Checklist

1. Which Pods does the policy select (`podSelector`)?
2. Which directions are restricted (`policyTypes`)?
3. Does the client match a `from` entry (labels, namespace labels)?
4. Is the port correct?
5. Is egress from the client blocked by another policy?
