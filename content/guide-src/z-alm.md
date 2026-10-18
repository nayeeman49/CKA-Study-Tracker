@@ 04-Logging-and-Monitoring/02-Monitor-Cluster-Components
### Introduction

Monitoring tells you how healthy the cluster and its workloads are: node CPU and memory, Pod resource use, and the state of control plane components. Kubernetes has **no full built-in monitoring solution**. It ships with a lightweight metrics pipeline (Metrics Server) and relies on tools such as Prometheus, Grafana, Datadog or the Elastic stack for more.

### What you want to monitor

- **Node level**: number of nodes, how many are healthy, CPU, memory, disk and network use.
- **Pod level**: number of Pods, and each Pod's CPU and memory consumption.
- **Control plane health**: API Server, scheduler, controller manager, ETCD.
- **Application level**: logs and custom metrics.

### How metrics flow

```
 kubelet (contains cAdvisor)  collects container metrics
          │
          ▼
   Metrics Server   (in-memory, aggregates from every kubelet)
          │
          ▼
   kubectl top  /  Horizontal Pod Autoscaler
```

- **cAdvisor** is part of the kubelet; it gathers container CPU, memory, filesystem, network usage.
- **Metrics Server** collects these from all nodes and keeps them **in memory only** (no history). It powers `kubectl top` and autoscaling.
- For history, graphs and alerts you need Prometheus or another system.

### Installing the Metrics Server

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system get deploy metrics-server
```

In lab clusters with self-signed kubelet certificates you may need `--kubelet-insecure-tls` on the deployment args.

### Using it

```bash
kubectl top node
kubectl top pod
kubectl top pod -A --sort-by=memory
kubectl top pod --containers
kubectl top pod -l app=web
```

Output columns: `CPU(cores)` e.g. `250m`, `MEMORY(bytes)` e.g. `300Mi`.

### Other useful health checks

```bash
kubectl get nodes
kubectl get componentstatuses          # deprecated
kubectl get --raw='/readyz?verbose'
kubectl get --raw='/livez?verbose'
kubectl describe node node01           # conditions + allocated resources
kubectl get events -A --sort-by=.lastTimestamp
```

### Troubleshooting

- `error: Metrics API not available`: Metrics Server not installed or not ready; check its Pod and logs.
- Metrics Server runs but "x509 certificate" errors: add `--kubelet-insecure-tls` (labs only), or fix kubelet serving certs.
- `kubectl top` shows `<unknown>` right after install: wait a minute for the first scrape.

### CKA exam tips

- Know `kubectl top node/pod` and `--sort-by`.
- Know that the Metrics Server is in-memory and has no history.

### Key takeaways

- cAdvisor → kubelet → Metrics Server → `kubectl top` and HPA.
- Use Prometheus-type tooling for history and alerting.

@@ 04-Logging-and-Monitoring/03-Practice-Test-Monitor-Cluster-Components
### How to approach this lab

The lab deploys a Metrics Server (or has one deployed) and asks which node or Pod consumes the most resources.

### Commands

```bash
kubectl top node
kubectl top node --sort-by=cpu
kubectl top pod
kubectl top pod --sort-by=memory
kubectl top pod -A --sort-by=cpu --no-headers | head -1
kubectl -n kube-system get pods | grep metrics
kubectl -n kube-system logs deploy/metrics-server
```

### Typical questions

| Question | Answer approach |
|---|---|
| Which node consumes the most CPU? | `kubectl top node` |
| Which node consumes the most memory? | `kubectl top node --sort-by=memory` |
| Which Pod uses the most memory? | `kubectl top pod --sort-by=memory` |
| Which Pod uses the least CPU? | `kubectl top pod --sort-by=cpu` (last line) |

### Tips

- Give the Metrics Server a minute after deployment before querying.
- Use `-A` to include all namespaces.

@@ 04-Logging-and-Monitoring/04-Managing-Application-Logs
### Introduction

Logs are the first place to look when an application misbehaves. Kubernetes captures anything a container writes to standard output (stdout) and standard error (stderr).

### Docker/runtime logs vs Kubernetes logs

In plain Docker: `docker logs -f container`. In Kubernetes the runtime stores each container's output on the node, and `kubectl logs` fetches it via the API Server and the kubelet.

```
 app writes stdout/stderr ──► runtime ──► /var/log/pods/<ns>_<pod>_<uid>/<container>/0.log
                                                │
                                           kubelet serves
                                                ▼
                                          kubectl logs
