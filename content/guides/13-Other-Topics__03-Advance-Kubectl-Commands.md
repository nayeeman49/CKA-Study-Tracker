### Introduction

Advanced kubectl output control for exam tasks: jsonpath, custom-columns, sort-by, field selectors.

### Examples

```bash
kubectl get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image
kubectl get nodes --sort-by=.metadata.name
kubectl get pv --sort-by=.spec.capacity.storage
kubectl get pv --sort-by=.spec.capacity.storage -o custom-columns=NAME:.metadata.name,CAPACITY:.spec.capacity.storage
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\n"}{end}'
kubectl config view -o jsonpath='{.contexts[?(@.context.user=="aws-user")].name}'
```

### Handy selectors

```bash
kubectl get pods --field-selector=status.phase=Running
kubectl get pods --field-selector=spec.nodeName=node01 -A
kubectl get events --field-selector type=Warning
kubectl get pods -l app=web -o name
```

### Other power tools

```bash
kubectl get pods -o wide
kubectl get pod x -o yaml
kubectl explain pod.spec.containers --recursive
kubectl diff -f file.yaml
kubectl wait --for=condition=Ready pod/x --timeout=60s
kubectl auth can-i list pods --as user
```

### Key takeaways

- Output shaping saves time on "write X to a file" tasks.

### Output cheat sheet

| Need | Flag |
|---|---|
| Wider columns | `-o wide` |
| Names only | `-o name` |
| Own columns | `-o custom-columns=A:.path` |
| Single value | `-o jsonpath='{...}'` |
| Sort | `--sort-by=.path` |
| Filter on fields | `--field-selector` |
| No header | `--no-headers` |

Combine with `wc -l`, `awk`, `sort -u` for quick answers.
