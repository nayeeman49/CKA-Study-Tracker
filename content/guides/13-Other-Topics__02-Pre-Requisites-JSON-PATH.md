### Introduction

JSONPath basics before using it with kubectl.

### JSON refresher

```json
{
  "car": { "color": "blue", "price": 20000 },
  "bus": { "color": "red", "price": "100000" },
  "wheels": [ { "model": "KDJ39", "location": "rear-right" }, { "model": "TRE45", "location": "front-left" } ]
}
```

### JSONPath syntax

| Expression | Meaning |
|---|---|
| `$` | Root |
| `$.car.color` | Child by key |
| `$.wheels[0].model` | Array index |
| `$.wheels[*].model` | All elements |
| `$[?(@.price>1000)]` | Filter |
| `$..model` | Recursive search |
| `$[0:3]` | Slice |
| `$[-1:]` | Last element |

In kubectl the root `$` is implicit and the expression goes in braces.

### Lists in JSONPath

kubectl output of multiple objects is a `List` with `.items`. A query on one resource has no `.items`.

### Formatting

```bash
kubectl get nodes -o jsonpath='{.items[*].metadata.name}{"\n"}{.items[*].status.capacity.cpu}{"\n"}'
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\n"}{end}'
```

### Custom columns and sorting

```bash
kubectl get nodes -o custom-columns=NODE:.metadata.name,CPU:.status.capacity.cpu
kubectl get nodes --sort-by=.metadata.name
```

### Key takeaways

- Learn `[*]`, filters and `range`.
