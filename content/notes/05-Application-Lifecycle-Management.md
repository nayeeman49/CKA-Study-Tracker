## What this section is about
Deploying, updating and configuring applications: rolling updates and rollbacks, passing commands, environment variables, ConfigMaps and Secrets into containers, multi-container Pods, init containers and self-healing. This is the heart of the *Workloads and Scheduling* domain (15%).

## Rolling updates and rollbacks
A Deployment's `strategy` is `RollingUpdate` (default; `maxSurge` and `maxUnavailable` control the pace) or `Recreate` (kill all, then start new).
```
kubectl set image deployment/web nginx=nginx:1.27   # or kubectl edit / apply
kubectl rollout status deployment/web
kubectl rollout history deployment/web
kubectl rollout undo deployment/web [--to-revision=2]
kubectl rollout pause|resume deployment/web
```
A new rollout is triggered only when the **Pod template** changes (image, env, labels), not when you scale. Each revision is a ReplicaSet; `revisionHistoryLimit` controls how many old ones are kept. Annotate with `kubectl annotate deployment web kubernetes.io/change-cause="..."` to make history readable.

## Commands and arguments
Dockerfile `ENTRYPOINT` ↔ Pod `command`; Dockerfile `CMD` ↔ Pod `args`. Setting `command` overrides ENTRYPOINT (and drops CMD); setting only `args` replaces CMD.
```yaml
containers:
- name: app
  image: busybox
  command: ["sleep"]
  args: ["3600"]
```

## Environment variables, ConfigMaps, Secrets
```
kubectl create configmap app-config --from-literal=MODE=prod --from-file=app.properties
kubectl create secret generic db --from-literal=password='S3cr3t!'
```
Ways to inject: `env[].value`, `env[].valueFrom.configMapKeyRef|secretKeyRef`, `envFrom` (all keys), or mount as a **volume** (each key becomes a file). Volume-mounted ConfigMaps/Secrets update in the running Pod eventually; env vars do **not** update until the Pod restarts. Secrets are only base64-encoded unless you enable encryption at rest; restrict access with RBAC. Types include `Opaque`, `kubernetes.io/dockerconfigjson` (registry creds, used by `imagePullSecrets`) and `kubernetes.io/tls`.

## Multi-container Pods
Containers in a Pod share network and volumes. Patterns: **sidecar** (log shipper, proxy), **ambassador** (outbound proxy), **adapter** (normalise output). Native sidecars are init containers with `restartPolicy: Always`.

## Init containers
Run to completion, in order, before app containers start. Use them to wait for a dependency (`until nslookup db; do sleep 2; done`), fetch config, or set permissions. If one fails the Pod restarts it according to `restartPolicy`; Pod status shows `Init:0/1`, `Init:CrashLoopBackOff`.

## Self-healing
- `restartPolicy` (`Always`, `OnFailure`, `Never`) governs container restarts by the kubelet.
- **Liveness probe** failing → restart container. **Readiness probe** failing → removed from Service endpoints. **Startup probe** protects slow starters. Types: `httpGet`, `tcpSocket`, `exec`, `grpc`.
- ReplicaSets/Deployments replace Pods deleted or lost with a node.

## Exam tips
- `kubectl create deployment ... --dry-run=client -o yaml` then add env/volumes.
- `kubectl get secret db -o jsonpath='{.data.password}' | base64 -d` to read a secret.
- If a rollout stalls (ImagePullBackOff), `rollout undo` is the fast fix.

## Official documentation
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/), [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Define a Command and Arguments](https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/)
- [Environment variables for a container](https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/)
- [Init Containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/), [Sidecar containers](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/)
- [Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
