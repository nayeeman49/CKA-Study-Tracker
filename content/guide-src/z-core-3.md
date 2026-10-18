@@ 02-Core-Concepts/17-Practice-Tests-Deployments
### How to approach this lab

Deployments sit on top of ReplicaSets, so most answers come from `kubectl get all` and `describe`.

### Commands

```bash
kubectl get deployments
kubectl get all
kubectl describe deployment <name>       # strategy, image, replicas, events
kubectl get rs
kubectl create deployment http-frontend --image=httpd:2.4-alpine --replicas=3
kubectl create deployment x --image=nginx --dry-run=client -o yaml > d.yaml
kubectl scale deployment <name> --replicas=N
kubectl set image deployment/<name> <container>=<image>
kubectl delete deployment <name>
```

### Typical questions

| Question | How to find it |
|---|---|
| How many Deployments/ReplicaSets/Pods? | `kubectl get all` |
| Image used by a Deployment's Pods? | `kubectl describe deployment x \| grep Image` |
| Why is the Deployment not READY? | Check the Pod events; usually a wrong image tag |
| Create a Deployment with N replicas | `kubectl create deployment NAME --image=IMG --replicas=N` |
| Delete a Pod, what happens? | The ReplicaSet recreates it |

### Fixing a Deployment with a wrong YAML

Common mistakes in provided files: `kind: Deployment` written as `Deployment` in lowercase, `apiVersion: v1` instead of `apps/v1`, missing `selector`, template labels not matching selector.

```bash
kubectl apply -f deployment-definition-1.yaml
kubectl explain deployment.spec.selector
```

### Tips

- Pods created by a Deployment have names with two hash segments.
- To change an image in the Deployment use `kubectl set image` or `kubectl edit deployment`; both cause a rolling update.
- Always look at `kubectl rollout status` if updates seem slow.

@@ 02-Core-Concepts/18-Namespaces
### Introduction

Namespaces divide one physical cluster into multiple virtual clusters. They give you separate scopes for names, access control, and resource limits. A house with rooms: each team has its own room but shares the building.

### Default namespaces

| Namespace | Purpose |
|---|---|
| `default` | Where objects go if you don't say otherwise |
| `kube-system` | Kubernetes system components (API server, DNS, proxy...) |
| `kube-public` | Readable by everyone, mostly cluster info |
| `kube-node-lease` | Node heartbeat Lease objects |

### Why use them

- **Isolation**: dev, test, prod in the same cluster without name collisions.
- **Resource control**: a `ResourceQuota` limits CPU/memory/object counts per namespace.
- **Access control**: RBAC Roles and RoleBindings are namespaced.
- **Organisation** by team or application.

Not everything is namespaced. Nodes, PersistentVolumes, Namespaces, ClusterRoles, StorageClasses are cluster-wide. `kubectl api-resources --namespaced=false` lists them.

### Creating

```bash
kubectl create namespace dev
kubectl create ns dev --dry-run=client -o yaml
```

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev
```

### Using a namespace

```bash
kubectl get pods -n dev
kubectl get pods --namespace=dev
kubectl get pods -A                       # all namespaces
kubectl run nginx --image=nginx -n dev
kubectl apply -f pod.yaml -n dev
```

Or specify it in the YAML metadata (this wins over default):

```yaml
metadata:
  name: nginx
  namespace: dev
```

### Switching the default namespace of your context

```bash
kubectl config set-context --current --namespace=dev
kubectl config view --minify | grep namespace
```

This is a handy exam time-saver, but remember to switch back.

### DNS across namespaces

Services get a DNS name per namespace:

```
<service>.<namespace>.svc.cluster.local
```

Inside the same namespace you can use just `db-service`. From another namespace use `db-service.dev` or the full name.

### Resource quota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: dev
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 5Gi
    limits.cpu: "10"
    limits.memory: 10Gi
```

### Deleting

Deleting a namespace deletes **everything** inside it:

```bash
kubectl delete ns dev
```

### CKA exam tips

- Always check which namespace a question refers to; objects in the wrong namespace score nothing.
- If `kubectl get` returns nothing, you may be in the wrong namespace: try `-A`.
- Use `kubectl config set-context --current --namespace=` to avoid typing `-n` repeatedly.