```

### kubectl logs

```bash
kubectl logs web-pod
kubectl logs -f web-pod                      # follow (stream)
kubectl logs web-pod -c sidecar              # specific container in multi-container Pod
kubectl logs web-pod --previous              # previous crashed container instance
kubectl logs web-pod --tail=50
kubectl logs web-pod --since=10m
kubectl logs web-pod --timestamps
kubectl logs -l app=web --all-containers=true
kubectl logs deploy/web
kubectl logs job/backup
```

In a Pod with multiple containers you **must** name the container with `-c`, otherwise kubectl prints an error listing the container names (or picks the default one).

### Where logs live on the node

```bash
ls /var/log/pods/
ls /var/log/containers/            # symlinks with readable names
crictl logs <container-id>         # when kubectl can't reach the API
journalctl -u kubelet              # kubelet's own logs (systemd)
```

Log rotation is handled by the kubelet (`containerLogMaxSize`, `containerLogMaxFiles`). When a Pod is deleted its logs go with it.

### Cluster-level logging

Because logs vanish with Pods, production clusters ship them to a central store:

- **Node-level agent** (DaemonSet): Fluentd/Fluent Bit/Filebeat reads files in `/var/log/containers`.
- **Sidecar container**: a second container in the Pod streams or tails a log file.
- **Direct push** from the application.

Typical stack: Fluent Bit → Elasticsearch/Loki → Kibana/Grafana.

### Apps that write to files

If an app writes logs to a file instead of stdout, `kubectl logs` shows nothing. Use `kubectl exec pod -- cat /var/log/app.log`, or add a sidecar that tails the file to its own stdout.

### Control plane logs

```bash
kubectl logs -n kube-system kube-apiserver-controlplane
kubectl logs -n kube-system etcd-controlplane
journalctl -u kubelet
crictl ps -a ; crictl logs <id>        # if API server is down
```

### Events

```bash
kubectl get events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl describe pod x         # events at the bottom
```

### Troubleshooting

- `kubectl logs` prints nothing: app writes to a file, or hasn't started.
- "container ... is waiting to start": see `describe pod`.
- CrashLoopBackOff: `kubectl logs --previous`.

### CKA exam tips

- Always know `-c`, `-f`, `--previous`.
- `kubectl logs` is the first step in application troubleshooting.

### Key takeaways

- Kubernetes collects stdout/stderr; use `kubectl logs`.
- For persistence use a logging stack; for a broken API Server use `crictl logs`.

@@ 04-Logging-and-Monitoring/06-Practice-Test-Managing-Application-Logs
### How to approach this lab

You'll read logs from a running application, including a multi-container Pod.

### Commands

```bash
kubectl get pods
kubectl logs webapp-1
kubectl logs webapp-2 -c simple-webapp
kubectl logs webapp-2 -c db
kubectl describe pod webapp-2 | grep -A3 "Containers:"
kubectl logs -f webapp-1
kubectl logs webapp-1 | grep -i error
```

### Typical questions

| Question | Approach |
|---|---|
| What is the user that is failing to log in? | `kubectl logs webapp-1` and look for "USER... Failed" |
| Which container is logging an error? | Check each container with `-c` |
| What is the reason for the failure? | Read the last lines or `grep -i warning` |

### Tips

- List container names with `kubectl get pod x -o jsonpath='{.spec.containers[*].name}'`.
- Use `--tail` to see just the end.

@@ 05-Application-Lifecycle-Management/02-RollingUpdates-and-Rollback
### Introduction

Applications change: new versions, bug fixes, configuration changes. A Deployment rolls out changes gradually so the application stays available, and can roll back if something goes wrong.

### Rollout and revisions

Whenever a Deployment's Pod template changes (image, env, resources), a **rollout** happens and creates a new **revision**. Scaling does not create a revision.

```bash
kubectl rollout status deployment/web
kubectl rollout history deployment/web
kubectl rollout history deployment/web --revision=2
```

### Deployment strategies

| Strategy | How | Downtime |
|---|---|---|
| **RollingUpdate** (default) | Replace Pods gradually: new ones up, old ones down | None |
| **Recreate** | Delete all old Pods, then create new | Yes |

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%          # extra Pods allowed above replicas
      maxUnavailable: 25%    # Pods that may be unavailable
```

