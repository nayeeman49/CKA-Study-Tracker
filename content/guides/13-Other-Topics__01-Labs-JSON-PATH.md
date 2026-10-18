### Introduction

Hands-on practice of JSONPath queries against kubectl output. JSONPath is a query language to extract fields from JSON; kubectl uses it with `-o jsonpath`.

### Method

1. Look at the structure first: `kubectl get pods -o json | less` (or `-o yaml`).
2. Build the path from the root: `.items[0].spec.containers[0].image`.
3. Use `[*]` for all elements, `[?(@.key=="value")]` for filters.
4. Format with `range` loops and `{"\n"}` / `{"\t"}`.

### Examples

```bash
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.osImage}'
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}'
kubectl get pv -o jsonpath='{.items[*].spec.capacity.storage}'
```

### Tips

- Save the output to files when asked: `> /opt/outputs/nodes.txt`.
- `kubectl explain` finds field names.
- Quote the expression in single quotes.

### Practice set

```bash
kubectl get pods -o jsonpath='{.items[0].spec.containers[0].image}'
kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}'
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.nodeName}{"\n"}{end}'
kubectl get deploy -A -o jsonpath='{.items[*].spec.template.spec.containers[*].image}' | tr ' ' '\n' | sort -u
```

Debug trick: an empty result usually means a wrong key, a missing `.items` (list vs single object) or `[0]` vs `[*]` mix-up.
