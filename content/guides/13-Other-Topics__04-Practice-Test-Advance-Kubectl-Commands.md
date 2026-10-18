### How to approach this lab

Each task saves the output of a query to a file.

### Tasks and commands

```bash
kubectl get nodes -o jsonpath='{.items[*].metadata.name}' > /opt/outputs/node_names.txt
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.osImage}' > /opt/outputs/nodes_os.txt
kubectl config view --kubeconfig=/root/my-kube-config -o jsonpath='{.users[*].name}' > /opt/outputs/users.txt
kubectl get pv --sort-by=.spec.capacity.storage > /opt/outputs/storage-capacity-sorted.txt
kubectl get pv --sort-by=.spec.capacity.storage -o custom-columns=NAME:.metadata.name,CAPACITY:.spec.capacity.storage > /opt/outputs/pv-and-capacity-sorted.txt
kubectl config view --kubeconfig=/root/my-kube-config -o jsonpath='{.contexts[?(@.context.user=="aws-user")].name}' > /opt/outputs/aws-context-name
```

### Check

`cat` the file afterwards. The expected format is exact, so no extra text or trailing commentary.

### Verify your answers

```bash
cat /opt/outputs/node_names.txt
wc -w /opt/outputs/node_names.txt
kubectl get nodes --no-headers | wc -l      # should match
```

Output files must hold only the requested data: no headers, no extra blank lines unless the task specifies a format.