```
 replicas=4, maxSurge=1, maxUnavailable=1

 old ■■■■        new
 old ■■■  new ■    (1 surge, 1 down)
 old ■■   new ■■
 old ■    new ■■■
      new ■■■■
```

Behind the scenes the Deployment creates a **new ReplicaSet** and scales it up while scaling the old one down.

```bash
kubectl get rs      # old RS at 0 replicas is kept for rollback
```

### How to update

```bash
kubectl set image deployment/web nginx=nginx:1.27            # imperative
kubectl edit deployment web                                  # live edit
kubectl apply -f deploy.yaml                                 # declarative
kubectl set resources deployment web --limits=cpu=500m
kubectl rollout restart deployment/web                       # new rollout, same config
```

Record the reason (annotation for `CHANGE-CAUSE`):

```bash
kubectl annotate deployment/web kubernetes.io/change-cause="update to 1.27"
```

(The `--record` flag is deprecated.)

### Rollback

```bash
kubectl rollout undo deployment/web                     # previous revision
kubectl rollout undo deployment/web --to-revision=2
```

### Pause and resume

```bash
kubectl rollout pause deployment/web
kubectl set image deployment/web nginx=nginx:1.28
kubectl set resources deployment/web --limits=memory=256Mi
kubectl rollout resume deployment/web      # one rollout for all changes
```

### Controlling history

`revisionHistoryLimit` (default 10) controls how many old ReplicaSets are kept.

### Watching a rollout

```bash
kubectl rollout status deployment/web
kubectl get pods -w
```

If a rollout stalls (new Pods stay unready) the old Pods keep serving, which is the safety net. `progressDeadlineSeconds` (default 600) marks it failed.

### Troubleshooting

- New Pods `ImagePullBackOff`: wrong tag; `rollout undo`.
- Rollout stuck: readiness probe failing, check `describe pod`.
- `maxUnavailable: 0` and `maxSurge: 0` is invalid.

### CKA exam tips

- Commands: `set image`, `rollout status/history/undo`.
- Container name in `set image` must match the container name in the template.

### Key takeaways

- Rolling update by default; new ReplicaSet each revision.
- `rollout undo` goes back.

@@ 05-Application-Lifecycle-Management/03-Practice-Test-RollingUpdates-Rollback
### How to approach this lab

Tasks: inspect strategy, update the image, observe rollout, roll back, change the strategy.

### Commands

```bash
kubectl describe deployment frontend | grep -i -E "strategy|rollingupdate|image"
kubectl set image deployment/frontend simple-webapp=kodekloud/webapp-color:v2
kubectl rollout status deployment/frontend
kubectl rollout history deployment/frontend
kubectl rollout undo deployment/frontend
kubectl edit deployment frontend       # change strategy to Recreate
kubectl get pods -w
```

### Notes

- Find the container name with `describe` or `-o jsonpath='{.spec.template.spec.containers[*].name}'`.
- When switching to `Recreate` you must delete the `rollingUpdate:` block, otherwise validation fails.
- Bad image tags create new Pods in `ImagePullBackOff` while old ones keep running; use `rollout undo`.