### Key takeaways

- Namespaces scope names, RBAC and quotas.
- Four exist by default; `default` is where you land.
- Cross-namespace DNS uses `svc.namespace`.

@@ 02-Core-Concepts/19-Practice-Test-Namespaces
### How to approach this lab

Namespace questions are mostly "find" and "create in the right place".

### Commands

```bash
kubectl get namespaces
kubectl get ns --no-headers | wc -l
kubectl get pods -n research
kubectl get pods --all-namespaces
kubectl run redis --image=redis -n finance
kubectl get pods -A | grep blue
kubectl create ns dev-ns
kubectl describe svc db-service -n marketing
```

### Typical questions

| Question | Answer approach |
|---|---|
| How many namespaces? | `kubectl get ns` |
| How many Pods in namespace X? | `kubectl get pods -n X` |
| In which namespace is Pod Y? | `kubectl get pods -A \| grep Y` |
| Create a Pod in namespace X | `kubectl run NAME --image=IMG -n X` |
| What DNS name connects to a service in another namespace? | `service.namespace.svc.cluster.local` |

### The DNS question

A web app in the default namespace needs to reach `db-service` in `dev`:

```
db-service.dev.svc.cluster.local
```

`db-service` alone resolves only within the same namespace.

### Tips

- Use `-A` and `grep` to find things quickly.
- Use `kubectl config set-context --current --namespace=NS` to switch the default, then check with `kubectl config view --minify`.

@@ 02-Core-Concepts/20-Services
### Introduction

A Service gives a stable network endpoint to a dynamic group of Pods. Pods come and go and their IPs change; clients talk to the Service, and Kubernetes forwards to healthy Pods. Services also give load balancing and loose coupling between application tiers.

```
 frontend Pods ──► backend Service ──► backend Pods
                  (stable IP + DNS)     (changing IPs)
```

### Service types

| Type | Reachable from | Typical use |
|---|---|---|
| `ClusterIP` (default) | Inside the cluster only | Internal communication between tiers |
| `NodePort` | Outside, via `NodeIP:NodePort` | Quick external access, labs |
| `LoadBalancer` | Outside, via a cloud load balancer | Production external access on cloud |
| `ExternalName` | Inside, resolves to an external DNS name | Alias to outside services |

Types build on each other: NodePort includes a ClusterIP; LoadBalancer includes a NodePort.

### NodePort in detail

```
 browser ──► NodeIP:30008 ──► Service port 80 ──► Pod targetPort 80
```

Three ports are involved:

| Field | Meaning |
|---|---|
| `targetPort` | Port on the Pod where the app listens |
| `port` | Port of the Service itself (inside the cluster) |
| `nodePort` | Port opened on every node, range **30000–32767** |

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  type: NodePort
  selector:
    app: web          # Pods with this label are backends
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30008
```

Only `port` is mandatory; `targetPort` defaults to `port`; `nodePort` is auto-assigned if omitted.

### How the Service finds Pods

Through the **selector** matched against Pod labels. Kubernetes keeps an Endpoints / EndpointSlice object listing the matching ready Pod IPs.

```bash
kubectl get endpoints web-service
kubectl get pods --show-labels
```

If there are multiple matching Pods across nodes, the Service load balances (random). The NodePort is opened on **every** node, even those not running the Pod.

### Commands

```bash
kubectl apply -f service.yaml
kubectl get svc
kubectl describe svc web-service
kubectl expose pod web --port=80 --target-port=80 --name=web-service
kubectl expose deployment web --port=80 --type=NodePort
curl http://<node-ip>:30008
```

### Troubleshooting

- `Endpoints: <none>`: selector doesn't match any Pod labels, or Pods aren't ready.
- Cannot reach NodePort: firewall or security group; check the node IP.
- Wrong `targetPort`: connection refused.

### CKA exam tips

- Memorise the port range 30000–32767.
- `kubectl expose` creates the Service and the selector for you.
- Always check endpoints when a Service doesn't work.

### Key takeaways

- Services provide stable access and load balancing.
- Selector decides backends; three port fields.
- NodePort exposes on every node.

@@ 02-Core-Concepts/21-Services-ClusterIP
### Introduction

ClusterIP is the default Service type. It gives a virtual IP reachable only from inside the cluster. It is the glue between tiers of a multi-tier app: frontend → backend → database.

```
  frontend Pods
        │ calls backend-svc
        ▼
  ┌───────────────┐
  │ ClusterIP     │  10.96.14.5:80
  │ backend-svc   │
  └───────┬───────┘
          ▼
   backend Pods (3 replicas, changing IPs)
