## What this section is about
Speed tools for the exam: JSONPath and advanced `kubectl` output. They turn "find the node with X" into one command.

## Output formats
`-o wide`, `-o yaml`, `-o json`, `-o name`, `-o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[*].image`, `--sort-by=.metadata.creationTimestamp`.

## JSONPath
```
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}'
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.osImage}'
kubectl get pv --sort-by=.spec.capacity.storage -o custom-columns=NAME:.metadata.name,CAP:.spec.capacity.storage
```
Tips: `.items[*]` for lists, `range ... end` to loop, filters `?(@.type=="Ready")`. Pipe to `jq` if available. Combine with `--sort-by` and `-l` selectors. Use `kubectl explain` and `kubectl api-resources` to discover field and resource names.

## Other useful commands
`kubectl diff -f`, `kubectl apply --prune`, `kubectl patch`, `kubectl replace --force`, `kubectl wait --for=condition=Ready pod/x`, `kubectl cp`, `kubectl port-forward`, `kubectl exec -it`, `kubectl auth can-i`, `kubectl config`.

## Official documentation
- [JSONPath Support](https://kubernetes.io/docs/reference/kubectl/jsonpath/)
- [kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/)
- [kubectl reference](https://kubernetes.io/docs/reference/kubectl/)