@@ 05-Application-Lifecycle-Management/04-Commands-and-Arguments-in-Docker
### Introduction

Before configuring commands in Kubernetes you need to know how Docker images define what runs: `ENTRYPOINT` and `CMD`.

### Containers run a process, not an OS

A container lives only as long as its main process. `docker run ubuntu` exits immediately because `ubuntu` has no long-running process (default CMD is `bash`, which exits without a terminal).

### CMD

Default command or arguments, replaced by anything given on the command line.

```dockerfile
FROM ubuntu
CMD ["sleep", "5"]
```

```bash
docker run ubuntu-sleeper            # sleep 5
docker run ubuntu-sleeper sleep 10   # replaces CMD entirely
```

### ENTRYPOINT

The fixed executable; arguments on the command line are **appended**.

```dockerfile
FROM ubuntu
ENTRYPOINT ["sleep"]
```

```bash
docker run ubuntu-sleeper 10         # sleep 10
docker run ubuntu-sleeper            # sleep  (error: missing operand)
```

### ENTRYPOINT + CMD together

CMD supplies the default argument:

```dockerfile
ENTRYPOINT ["sleep"]
CMD ["5"]
```

```bash
docker run ubuntu-sleeper            # sleep 5
docker run ubuntu-sleeper 10         # sleep 10
docker run --entrypoint sleep2.0 ubuntu-sleeper 10   # override entrypoint
```

### Shell form vs exec form

Use the JSON array form (`["sleep","5"]`). The shell form (`CMD sleep 5`) runs through `/bin/sh -c` and doesn't pass signals well.

### Summary

| Dockerfile | Overridden by |
|---|---|
| `ENTRYPOINT` | `docker run --entrypoint` |
| `CMD` | arguments after the image name |

### Key takeaways

- ENTRYPOINT = program, CMD = default arguments.
- This maps directly to Kubernetes `command` and `args`.

@@ 05-Application-Lifecycle-Management/05-Commands-and-Arguments-in-Kubernetes
### Introduction

In a Pod spec you can override the image's ENTRYPOINT and CMD with `command` and `args`.

### Mapping

| Docker | Kubernetes |
|---|---|
| `ENTRYPOINT` | `command` |
| `CMD` | `args` |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ubuntu-sleeper
spec:
  containers:
  - name: ubuntu-sleeper
    image: ubuntu-sleeper        # ENTRYPOINT ["sleep"], CMD ["5"]
    command: ["sleep2.0"]        # replaces ENTRYPOINT
    args: ["10"]                 # replaces CMD
```

### Rules

| `command` | `args` | Result |
|---|---|---|
| not set | not set | image ENTRYPOINT + CMD |
| set | not set | `command` only; image CMD ignored |
| not set | set | image ENTRYPOINT + `args` |
| set | set | `command` + `args` |

### Syntax tips

- Every element is a separate string; numbers must be quoted: `args: ["--color","green","10"]` or `["10"]`.
- Multi-line args:

```yaml
command: ["sh","-c"]
args:
- |
  echo hello
  sleep 3600
