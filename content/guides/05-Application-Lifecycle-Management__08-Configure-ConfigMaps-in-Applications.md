### Introduction

A ConfigMap stores non-confidential configuration as key-value pairs, separately from Pod definitions. This lets you reuse the same image in different environments.

### Create

```bash
# imperative
kubectl create configmap app-config --from-literal=APP_COLOR=blue --from-literal=APP_MODE=prod
kubectl create configmap app-config --from-file=app.properties
kubectl create configmap app-config --from-env-file=.env
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_COLOR: blue
  APP_MODE: prod
```

```bash
kubectl get cm
kubectl describe cm app-config
kubectl get cm app-config -o yaml
```

### Inject into a Pod, three ways

#### 1. All keys as environment variables

```yaml
envFrom:
- configMapRef:
    name: app-config
```

#### 2. A single key

```yaml
env:
- name: APP_COLOR
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: APP_COLOR
```

#### 3. As files in a volume

```yaml
volumes:
- name: config
  configMap:
    name: app-config
containers:
- name: app
  volumeMounts:
  - name: config
    mountPath: /etc/config      # each key becomes a file
```

Volume-mounted ConfigMaps are **updated automatically** (after a short delay) while env vars are not.

### Notes

- Max size ~1 MiB.
- ConfigMaps are namespaced; the Pod and ConfigMap must be in the same namespace.
- `immutable: true` locks a ConfigMap.
- Missing ConfigMap makes the Pod `CreateContainerConfigError`.

### Key takeaways

- ConfigMap = external config; use `envFrom`, `configMapKeyRef`, or a volume.
