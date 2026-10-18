### Introduction

A throwaway server Pod and Service to test NetworkPolicies.

### Create

```bash
kubectl run server --image=nginx --labels=app=server --port=80 --expose
kubectl get pods,svc -l app=server
```

### Use

1. Test the baseline from a client **before** applying any policy.
2. Apply the NetworkPolicy being tested.
3. Test again from clients with different labels and namespaces.

A timeout means blocked; the nginx page means allowed.

```bash
kubectl describe netpol <name>       # shows selected Pods
```

### Clean up

```bash
kubectl delete pod,svc server
```

### Example test matrix

| Client | Namespace | Expect (policy allows `role=frontend` only) |
|---|---|---|
| `client` (role=frontend) | same | works |
| `client2` (role=other) | same | timeout |
| client from other namespace | other | timeout unless namespaceSelector |