```

### Imperative

```bash
kubectl run web --image=nginx -- --arg1 value        # args after --
kubectl run busybox --image=busybox --command -- sleep 3600
kubectl run x --image=busybox --dry-run=client -o yaml -- sleep 1000
```

`--command` makes the part after `--` the command rather than the args.

### Editing

`command` and `args` are immutable on a running Pod; recreate it.

### Troubleshooting

- `CrashLoopBackOff` with "executable file not found": wrong command path.
- Container exits immediately: the process finishes; give it a long-running command.

### Key takeaways

- command = ENTRYPOINT, args = CMD.

@@ 05-Application-Lifecycle-Management/06-Practice-Test-Commands-and-Arguments
### How to approach this lab

You'll read an image's behaviour, and create/modify Pods with `command` and `args`.

### Commands

```bash
kubectl describe pod ubuntu-sleeper-2 | grep -A5 Command
kubectl run webapp-green --image=kodekloud/webapp-color -- --color=green
kubectl run ubuntu --image=ubuntu --dry-run=client -o yaml -- sleep 5000 > p.yaml
kubectl get pod x -o yaml > x.yaml ; vi x.yaml
kubectl replace --force -f x.yaml
```

### Common tasks

| Task | Answer |
|---|---|
| Pod runs `sleep 5000` | `command: ["sleep","5000"]` or `args` |
| App needs `--color green` | `args: ["--color","green"]` |
| Change the delay in an existing Pod | Edit the file and replace (fields are immutable) |

### Tips

- Look at the image's Dockerfile to see ENTRYPOINT/CMD.
- Check the result: `kubectl logs` or `kubectl describe`.

@@ 05-Application-Lifecycle-Management/07.Configure-Environment-Variables-in-Applications
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

@@ 05-Application-Lifecycle-Management/08-Configure-ConfigMaps-in-Applications
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

@@ 05-Application-Lifecycle-Management/09-Practice-Test-Env-Variables
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

@@ 05-Application-Lifecycle-Management/10.Secrets
### Introduction

A Secret holds sensitive data such as passwords, tokens and keys. It is similar to a ConfigMap, but values are base64-encoded and Kubernetes treats it more carefully (access controls, not printed in `describe`).

**Base64 is encoding, not encryption.** Anyone who can read the Secret can decode it.

### Create

```bash
kubectl create secret generic db-secret \
  --from-literal=DB_Host=mysql --from-literal=DB_User=root --from-literal=DB_Password=passwd
kubectl create secret generic db-secret --from-file=creds.txt
```

Declaratively (values must be base64):

```bash
echo -n 'passwd' | base64        # cGFzc3dk
echo -n 'cGFzc3dk' | base64 -d
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  DB_Password: cGFzc3dk
# or use stringData to avoid encoding:
stringData:
  DB_User: root
```

Use `-n` with `echo` or a newline is encoded.

### Types

| Type | Use |
|---|---|
| `Opaque` | Generic |
| `kubernetes.io/tls` | TLS certs (`tls.crt`, `tls.key`) |
| `kubernetes.io/dockerconfigjson` | Image registry credentials |
| `kubernetes.io/basic-auth`, `ssh-auth` | Credentials |
| `kubernetes.io/service-account-token` | Service account tokens |

### Inject into a Pod

```yaml
envFrom:
- secretRef:
    name: db-secret
```

```yaml
env:
- name: DB_Password
  valueFrom:
    secretKeyRef:
      name: db-secret
      key: DB_Password
```

```yaml
volumes:
- name: secret-vol
  secret:
    secretName: db-secret
containers:
- name: app
  volumeMounts:
  - name: secret-vol
    mountPath: /etc/secret
    readOnly: true
```

Each key becomes a file under the mount path. Volume-mounted secrets update automatically; env vars don't.

### View

```bash
kubectl get secret db-secret -o yaml
kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d
```

### Security practices

- Secrets are stored **unencrypted in ETCD** by default. Enable **encryption at rest** (`EncryptionConfiguration`, `--encryption-provider-config` on the API Server).
- Use RBAC to limit who can `get`/`list` secrets.
- Prefer volume mounts to env vars (env vars leak into logs, child processes).
- Consider external secret stores (Vault, cloud KMS).
- Don't commit secrets to Git.

### Encryption at rest outline

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: [secrets]
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64 32 byte key>
  - identity: {}
```

```bash
# API server flag
--encryption-provider-config=/etc/kubernetes/enc/enc.yaml
# re-encrypt existing
kubectl get secrets -A -o json | kubectl replace -f -
```

Verify with `etcdctl get /registry/secrets/default/db-secret` — an encrypted value starts with `k8s:enc:aescbc:v1:`.

### CKA exam tips

- `kubectl create secret generic` is fastest.
- Remember `echo -n` and `base64 -d`.

### Key takeaways

