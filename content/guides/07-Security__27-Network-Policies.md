### Introduction

By default every Pod can talk to every other Pod. A NetworkPolicy restricts traffic to and from selected Pods, like a firewall. It needs a CNI that enforces it (Calico, Cilium, Weave; Flannel does **not**).

### Traffic model

```
 Ingress: traffic INTO selected Pods
 Egress:  traffic OUT of selected Pods
```

Rules are **allow lists**. As soon as a Pod is selected by a policy for a direction, all traffic in that direction is denied except what is allowed.

### Example: only the API Pod may reach the DB on 3306

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
      namespaceSelector:
        matchLabels:
          name: prod
    - ipBlock:
        cidr: 192.168.5.10/32
    ports:
    - protocol: TCP
      port: 3306
```

### AND vs OR in `from`

```yaml
# OR: two list items
from:
- podSelector: {...}
- namespaceSelector: {...}

# AND: one item with both
from:
- podSelector: {...}
  namespaceSelector: {...}
```

This indentation detail is a frequent exam trap.

### Selectors available

- `podSelector` (Pods in the policy's namespace).
- `namespaceSelector` (all Pods in matching namespaces).
- `ipBlock` (CIDR, with `except`).

### Egress example

```yaml
policyTypes: [Egress]
egress:
- to:
  - ipBlock: {cidr: 192.168.5.10/32}
  ports:
  - protocol: TCP
    port: 80
```

Remember to allow DNS (UDP/TCP 53) if you restrict egress.

### Default policies

```yaml
# deny all ingress
spec:
  podSelector: {}
  policyTypes: [Ingress]
# allow all ingress
spec:
  podSelector: {}
  ingress:
  - {}
  policyTypes: [Ingress]
```

### Commands

```bash
kubectl get netpol
kubectl describe netpol db-policy
kubectl get pods --show-labels
```

### Testing

```bash
kubectl exec -it web -- nc -zv db 3306
kubectl exec -it web -- curl -m 3 http://db:3306
```

### Troubleshooting

- Policy seems ignored: CNI doesn't support NetworkPolicy.
- Everything blocked: you selected the Pod with `policyTypes` but no allow rule; add rules.
- Check labels on Pods and namespaces (namespace labels needed for `namespaceSelector`; `kubernetes.io/metadata.name` is automatic).

### CKA exam tips

- Practise writing these from the docs (search "NetworkPolicy").
- Remember AND/OR and DNS for egress.

### Key takeaways

- Selected Pods become default-deny for the listed directions; add allow rules.
