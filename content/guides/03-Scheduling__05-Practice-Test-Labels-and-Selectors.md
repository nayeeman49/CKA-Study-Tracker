### How to approach this lab

Typical tasks are counting and selecting resources by label.

### Commands

```bash
kubectl get pods --show-labels
kubectl get pods -l env=dev
kubectl get pods -l env=dev --no-headers | wc -l
kubectl get all -l env=prod,bu=finance,tier=frontend
kubectl get pods -l env=prod --show-labels
kubectl label pod web tier=front
kubectl get nodes --show-labels
```

### Tricks

- Multiple labels with commas are AND.
- To get Pods across all namespaces: add `-A`.
- A ReplicaSet YAML issue: the selector matchLabels must equal the template label. Compare with `kubectl get rs -o yaml`.
- `kubectl get all --selector env=prod,bu=finance,tier=frontend` selects every object type with those labels, handy for counting Pods, RS, Deployments, Services together.

### Worked example

Count everything labelled `env=prod,bu=finance,tier=frontend`:

```bash
kubectl get all -l env=prod,bu=finance,tier=frontend --no-headers
kubectl get pods -l env=dev --no-headers | wc -l
kubectl get pods -A -l 'env in (prod,qa)' --show-labels
```

Fix a ReplicaSet whose selector doesn't match its template:

```bash
kubectl get rs replicaset-1 -o yaml | grep -A3 -E "selector|labels"
kubectl explain rs.spec.selector
```

Selector `tier: front-end` and template label `tier: nginx` is rejected with `selector does not match template labels`.

### Common mistakes

- Spaces after commas in `-l a=b, c=d` (no spaces allowed).
- Forgetting `-A` when the objects are in other namespaces.
- Assuming `get all` lists every kind (it omits ConfigMaps, Secrets, Ingresses...).
