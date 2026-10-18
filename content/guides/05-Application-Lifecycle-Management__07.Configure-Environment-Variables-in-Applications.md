### Introduction

Environment variables are the simplest way to give configuration to an application (colour, URL, mode). You set them in the container spec.

### Direct values

```yaml
spec:
  containers:
  - name: app
    image: kodekloud/webapp-color
    env:
    - name: APP_COLOR
      value: pink
    - name: APP_MODE
      value: prod
```

### Other value sources

`env[].valueFrom` can reference a ConfigMap, a Secret, or the Pod's own fields:

```yaml
env:
- name: APP_COLOR
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: APP_COLOR
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: app-secret
      key: DB_PASSWORD
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
- name: CPU_LIMIT
  valueFrom:
    resourceFieldRef:
      containerName: app
      resource: limits.cpu
```

### Check

```bash
kubectl exec app -- env
kubectl exec app -- printenv APP_COLOR
kubectl describe pod app | grep -A5 Environment
```

### Limitations

- Env vars are read at container start. Changing the source later does not update a running Pod.
- Hard-coded values in many Pod files are hard to manage, so use ConfigMaps (next lesson).

### Key takeaways

- `env` with `name` and `value`, or `valueFrom` for ConfigMap/Secret/fields.
