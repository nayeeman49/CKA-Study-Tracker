@@ 05-Application-Lifecycle-Management/02-RollingUpdates-and-Rollback
### What it is
Updating a Deployment's Pod template (image, env, resources...) creates a **rollout**: a new ReplicaSet is scaled up while the old one is scaled down. Strategy `RollingUpdate` (default) replaces Pods gradually (`maxUnavailable` / `maxSurge`, default 25%); `Recreate` kills all old Pods first (downtime).

### How to do it
```
kubectl set image deployment/web nginx=nginx:1.27
kubectl edit deployment web                      # or edit YAML and apply
kubectl rollout status deployment/web
kubectl rollout history deployment/web
kubectl rollout history deployment/web --revision=2
kubectl rollout undo deployment/web              # previous revision
kubectl rollout undo deployment/web --to-revision=1
kubectl rollout pause deployment/web ; kubectl rollout resume deployment/web
kubectl annotate deployment web kubernetes.io/change-cause="upgrade to 1.27"
```
Tune the strategy:
```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate: {maxSurge: 1, maxUnavailable: 0}
```
### Verify
`kubectl get rs` (new RS scaled up, old at 0), `kubectl get pods -w`.

### Watch out
Only template changes start a rollout (scaling doesn't). A bad image gives `ImagePullBackOff`; the rollout stalls but old Pods keep serving, and `rollout undo` fixes it.

@@ 05-Application-Lifecycle-Management/03-Practice-Test-RollingUpdates-Rollback
### How to work through this lab
1. **Strategy and image:** `kubectl describe deployment frontend` (StrategyType, RollingUpdateStrategy, image).
2. **Update the image:** `kubectl edit deployment frontend` or `kubectl set image deployment/frontend simple-webapp=kodekloud/webapp-color:v2`.
3. **Watch pods roll:** `kubectl get pods -w`; `kubectl rollout status deployment/frontend`.
4. **Change strategy to Recreate:** `kubectl edit deployment frontend`; remove the `rollingUpdate` block when switching `type` to `Recreate` (API rejects both together).
5. **Roll back a bad image:** `kubectl rollout undo deployment/frontend`.

### Verify
`kubectl describe deployment frontend | grep -i image`; `kubectl rollout history deployment frontend`.

@@ 05-Application-Lifecycle-Management/04-Commands-and-Arguments-in-Docker
### The concepts
In a Dockerfile **ENTRYPOINT** is the program that always runs; **CMD** supplies default arguments (or the default command if there is no ENTRYPOINT). Arguments given to `docker run <image> args` replace CMD; `--entrypoint` replaces ENTRYPOINT.

### Example
```dockerfile
FROM ubuntu
ENTRYPOINT ["sleep"]
CMD ["5"]
```
- `docker run ubuntu-sleeper` → `sleep 5`
- `docker run ubuntu-sleeper 10` → `sleep 10`
- `docker run --entrypoint sleep2.0 ubuntu-sleeper 10` → replaces the program.

### How to do it
Use the **JSON array (exec) form** (`["sleep","5"]`) rather than shell form. A container exits when its main process exits; `CMD ["bash"]` quits immediately without a terminal, which is why plain `ubuntu` containers stop at once.

### Why it matters for Kubernetes
Pod `command` overrides ENTRYPOINT and `args` overrides CMD (next lesson). Knowing which one an image defines tells you what to override: inspect with `docker inspect <image>` or the image's Dockerfile.

@@ 05-Application-Lifecycle-Management/05-Commands-and-Arguments-in-Kubernetes
### Mapping
| Dockerfile | Pod spec field |
|---|---|
| ENTRYPOINT | `command` |
| CMD | `args` |

### How to do it
```yaml
spec:
  containers:
  - name: ubuntu-sleeper
    image: ubuntu-sleeper
    command: ["sleep2.0"]    # replaces ENTRYPOINT
    args: ["10"]             # replaces CMD
```
Quick commands: `kubectl run web --image=busybox --command -- sleep 3600` (`--command` makes everything after `--` the command), or without `--command` the words become `args`.
Both lists contain strings; quote numbers: `args: ["--color","green","--port","8080"]`.

### Verify
`kubectl describe pod` shows `Command:` and `Args:`; `kubectl logs` shows the effect.

### Watch out
Setting only `args` keeps the image's ENTRYPOINT; setting `command` alone drops the image's CMD. Changing these in a running Pod requires recreating it.

@@ 05-Application-Lifecycle-Management/06-Practice-Test-Commands-and-Arguments
### How to work through this lab
1. **Read the Dockerfile in the lab** to learn ENTRYPOINT and CMD; `docker run` isn't needed in Kubernetes labs.
2. **Create a Pod that sleeps longer:** write YAML with `command: ["sleep"]` and `args: ["1200"]` (or `command: ["sleep","1200"]`).
3. **Edit a Pod's arguments:** delete and recreate, as the field is immutable: `kubectl get pod webapp-green -o yaml > p.yaml`, edit `args: ["--color","green"]`, `kubectl replace --force -f p.yaml`.
4. **Verify:** `kubectl describe pod` (Args) and view the app.

@@ 05-Application-Lifecycle-Management/07.Configure-Environment-Variables-in-Applications
### How to do it
Three ways to give a container settings:
```yaml
env:
- name: APP_COLOR            # plain value
  value: pink
- name: APP_MODE             # from a ConfigMap key
  valueFrom:
    configMapKeyRef: {name: app-config, key: APP_MODE}
- name: DB_PASSWORD          # from a Secret key
  valueFrom:
    secretKeyRef: {name: app-secret, key: DB_PASSWORD}
```
`envFrom` loads every key of a ConfigMap or Secret. Quick: `kubectl run web --image=nginx --env=APP_COLOR=pink`, `kubectl set env deployment/web APP_COLOR=blue`.

### Verify
`kubectl exec web -- env | grep APP_`; `kubectl describe pod`.

### Watch out
Env vars are read at container start: changing a ConfigMap does not update a running Pod's env. A missing ConfigMap/Secret or key gives `CreateContainerConfigError`.

@@ 05-Application-Lifecycle-Management/08-Configure-ConfigMaps-in-Applications
### How to do it
Create:
```
kubectl create configmap app-config --from-literal=APP_COLOR=blue --from-literal=APP_MODE=prod
kubectl create configmap app-config --from-file=app.properties
kubectl get cm app-config -o yaml
```
Use it three ways:
```yaml
envFrom:                         # all keys as env vars
- configMapRef: {name: app-config}
env:                             # one key
- name: COLOR
  valueFrom: {configMapKeyRef: {name: app-config, key: APP_COLOR}}
volumes:                         # as files
- name: cfg
  configMap: {name: app-config}
# plus volumeMounts: - {name: cfg, mountPath: /etc/config}
```
### Verify
`kubectl exec web -- env` or `ls /etc/config`.

### Watch out
Volume-mounted ConfigMaps update eventually (about a minute) inside the Pod; env vars and `subPath` mounts don't. ConfigMaps are not for secrets.

@@ 05-Application-Lifecycle-Management/09-Practice-Test-Env-Variables
### How to work through this lab
1. **Inspect env of a Pod:** `kubectl describe pod <name>` (Environment section) or `kubectl exec <pod> -- env`.
2. **Set an env var and recreate:** `kubectl get pod webapp-color -o yaml > p.yaml`, add `env: - name: APP_COLOR value: green`, `kubectl replace --force -f p.yaml`.
3. **Create a ConfigMap and use it:** `kubectl create configmap webapp-config-map --from-literal=APP_COLOR=darkblue`; reference it with `valueFrom.configMapKeyRef` or `envFrom`.
4. **Verify:** open the app or `kubectl exec`.

@@ 05-Application-Lifecycle-Management/10.Secrets
### What they are
Secrets hold small sensitive values (passwords, tokens, keys, TLS certs). They are only **base64 encoded**, not encrypted, unless encryption at rest is enabled; protect them with RBAC.

### How to do it
```
kubectl create secret generic db-secret --from-literal=DB_Password=passwd --from-literal=DB_User=root
kubectl create secret generic db-secret --from-file=creds.txt
kubectl create secret docker-registry regcred --docker-server=... --docker-username=... --docker-password=...
kubectl create secret tls web-tls --cert=tls.crt --key=tls.key
kubectl get secret db-secret -o yaml
echo -n 'passwd' | base64         # for YAML `data`
kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d
```
Use it:
```yaml
envFrom: [{secretRef: {name: db-secret}}]
# or one key: valueFrom: {secretKeyRef: {name: db-secret, key: DB_Password}}
# or volume: - name: sec, secret: {secretName: db-secret}   (each key = a file)
```
### Watch out
Use `echo -n` when encoding (no trailing newline). YAML `stringData` accepts plain text. Secret volumes are tmpfs and update when the Secret changes; env vars don't.

@@ 05-Application-Lifecycle-Management/11.Practice-Test-Secrets
### How to work through this lab
1. **Inspect existing Secret:** `kubectl get secrets`, `kubectl describe secret dashboard-token` (types, keys; values hidden), `kubectl get secret <name> -o yaml`.
2. **Create a Secret:** `kubectl create secret generic db-secret --from-literal=DB_Host=sql01 --from-literal=DB_User=root --from-literal=DB_Password=password123`.
3. **Inject into a Pod:** add `envFrom: - secretRef: name: db-secret` to the container, recreate the Pod (`kubectl replace --force -f`).
4. **Verify:** `kubectl exec <pod> -- env | grep DB_`; the app page reflects the connection.

@@ 05-Application-Lifecycle-Management/12.Multi-Containers-PODs
### What it is
Two or more containers in one Pod share the network namespace (reach each other on `localhost`), can share volumes, and start/stop together. Use this for tightly coupled helpers, e.g. a web app plus a log shipper.

### How to do it
```yaml
spec:
  containers:
  - name: web
    image: nginx
  - name: log-agent
    image: busybox
    command: ["sh","-c","tail -F /var/log/nginx/access.log"]
    volumeMounts: [{name: logs, mountPath: /var/log/nginx}]
  volumes: [{name: logs, emptyDir: {}}]
```
### Check
`kubectl get pod` READY `2/2`; `kubectl logs web-pod -c log-agent`; `kubectl exec -it web-pod -c web -- sh`.

### Watch out
Always pass `-c <container>` for logs/exec in multi-container Pods. The Pod is only Ready when all containers are Ready. Containers can't use the same port.

@@ 05-Application-Lifecycle-Management/13-Practice-Test-Multi-Container-Pods
### How to work through this lab
1. **Inspect a Pod:** `kubectl describe pod lemon` (container names, images, READY count).
2. **Create a two-container Pod:** `kubectl run yellow --image=busybox --dry-run=client -o yaml > y.yaml`; add a second container under `containers`, e.g. `- name: gold, image: redis`; `kubectl apply -f y.yaml`.
3. **Shared log volume (sidecar):** add an `emptyDir` volume mounted at the same `mountPath` in both containers, then `kubectl logs <pod> -c <sidecar>`.
4. **Logs from ELK-style sidecar:** open Kibana or check `kubectl exec -it <pod> -c <name> -- ls /log`.

### Verify
`kubectl get pod` shows `2/2`.

@@ 05-Application-Lifecycle-Management/14-Multi-Container-Pods-Design-Patterns
### The three patterns
- **Sidecar**: extends the main container: log shipper, config reloader, proxy.
- **Adapter**: transforms the app's output to a standard format (e.g. converts custom metrics to Prometheus format).
- **Ambassador**: proxies the app's outbound connections (e.g. connect to `localhost:6379` while the ambassador picks the right DB shard/environment).
All share the Pod's network and can share volumes.

### How to do it
Pick the pattern from the requirement, put the helper in `containers` (or as a native sidecar: an init container with `restartPolicy: Always`, which starts first and keeps running):
```yaml
initContainers:
- name: log-shipper
  image: fluent/fluent-bit
  restartPolicy: Always
```
### Watch out
Don't put unrelated services in one Pod: they scale together. For the exam, know how to write the YAML more than the pattern names.

@@ 05-Application-Lifecycle-Management/15.Init-Containers
### What it is
Containers that run **to completion, one at a time, in order**, before the app containers start. Use for waiting on dependencies, cloning a repo, database migrations, setting permissions.

### How to do it
```yaml
spec:
  containers:
  - name: app
    image: busybox
    command: ["sh","-c","echo running; sleep 3600"]
  initContainers:
  - name: wait-db
    image: busybox
    command: ["sh","-c","until nslookup mydb.default.svc.cluster.local; do echo waiting; sleep 2; done"]
  - name: init-myservice
    image: busybox
    command: ["sh","-c","git clone https://github.com/example/repo /work"]
    volumeMounts: [{name: work, mountPath: /work}]
```
### Check
`kubectl get pod` STATUS `Init:0/2`, then `PodInitializing`, then `Running`. `kubectl logs <pod> -c wait-db`; `kubectl describe pod`.

### Watch out
If an init container keeps failing the app never starts (`Init:Error` / `Init:CrashLoopBackOff`); read its logs with `-c`. With `restartPolicy: Never` a failed init fails the Pod.

@@ 05-Application-Lifecycle-Management/16-Practice-Test-Init-Containers
### How to work through this lab
1. **Inspect the Pod:** `kubectl describe pod blue`; status `Init:0/1`; find the init container's image and command.
2. **Why stuck?** the init command is e.g. `sleep 600` (just wait) or a wrong command like `sleeeep 2`, which gives `Init:Error`. See `kubectl logs blue -c init-myservice`.
3. **Fix:** edit the Pod YAML (`kubectl get pod red -o yaml > r.yaml`), correct the init command, `kubectl replace --force -f r.yaml`.
4. **Add an init container:** copy the format above under `initContainers`.

### Verify
Pod reaches `Running` and `kubectl describe` shows init containers `Completed` (exit 0).

@@ 05-Application-Lifecycle-Management/17.Self-Healing-Applications
### What it is
Kubernetes restarts and replaces failing parts automatically:
- **ReplicaSet/Deployment** recreates Pods that are deleted or lost with their node.
- **kubelet** restarts failed containers according to `restartPolicy` (`Always` default, `OnFailure`, `Never`).
- **Probes**: *liveness* restarts a hung container; *readiness* removes it from Service endpoints until it is ready; *startup* delays the others for slow starters.

### How to do it
```yaml
livenessProbe:
  httpGet: {path: /healthz, port: 8080}
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3
readinessProbe:
  tcpSocket: {port: 3306}
startupProbe:
  exec: {command: ["cat","/tmp/ready"]}
```
Probe types: `httpGet`, `tcpSocket`, `exec`, `grpc`.

### Verify
`kubectl describe pod` (Liveness/Readiness lines and Events `Unhealthy`); the RESTARTS column; `kubectl get ep` for readiness.

### Watch out
A too-strict liveness probe causes restart loops. Readiness failures don't restart the container; they just stop traffic.
