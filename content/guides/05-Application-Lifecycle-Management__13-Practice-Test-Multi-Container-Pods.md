### How to approach this lab

Create and fix Pods with several containers, and read logs from a specific container. One task usually involves a log sidecar sending to Elasticsearch/Kibana.

### Commands

```bash
kubectl get pod lemon -o jsonpath='{.spec.containers[*].name}'
kubectl logs app -c sidecar
kubectl run yellow --image=busybox --dry-run=client -o yaml > yellow.yaml
vi yellow.yaml        # add second container
kubectl apply -f yellow.yaml
kubectl exec -it app -n elastic-stack -- cat /log/app.log
```

### Adding a container in YAML

```yaml
spec:
  containers:
  - name: lemon
    image: busybox
    command: ["sleep","1000"]
  - name: gold
    image: redis
```

### Tips

- `READY` column shows ready/total containers.
- For shared logs use an `emptyDir` volume mounted by both containers.
- Edit a running Pod can't add containers: recreate it.

### Worked example

A Pod needs `lemon` (busybox) plus `gold` (redis):

```yaml
spec:
  containers:
  - name: lemon
    image: busybox
    command: ["sleep","1000"]
  - name: gold
    image: redis
```

A sidecar shipping logs, sharing an `emptyDir`:

```yaml
  containers:
  - name: app
    image: kodekloud/event-simulator
    volumeMounts: [{name: log-volume, mountPath: /log}]
  - name: sidecar
    image: kodekloud/filebeat-configured
    volumeMounts: [{name: log-volume, mountPath: /var/log/event-simulator/}]
  volumes:
  - name: log-volume
    emptyDir: {}
```

### Common mistakes

- Trying to add a container to a running Pod (recreate it).
- Two containers using the same port.
