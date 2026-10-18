### How to approach this lab

Create Pods using environment variables and ConfigMaps.

### Commands

```bash
kubectl describe pod webapp-color | grep -A3 Environment
kubectl create configmap webapp-config-map --from-literal=APP_COLOR=darkblue --from-literal=APP_OTHER=disregard
kubectl get cm
kubectl describe cm webapp-config-map
kubectl get pod webapp-color -o yaml > p.yaml
vi p.yaml        # add envFrom or env/valueFrom
kubectl replace --force -f p.yaml
kubectl exec webapp-color -- env | grep APP
```

### Notes

- Environment variables can't be edited on a live Pod; recreate it.
- Verify in the app UI (colour) or with `printenv`.

### Worked example

```bash
kubectl create configmap webapp-config-map --from-literal=APP_COLOR=darkblue --from-literal=APP_OTHER=disregard
kubectl get pod webapp-color -o yaml > p.yaml
```

Add to the container:

```yaml
    env:
    - name: APP_COLOR
      valueFrom:
        configMapKeyRef:
          name: webapp-config-map
          key: APP_COLOR
```

```bash
kubectl replace --force -f p.yaml
kubectl exec webapp-color -- printenv APP_COLOR
```

### Common mistakes

- Wrong `key` name (case sensitive).
- Pod in `CreateContainerConfigError` because the ConfigMap doesn't exist in that namespace.