- Secrets are base64, not encrypted, unless you enable encryption at rest.

@@ 05-Application-Lifecycle-Management/11.Practice-Test-Secrets
### How to approach this lab

Create a Secret and wire it into a Pod, often a web app talking to a DB.

### Commands

```bash
kubectl get secrets
kubectl describe secret dashboard-token
kubectl create secret generic db-secret --from-literal=DB_Host=sql01 --from-literal=DB_User=root --from-literal=DB_Password=password123
kubectl get pod webapp-pod -o yaml > w.yaml
vi w.yaml    # add envFrom: - secretRef: name: db-secret
kubectl replace --force -f w.yaml
kubectl exec webapp-pod -- env | grep DB_
```

### Notes

- Decode a value: `kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d`.
- A Pod referencing a missing Secret shows `CreateContainerConfigError`.

@@ 05-Application-Lifecycle-Management/12.Multi-Containers-PODs
### Introduction

Sometimes two processes must work together and share lifecycle, network and storage: a web server and a log shipper, for example. A multi-container Pod places them in one Pod.

### What containers in a Pod share

- Network: same IP, they reach each other on `localhost`.
- Storage: volumes can be mounted into several containers.
- Lifecycle: created and deleted together, scheduled on the same node.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-with-logger
spec:
  containers:
  - name: web
    image: nginx
    volumeMounts:
    - name: logs
      mountPath: /var/log/nginx
  - name: log-agent
    image: busybox
    command: ["sh","-c","tail -F /logs/access.log"]
    volumeMounts:
    - name: logs
      mountPath: /logs
  volumes:
  - name: logs
    emptyDir: {}
```

### Commands

```bash
kubectl get pods                        # READY 2/2
kubectl logs web-with-logger -c log-agent
kubectl exec -it web-with-logger -c web -- sh
kubectl describe pod web-with-logger
```

### Considerations

- Different containers cannot listen on the same port.
- Resources are per container; the Pod's total request is the sum.
- If one container crashes, only it restarts (per `restartPolicy`).
- Don't pack unrelated apps in one Pod; they can't scale independently.

### Key takeaways

- Use multi-container Pods for tightly coupled helpers sharing network and storage.

@@ 05-Application-Lifecycle-Management/13-Practice-Test-Multi-Container-Pods
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

@@ 05-Application-Lifecycle-Management/14-Multi-Container-Pods-Design-Patterns
### Introduction

Three classic multi-container patterns describe what the extra container does.

### Sidecar

Extends or enhances the main container without changing it.

```
 ┌───────────── Pod ─────────────┐
 │ [web app] ──logs──► [log agent]│──► central store
 └────────────────────────────────┘
```

Examples: log shipping, config reloader, service mesh proxy (Envoy/Istio), certificate renewers.

Modern Kubernetes (1.29+) supports **native sidecars**: an init container with `restartPolicy: Always` that starts before the main containers and stays running.

### Adapter

Transforms the main container's output into a standard format.

```
 [app emits custom metrics] ──► [adapter converts] ──► Prometheus format
```

### Ambassador

Acts as a proxy between the app and the outside world.

```
 [app] ──localhost:6379──► [ambassador] ──► redis-dev / redis-prod
```

The app always connects to localhost; the ambassador decides where to route.

### Comparison

| Pattern | Direction | Example |
|---|---|---|
| Sidecar | Adds capability | Log shipper |
| Adapter | Standardises output | Metrics format converter |
| Ambassador | Proxies outbound | DB connection router |

### Key takeaways

- Same Pod mechanics; the pattern describes purpose.

@@ 05-Application-Lifecycle-Management/15.Init-Containers
### Introduction

Init containers run **before** the app containers and must finish successfully, one after another, before the main containers start. They're ideal for setup work.

### Use cases

- Wait for a service/database to be ready.
- Clone a repository or download files into a shared volume.
- Register the Pod with a remote service.
- Set permissions or run migrations.

### YAML

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: myapp-container
    image: busybox:1.28
    command: ['sh','-c','echo The app is running! && sleep 3600']
  initContainers:
  - name: init-myservice
    image: busybox
    command: ['sh','-c','until nslookup myservice; do echo waiting for myservice; sleep 2; done']
  - name: init-mydb
    image: busybox
    command: ['sh','-c','until nslookup mydb; do echo waiting for mydb; sleep 2; done']
```