```

Each tier can scale and restart without breaking the others, because they only know the Service name.

### YAML

```yaml
apiVersion: v1
kind: Service
metadata:
  name: back-end
spec:
  type: ClusterIP        # optional, default
  selector:
    app: myapp
    type: back-end
  ports:
  - port: 80             # service port
    targetPort: 80       # container port
```

```bash
kubectl apply -f service.yaml
kubectl get svc back-end
kubectl describe svc back-end
kubectl expose deployment backend --name=back-end --port=80 --target-port=8080
```

### How clients reach it

By DNS name (CoreDNS) or environment variable:

```
back-end                           (same namespace)
back-end.default                   (from other namespace)
back-end.default.svc.cluster.local (fully qualified)
```

```bash
kubectl run tmp --image=busybox --rm -it --restart=Never -- nslookup back-end
kubectl run tmp --image=curlimages/curl --rm -it --restart=Never -- curl http://back-end
```

### Port mapping example

Service `port: 80` forwarding to `targetPort: 8080` lets clients use the standard port while the app listens elsewhere.

### Session affinity

By default each connection is balanced randomly. To pin a client to a Pod: `sessionAffinity: ClientIP`.

### Headless Services

`clusterIP: None` creates a Service with no virtual IP; DNS returns the Pod IPs directly. Used with StatefulSets.

### Troubleshooting

- Run `kubectl get endpoints back-end`: empty means labels don't match.
- DNS fails: check CoreDNS Pods in `kube-system`.
- Service has the right endpoints but connection fails: wrong `targetPort`, or app not listening.

### CKA exam tips

- Services don't answer ping; test with `curl`/`nc`.
- `kubectl expose` is fast but check selector and ports in the generated object.

### Key takeaways

- ClusterIP is internal only and the default type.
- Clients use DNS names; the IP never needs to be hard coded.

@@ 02-Core-Concepts/22-Practice-Test-Services
### How to approach this lab

Questions ask for Service details and for creating Services that expose Deployments.

### Commands

```bash
kubectl get svc
kubectl describe svc kubernetes
kubectl get endpoints <svc>
kubectl get svc -o wide                       # selector column
kubectl expose deployment simple-webapp-deployment --name=webapp-service --target-port=8080 --type=NodePort --port=8080
kubectl create service nodeport webapp --tcp=8080:8080 --node-port=30080
```

### Typical questions

| Question | How |
|---|---|
| How many Services? | `kubectl get svc` |
| What is the Type/targetPort/Endpoints of Service X? | `kubectl describe svc X` |
| How many labels does the selector have? | `describe svc` Selector line |
| Create a Service for a Deployment | `kubectl expose` |
| Set a specific nodePort | `expose` can't set it. Generate YAML with `--dry-run=client -o yaml`, add `nodePort`, apply |

### Setting nodePort

```bash
kubectl expose deployment web --port=8080 --target-port=8080 --type=NodePort --dry-run=client -o yaml > svc.yaml
vi svc.yaml       # add nodePort: 30080 under ports
kubectl apply -f svc.yaml
```

### Tips

- The built-in `kubernetes` Service in default points to the API Server.
- Check `kubectl get endpoints` to confirm Pods are selected.
- `expose` copies the selector from the target resource.

@@ 02-Core-Concepts/23-Imperative-Commands-with-kubectl
### Introduction

In the exam you have limited time, so you must create objects quickly. Kubernetes supports two styles:

| Style | Example | When |
|---|---|---|
| **Imperative** | `kubectl run`, `create`, `expose`, `scale`, `set image` | Fast one-off tasks |
| **Declarative** | `kubectl apply -f file.yaml` | Reusable, version-controlled, complex objects |

The best exam workflow mixes them: use imperative commands with `--dry-run=client -o yaml` to *generate* YAML, edit it, then apply.

### The two key flags

```bash
--dry-run=client      # don't create, just validate locally
-o yaml               # print the YAML
```

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
```