### Behaviour

```
 init-1 ─► init-2 ─► (all ok) ─► app containers start
   fail ─► retried according to restartPolicy; Pod stuck in Init:N/M
```

Pod statuses: `Init:0/2`, `Init:Error`, `Init:CrashLoopBackOff`, then `PodInitializing`, `Running`.

### Debugging

```bash
kubectl get pod myapp-pod
kubectl describe pod myapp-pod
kubectl logs myapp-pod -c init-myservice
```

### Notes

- Init containers don't support readiness probes.
- They can have different images and permissions than the app.
- Resources: the effective request is the max of init containers or sum of app containers, whichever is larger.

### Key takeaways

- Sequential, run-to-completion, before app containers.

@@ 05-Application-Lifecycle-Management/16-Practice-Test-Init-Containers
### How to approach this lab

Read Pods with init containers and fix ones that are stuck.

### Commands

```bash
kubectl get pods                         # Init:0/1 or Init:Error
kubectl describe pod blue                # init container section
kubectl logs red -c init-myservice
kubectl get pod orange -o yaml > o.yaml
vi o.yaml                                # fix typo in command (e.g. sleeeep)
kubectl replace --force -f o.yaml
```

### Typical findings

- The init command has a typo, so the Pod is in `Init:Error`/`CrashLoopBackOff`.
- An init container sleeps for N seconds, so the Pod stays `Init:0/1` until it finishes.
- Init container is waiting for a Service that doesn't exist yet; create the Service.

@@ 05-Application-Lifecycle-Management/17.Self-Healing-Applications
### Introduction

Kubernetes keeps applications running through restarts and replacements. Several mechanisms contribute.

### Layers of self healing

| Layer | What heals | Mechanism |
|---|---|---|
| Container | A crashed container | kubelet restarts it per `restartPolicy` |
| Pod | A deleted/failed Pod | ReplicaSet/Deployment recreates it |
| Node | A dead node | Pods rescheduled by controllers |
| Application | A hung but running process | **Probes** |

### Probes

```yaml
containers:
- name: app
  image: nginx
  livenessProbe:
    httpGet:
      path: /healthz
      port: 80
    initialDelaySeconds: 10
    periodSeconds: 5
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /ready
      port: 80
    periodSeconds: 5
  startupProbe:
    httpGet:
      path: /healthz
      port: 80
    failureThreshold: 30
    periodSeconds: 10
```

| Probe | If it fails |
|---|---|
| **liveness** | Container is **restarted** |
| **readiness** | Pod is removed from Service endpoints (not restarted) |
| **startup** | Gives slow apps time; liveness/readiness paused until it passes |

Probe types: `httpGet`, `tcpSocket`, `exec` (command, exit 0 = success), `grpc`.

### Restart policy

`Always` (default), `OnFailure`, `Never`. Restarts use exponential back-off (10s, 20s, 40s ... up to 5 minutes) shown as `CrashLoopBackOff`.

### Seeing it work

```bash
kubectl get pod -w                        # RESTARTS column increases
kubectl describe pod app | grep -A5 -i liveness
kubectl describe pod app                  # events: Liveness probe failed
```

### Pitfalls

- A liveness probe that depends on another service can cause restart storms.
- Readiness probe too strict: Pod never receives traffic (`0/1 READY`).
- `initialDelaySeconds` too small for slow apps; use a startup probe.

### CKA exam tips

- Know YAML for liveness and readiness; copy from docs.
- READY 0/1 with Running status = readiness probe failing.

### Key takeaways

- Restarts, controllers and probes together keep apps alive and traffic safe.