### Cheat sheet

#### Pods

```bash
kubectl run nginx --image=nginx
kubectl run nginx --image=nginx --port=80 --labels="app=web"
kubectl run busybox --image=busybox --command -- sleep 3600
kubectl run nginx --image=nginx --env="KEY=value"
```

#### Deployments

```bash
kubectl create deployment web --image=nginx --replicas=3
kubectl scale deployment web --replicas=5
kubectl set image deployment/web nginx=nginx:1.27
kubectl rollout undo deployment/web
```

#### Services

```bash
kubectl expose pod redis --port=6379 --name=redis-service
kubectl expose deployment web --port=80 --type=NodePort
kubectl create service clusterip my-svc --tcp=80:8080
```

#### Namespaces, ConfigMaps, Secrets

```bash
kubectl create ns dev
kubectl create configmap app --from-literal=color=blue
kubectl create secret generic db --from-literal=password=pass
```

#### Others you will use later

```bash
kubectl create job pi --image=perl -- perl -Mbignum=bpi -wle 'print bpi(100)'
kubectl create cronjob hello --image=busybox --schedule="*/1 * * * *" -- echo hi
kubectl create role / rolebinding / clusterrole / clusterrolebinding
kubectl create serviceaccount sa
```

### Updating existing objects

```bash
kubectl edit deployment web           # opens in vi
kubectl replace -f file.yaml
kubectl replace --force -f file.yaml  # delete and recreate
kubectl apply -f file.yaml
kubectl delete -f file.yaml
```

### Apply internals (why declarative matters)

`kubectl apply` stores the last applied configuration in an annotation `kubectl.kubernetes.io/last-applied-configuration`, and does a three-way merge between the live object, the file, and the last applied. Don't mix `create` and `apply` on the same object if you can avoid it.

### Useful exam shortcuts

```bash
alias k=kubectl
export do="--dry-run=client -o yaml"
k run x --image=nginx $do
source <(kubectl completion bash)
complete -F __start_kubectl k
```

(Often already set up in the exam environment; check first.)

### Imperative limits

You can't set many fields imperatively (volumes, resource limits, tolerations, probes, multi containers). Generate YAML, then edit it with `vi`.

### Key takeaways

- Imperative for speed, declarative for reproducibility.
- `--dry-run=client -o yaml` is the most useful exam trick.
- `kubectl explain` and `-h` help when you forget syntax.

@@ 02-Core-Concepts/24-Practice-Test-Imperative-Commands
### How to approach this lab

The lab drills the shortcuts from the previous lesson. Aim for speed and accuracy.

### Task patterns and answers

```bash
# Deploy a pod named nginx-pod using the nginx:alpine image
kubectl run nginx-pod --image=nginx:alpine

# Deploy a redis pod with label tier=db
kubectl run redis --image=redis:alpine --labels="tier=db"

# Create a service redis-service to expose the redis pod on port 6379
kubectl expose pod redis --port=6379 --name=redis-service

# Create a deployment webapp with image kodekloud/webapp-color and 3 replicas
kubectl create deployment webapp --image=kodekloud/webapp-color --replicas=3

# Create a pod custom-nginx with port 8080 exposed
kubectl run custom-nginx --image=nginx --port=8080

# Create namespace dev-ns and a deployment redis-deploy in it
kubectl create ns dev-ns
kubectl create deployment redis-deploy --image=redis -n dev-ns --replicas=2

# Create a pod httpd with image httpd:alpine and expose it as a ClusterIP service on port 80
kubectl run httpd --image=httpd:alpine --port=80 --expose
```

### Verify everything

```bash
kubectl get pods --show-labels
kubectl get svc
kubectl get endpoints redis-service
kubectl get deploy
```

### Tips

- If the service created by `expose pod` shows no endpoints, check that the Pod has labels (a `kubectl run` Pod gets `run=<name>`).
- For fields not available imperatively, generate YAML and edit.
