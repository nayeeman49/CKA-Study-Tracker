@@ 03-Scheduling/02-Manual-Scheduling
### Introduction

Normally the scheduler picks a node for every Pod. Sometimes you need to place a Pod yourself, for example when the scheduler is broken, or when you want a Pod on one specific node. Manual scheduling means setting the node yourself.

### How the scheduler marks a Pod

Every Pod has a field `spec.nodeName`. When it's empty, the Pod is unscheduled and the scheduler picks it up. The scheduler's only job is to fill that field by creating a **Binding** object.

```
 Pod (nodeName empty) ──► scheduler ──► Binding ──► nodeName = node01
```

### Option 1: set nodeName at creation

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  nodeName: node01        # skip the scheduler
  containers:
  - name: nginx
    image: nginx
```

This is only possible **at creation time**. Once a Pod exists, `nodeName` cannot be changed, and the Pod will be Pending forever if no scheduler is running and `nodeName` is empty.

### Option 2: Binding object (for an existing Pending Pod)

Send a POST to the Pod's binding sub-resource:

```yaml
apiVersion: v1
kind: Binding
metadata:
  name: nginx
target:
  apiVersion: v1
  kind: Node
  name: node02
```

```bash
curl --header "Content-Type: application/json" --request POST \
  --data '{"apiVersion":"v1","kind":"Binding","metadata":{"name":"nginx"},"target":{"apiVersion":"v1","kind":"Node","name":"node02"}}' \
  http://$SERVER/api/v1/namespaces/default/pods/nginx/binding/
```

### Option 3: recreate the Pod

The exam-friendly method: export the Pod, add `nodeName`, force replace.

```bash
kubectl get pod nginx -o yaml > pod.yaml
vi pod.yaml                         # add spec.nodeName
kubectl replace --force -f pod.yaml
```

### What manual scheduling skips

Setting `nodeName` bypasses **all** scheduler logic: taints, affinity, resource checks. If the node is full or tainted, the kubelet may reject or evict the Pod. Control-plane nodes can be targeted this way even when tainted.

### Troubleshooting

- Pod stays `Pending` and `describe` shows no events: the scheduler isn't running. Either fix it or set `nodeName`.
- Wrong node name (typo): Pod sits Pending / fails to start. Names must match `kubectl get nodes`.

### CKA exam tips

- If asked to run a Pod when the scheduler is down, use `nodeName`.
- `kubectl replace --force` deletes and recreates in one step.

### Key takeaways

- The scheduler sets `nodeName`; you can do it yourself.
- `nodeName` can only be set when creating the Pod (or via Binding).

@@ 03-Scheduling/03-Practice-Test-Manual-Scheduling
### How to approach this lab

The scenario: a Pod is stuck in Pending because the scheduler is down or missing, and you must get it running on a particular node.

### Steps

```bash
kubectl get pods                       # Pod is Pending
kubectl -n kube-system get pods        # scheduler missing or crashing?
kubectl describe pod nginx             # no events = no scheduler
kubectl get nodes                      # pick a node name
```

Set the node:

```bash
kubectl get pod nginx -o yaml > nginx.yaml
# add under spec:  nodeName: node01
kubectl replace --force -f nginx.yaml
kubectl get pods -o wide
```

Or from scratch:

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > nginx.yaml
vi nginx.yaml          # add nodeName: controlplane
kubectl apply -f nginx.yaml
```

### Tips

- The scheduler lives in `kube-system`; its manifest is `/etc/kubernetes/manifests/kube-scheduler.yaml`.
- If a Pod has `nodeName` it will start without the scheduler.

@@ 03-Scheduling/04-Labels-and-Selectors
### Introduction

Labels are key/value pairs attached to objects. Selectors filter objects by those labels. This pair is how Kubernetes groups things: ReplicaSets find their Pods, Services find their backends, NetworkPolicies pick targets, and the scheduler matches node labels.

```
 Pod A  app=web tier=front env=prod
 Pod B  app=web tier=front env=dev
 Pod C  app=db  tier=back  env=prod

 selector app=web            -> A, B
 selector env=prod           -> A, C
 selector app=web,env=prod   -> A
```

### Defining labels

```yaml
metadata:
  name: web
  labels:
    app: web
    tier: front
    env: prod
```

```bash
kubectl run web --image=nginx --labels="app=web,tier=front"
kubectl label pod web env=prod              # add
kubectl label pod web env=dev --overwrite   # change
kubectl label pod web env-                  # remove
kubectl label node node01 disktype=ssd      # nodes too
```

### Selecting

```bash
kubectl get pods --show-labels
kubectl get pods -l app=web
kubectl get pods -l 'app=web,env=prod'      # AND
kubectl get pods -l 'env in (prod,dev)'
kubectl get pods -l 'env!=prod'
kubectl get pods -l '!env'                  # no env label
kubectl get all -l app=web
```

### Equality vs set-based selectors

| Style | Syntax | Used by |
|---|---|---|
| Equality | `app=web`, `app!=web` | `kubectl -l`, Services (`selector:`) |
| Set-based | `env in (a,b)`, `notin`, `exists` | `matchExpressions` in Deployments/RS/Jobs |

```yaml
selector:
  matchLabels:
    app: web
  matchExpressions:
  - key: env
    operator: In
    values: [prod, dev]
```

### Where labels connect objects

```yaml
# Deployment: selector must match template labels
spec:
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}

# Service: selector picks Pods
spec:
  selector: {app: web}
```

### Labels vs annotations

Labels are for selecting and grouping. **Annotations** hold non-identifying info (build number, contact, tool settings) and can't be selected on.

```bash
kubectl annotate pod web owner="team-a"
```

### Troubleshooting

- Service has no endpoints: Pod labels don't match the selector.
- ReplicaSet creating too many Pods: another Pod carries the same label.
- Label values must be 63 characters or fewer, alphanumeric, `-`, `_`, `.`.

### CKA exam tips

- `--show-labels` and `-l` are used in nearly every troubleshooting question.
- `kubectl get pods -l a=b --no-headers | wc -l` counts quickly.

### Key takeaways

- Labels attach metadata, selectors choose by it.
- Equality selectors for kubectl/Services; set-based for workload selectors.

@@ 03-Scheduling/05-Practice-Test-Labels-and-Selectors
### How to approach this lab

Typical tasks are counting and selecting resources by label.

### Commands

```bash
kubectl get pods --show-labels
kubectl get pods -l env=dev
kubectl get pods -l env=dev --no-headers | wc -l
kubectl get all -l env=prod,bu=finance,tier=frontend
kubectl get pods -l env=prod --show-labels
kubectl label pod web tier=front
kubectl get nodes --show-labels
```

### Tricks

- Multiple labels with commas are AND.
- To get Pods across all namespaces: add `-A`.
- A ReplicaSet YAML issue: the selector matchLabels must equal the template label. Compare with `kubectl get rs -o yaml`.
- `kubectl get all --selector env=prod,bu=finance,tier=frontend` selects every object type with those labels, handy for counting Pods, RS, Deployments, Services together.

@@ 03-Scheduling/06-Taints-and-Tolerations
### Introduction

Taints and tolerations control which Pods may run on which nodes. A **taint** on a node repels Pods. A **toleration** on a Pod lets it ignore a taint. Think of a bug spray (taint) on a person (node) and bugs (Pods) that are resistant (tolerant).

Important: tolerations *allow* a Pod on a tainted node, but do not *attract* it there. For attraction use node affinity (next lessons).

### Taint a node

```bash
kubectl taint nodes node01 app=blue:NoSchedule
kubectl taint nodes node01 app=blue:NoSchedule-     # remove (trailing -)
kubectl describe node node01 | grep -i taint
```

Format: `key=value:effect`.

### Effects

| Effect | Behaviour |
|---|---|
| `NoSchedule` | New Pods without a toleration won't be scheduled here. Existing Pods stay. |
| `PreferNoSchedule` | Soft version: scheduler tries to avoid, but may use it. |
| `NoExecute` | New Pods won't schedule **and existing Pods without toleration are evicted**. |

### Tolerate in a Pod

```yaml
spec:
  containers:
  - name: nginx
    image: nginx
  tolerations:
  - key: "app"
    operator: "Equal"
    value: "blue"
    effect: "NoSchedule"
```

Exists operator (any value):

```yaml
tolerations:
- key: "app"
  operator: "Exists"
  effect: "NoSchedule"
```

For `NoExecute`, `tolerationSeconds` says how long the Pod may stay after the taint appears.

### Example scenario

```
node01: taint app=blue:NoSchedule

Pod A (no toleration)           -> node02 or node03
Pod B (tolerates app=blue)      -> any node, including node01
```

### The control plane taint

kubeadm taints control plane nodes so workloads don't run there:

```bash
kubectl describe node controlplane | grep Taint
# node-role.kubernetes.io/control-plane:NoSchedule
```

Other built-in taints are added automatically: `node.kubernetes.io/not-ready`, `unreachable`, `disk-pressure`, `memory-pressure`, `unschedulable`.

### Troubleshooting

- Pod Pending with `node(s) had untolerated taint {key: value}`: add a toleration or remove the taint.
- Pods unexpectedly evicted: `NoExecute` taint added.
- Typos: values in quotes in YAML, `effect` must match exactly.

### CKA exam tips

- `kubectl taint` syntax is the most tested bit. Remember the `-` to remove.
- Tolerations are in the **Pod** spec at the same level as `containers`.
- A toleration doesn't force placement.

### Key takeaways

- Taint = node repels, toleration = Pod tolerates.
- Three effects; `NoExecute` evicts.

@@ 03-Scheduling/07-Practice-Test-Taints-and-Tolerations
### How to approach this lab

Tasks: check taints, add a taint, create a Pod that tolerates it, remove a taint.

### Commands

```bash
kubectl get nodes
kubectl describe node node01 | grep -i taint
kubectl taint nodes node01 spray=mortein:NoSchedule
kubectl run mosquito --image=nginx            # will be Pending: no toleration
kubectl run bee --image=nginx --dry-run=client -o yaml > bee.yaml
# add tolerations under spec:
#   tolerations:
#   - key: spray
#     value: mortein
#     effect: NoSchedule
#     operator: Equal
kubectl apply -f bee.yaml
kubectl get pods -o wide
kubectl taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-
```

### Understanding results

- A Pod without the toleration stays `Pending` and `describe` says `1 node(s) had untolerated taint`.
- The tolerant Pod can land on the tainted node; not guaranteed unless it's the only option.
- Removing the control-plane taint lets a Pending Pod schedule there.

### Tip

Check `kubectl get pods -o wide` to see which node each Pod uses.

@@ 03-Scheduling/08-Node-Selectors
### Introduction

`nodeSelector` is the simplest way to say "run this Pod on nodes with this label". It is a plain key/value match.

### Steps

1. Label the node.
2. Add `nodeSelector` to the Pod.

```bash
kubectl label nodes node01 size=Large
kubectl get nodes --show-labels
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  containers:
  - name: processor
    image: busybox
    command: ["sleep","3600"]
  nodeSelector:
    size: Large
```

The scheduler only considers nodes with `size=Large`. If none match, the Pod stays Pending (`didn't match Pod's node affinity/selector`).

### Limits

- Only exact matches, only AND of several labels.
- No `OR`, `NOT`, `In`, or "prefer". For these use **Node Affinity** (next lesson).

### Built-in node labels

Nodes already carry labels such as `kubernetes.io/hostname`, `kubernetes.io/os`, `kubernetes.io/arch`, `topology.kubernetes.io/zone`, `node-role.kubernetes.io/control-plane`.

### CKA exam tips

- If a node is not labelled, the Pod won't schedule; label first.
- `nodeSelector` is in the Pod spec, same level as containers.

### Key takeaways

- Label the node, add `nodeSelector`; simple but inflexible.

@@ 03-Scheduling/09-Node-Affinity
### Introduction

Node affinity is a more expressive replacement for `nodeSelector`. It supports operators (`In`, `NotIn`, `Exists`, ...) and "preferred" rules that are soft requirements.

### Types

| Type | Meaning |
|---|---|
| `requiredDuringSchedulingIgnoredDuringExecution` | **Hard** rule. Must match to schedule. |
| `preferredDuringSchedulingIgnoredDuringExecution` | **Soft** rule with weight. Scheduler tries, but may fall back. |

"IgnoredDuringExecution" means that changing labels later does not evict running Pods. (A `requiredDuringExecution` type was planned but not available.)

### Example: require Large or Medium

```yaml
spec:
  containers:
  - name: processor
    image: nginx
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: size
            operator: In
            values:
            - Large
            - Medium
```

### Preferred example

```yaml
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 80
      preference:
        matchExpressions:
        - key: disktype
          operator: In
          values: [ssd]
```

### Operators

`In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`.

```yaml
- key: size
  operator: NotIn
  values: [Small]
- key: gpu
  operator: Exists
```

### What happens when no node matches

| Rule | Result |
|---|---|
| required | Pod Pending |
| preferred | Scheduled on any node |

Multiple `matchExpressions` in one term are ANDed. Multiple `nodeSelectorTerms` are ORed.

### Troubleshooting

- Pod Pending: label missing/spelled wrong on nodes, `kubectl get nodes --show-labels`.
- Indentation: `affinity` belongs under `spec`.

### CKA exam tips

- Copy the structure from the docs (`kubectl explain pod.spec.affinity.nodeAffinity` helps).
- `Exists` doesn't need `values`.

### Key takeaways

- Affinity = nodeSelector with operators and soft rules.
- Required = hard, preferred = soft.

@@ 03-Scheduling/10-Practice-Test-Node-Affinity
### How to approach this lab

Tasks combine labels and affinity in Deployments.

### Commands

```bash
kubectl get nodes --show-labels
kubectl label node node01 color=blue
kubectl create deployment blue --image=nginx --replicas=3 --dry-run=client -o yaml > blue.yaml
vi blue.yaml    # add affinity under spec.template.spec
kubectl apply -f blue.yaml
kubectl get pods -o wide
```

Affinity inside a Deployment goes in the **Pod template**:

```yaml
spec:
  template:
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: color
                operator: In
                values: [blue]
```

For "run on the control plane" tasks use the label `node-role.kubernetes.io/control-plane` with `Exists`, and remember the control plane taint requires a toleration as well.

### Tips

- Check nodes carry the label before you apply.
- `kubectl get pods -o wide` confirms placement.

@@ 03-Scheduling/11.Taints-and-Tolerations-vs-Node-Affinity
### Introduction

Taints and tolerations only repel. Node affinity only attracts. To dedicate nodes to certain Pods, so those Pods go only there and nothing else goes there, use both.

### Comparison

| | Taints + tolerations | Node affinity |
|---|---|---|
| Set on | Node (taint) + Pod (toleration) | Pod (rule) + Node (label) |
| Effect | Keeps unwanted Pods **off** a node | Draws Pods **to** a node |
| Guarantees Pod lands there? | No | Yes (required) |
| Guarantees others stay away? | Yes (NoSchedule) | No |

### The combined pattern

Goal: nodes Blue, Red and Green are for the blue, red and green Pods only; other Pods go to the remaining nodes.

```
 Taints only            Affinity only           Both
 blue Pod can go to     blue Pod only goes to   blue Pod only on blue node,
 any node, others       blue node, but other    others can't use it either
 can't use blue         Pods may also land
```

Steps:

1. Taint each node: `kubectl taint nodes blue color=blue:NoSchedule`.
2. Label each node: `kubectl label nodes blue color=blue`.
3. In the Pod add the toleration (to be allowed) **and** node affinity or nodeSelector (to be drawn).

```yaml
spec:
  tolerations:
  - key: color
    operator: Equal
    value: blue
    effect: NoSchedule
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: color
            operator: In
            values: [blue]
```

### CKA exam tips

- Read the question: "only on" = affinity or nodeSelector, "no other Pod may run there" = taint.
- If a Pod with a toleration still isn't on the node, you probably forgot the affinity.

### Key takeaways

- Taints keep others out, affinity pulls yours in; dedicated nodes need both.

@@ 03-Scheduling/12-Resource-Limits
### Introduction

The scheduler uses resource **requests** to decide where a Pod fits. The kubelet and kernel enforce **limits** while the Pod runs. Setting them well prevents one Pod from starving others.

### Requests vs limits

| | Request | Limit |
|---|---|---|
| Meaning | Guaranteed minimum | Hard maximum |
| Used by | Scheduler (fits on node?) | Kubelet/kernel (cgroups) |
| CPU over limit | Throttled | Throttled |
| Memory over limit | N/A | Container is **OOMKilled** |

```yaml
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:
        cpu: "500m"
        memory: "256Mi"
      limits:
        cpu: "1"
        memory: "512Mi"
```

### Units

- CPU: `1` = 1 vCPU/core; `100m` = 0.1 CPU (milli). Minimum `1m`.
- Memory: `256Mi`, `1Gi` (binary) or `256M`, `1G` (decimal). Beware: `m` means milli, `Mi` is mebibytes.

### Behaviours

```
CPU    Request 1, limit 3 :  can burst to 3 if available, throttled above
Memory Pod exceeds limit  :  OOMKilled (reason in describe pod)
Memory exceeding node     :  eviction of Pods using more than requested
```

If a Pod's request is larger than any node's allocatable resources, it stays Pending with `Insufficient cpu/memory`.

### Defaults: LimitRange

A LimitRange sets default and max/min per namespace, so Pods without resources get defaults:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: cpu-limit-range
spec:
  limits:
  - default:
      cpu: 500m
    defaultRequest:
      cpu: 500m
    max:
      cpu: "1"
    min:
      cpu: 100m
    type: Container
```

### ResourceQuota

Caps the total for a namespace (see Namespaces lesson):

```yaml
spec:
  hard:
    requests.cpu: "4"
    limits.cpu: "10"
    requests.memory: 4Gi
    limits.memory: 10Gi
```

### QoS classes

| Class | Condition | Eviction order |
|---|---|---|
| Guaranteed | request = limit for all resources | last |
| Burstable | some request/limit | middle |
| BestEffort | none | first |

```bash
kubectl describe pod x | grep QoS
kubectl top pod x          # needs metrics-server
```

### Troubleshooting

- `OOMKilled` exit code 137: raise the memory limit or fix the leak.
- Pending with `Insufficient`: lower requests or add nodes.
- CPU throttling causing slowness: raise or remove the CPU limit.

### CKA exam tips

- `kubectl describe node` shows allocated resources and what remains.
- Resource fields can't be changed on a running Pod; delete and recreate.

### Key takeaways

- Requests schedule, limits enforce.
- Memory limit breach kills the container; CPU is throttled.

@@ 03-Scheduling/13-Practice-Test-Resource-Limits
### How to approach this lab

Tasks: read the resources of a Pod, find why a Pod is OOMKilled, and edit the limit.

### Commands

```bash
kubectl describe pod elephant           # State, Last State: Terminated, Reason: OOMKilled
kubectl get pod elephant -o yaml | grep -A6 resources
kubectl get pod elephant -o yaml > elephant.yaml
vi elephant.yaml                         # raise limits.memory
kubectl replace --force -f elephant.yaml
kubectl describe node | grep -A8 "Allocated resources"
```

### Pointers

- Exit code **137** and reason `OOMKilled` mean the memory limit was too low.
- Resources are immutable on existing Pods (in older versions), so replace.
- `kubectl describe` also shows `Limits` and `Requests` per container.
- A LimitRange applies **at creation**; check `kubectl get limitrange -n ns`.

@@ 03-Scheduling/14-DaemonSets
### Introduction

A DaemonSet runs exactly one copy of a Pod on every node (or a chosen subset). When a node is added a Pod appears on it; when a node is removed that Pod is garbage collected.

### Use cases

- Monitoring agents (node-exporter, Datadog)
- Log collectors (Fluentd, Filebeat)
- Networking plugins (kube-proxy, Calico, Weave)
- Storage daemons

```
 node01: [ds-pod]   node02: [ds-pod]   node03: [ds-pod]
```

### YAML

Same as ReplicaSet except `kind: DaemonSet` and there's no `replicas`:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: monitoring-agent
spec:
  selector:
    matchLabels:
      app: monitoring-agent
  template:
    metadata:
      labels:
        app: monitoring-agent
    spec:
      containers:
      - name: monitoring-agent
        image: monitoring-agent
```

### Create quickly

There is no `kubectl create daemonset`. Generate from a Deployment:

```bash
kubectl create deployment elasticsearch --image=k8s.gcr.io/fluentd-elasticsearch:1.20 \
  -n kube-system --dry-run=client -o yaml > ds.yaml
vi ds.yaml     # kind: DaemonSet, delete replicas and strategy: {}
kubectl apply -f ds.yaml
```

### How it schedules

Modern versions use the default scheduler with `nodeAffinity` on each node name. Earlier it set `nodeName`. Either way DaemonSet Pods automatically tolerate some taints (`not-ready`, `unreachable`, `disk-pressure`...). To run on tainted control plane nodes add a toleration.

```yaml
tolerations:
- operator: Exists
```

### Limit to some nodes

Use `nodeSelector` or `affinity` in the template.

### Commands

```bash
kubectl get ds -A
kubectl describe ds kube-proxy -n kube-system
kubectl rollout status ds/monitoring-agent
kubectl rollout undo ds/monitoring-agent
```

### Troubleshooting

- DESIRED < number of nodes: node taints not tolerated or selector excludes nodes.
- One node missing the Pod: check `kubectl get pods -o wide`, `describe`.

### CKA exam tips

- Remember the Deployment-to-DaemonSet YAML conversion trick.
- `kube-proxy` is a DaemonSet in `kube-system`.

### Key takeaways

- One Pod per node, automatic with node changes.

@@ 03-Scheduling/15-Practice-Test-DaemonSets
### How to approach this lab

Tasks: count DaemonSets, find which Pods they create, and create a new one.

### Commands

```bash
kubectl get ds -A
kubectl describe ds kube-flannel-ds -n kube-flannel
kubectl get pods -A -o wide | grep flannel
kubectl create deployment elasticsearch --image=registry.k8s.io/fluentd-elasticsearch:1.20 -n kube-system --dry-run=client -o yaml > fluentd.yaml
# edit: kind: DaemonSet, remove replicas: 1 and strategy: {}
kubectl apply -f fluentd.yaml
kubectl get ds -n kube-system
```

### Check list

- `DESIRED/CURRENT/READY` match the node count.
- Edit `selector.matchLabels` and `template.metadata.labels` consistently.
- Remember `-n kube-system` if asked.

@@ 03-Scheduling/16-Static-Pods
### Introduction

A static Pod is created and managed directly by the kubelet on a node, without the API Server, scheduler or controllers. The kubelet watches a folder and runs whatever Pod YAML is in it.

```
 /etc/kubernetes/manifests/web.yaml
            │ watched by
            ▼
        kubelet ──► container runtime ──► Pod
            │
            └──► creates a read-only "mirror Pod" in the API Server so kubectl can see it
```

### Configure the folder

In the kubelet config:

```yaml
# /var/lib/kubelet/config.yaml
staticPodPath: /etc/kubernetes/manifests
```

Older style: the flag `--pod-manifest-path`. Find it:

```bash
ps -aux | grep kubelet
grep -i staticPodPath /var/lib/kubelet/config.yaml
```

### Create / delete

```bash
# on the node whose kubelet reads the folder
kubectl run static-busybox --image=busybox --dry-run=client -o yaml --command -- sleep 1000 > /etc/kubernetes/manifests/static-busybox.yaml
# delete by removing the file
rm /etc/kubernetes/manifests/static-busybox.yaml
```

Deleting the mirror Pod with `kubectl delete pod` does nothing; the kubelet recreates it.

### Recognising static Pods

- The Pod name ends with the node name: `static-busybox-controlplane`.
- `kubectl get pod x -o yaml | grep -A5 ownerReferences` shows `kind: Node`.

### Why they matter

The control plane of kubeadm clusters is built from static Pods (apiserver, etcd, scheduler, controller-manager). That lets Kubernetes bootstrap itself without needing itself.

### Static Pods vs DaemonSets

| | Static Pod | DaemonSet |
|---|---|---|
| Created by | kubelet | DaemonSet controller via API Server |
| Scheduler involved | No | Yes |
| Used for | Control plane components | Cluster-wide agents |
| Managed with kubectl | Read only | Fully |

### Troubleshooting

- Pod doesn't appear: wrong folder, YAML error (check kubelet logs `journalctl -u kubelet`).
- Pod name has node suffix, to find the node: `kubectl get pods -o wide`.
- To remove a static Pod find the node and its `staticPodPath` first.

### CKA exam tips

- SSH to the right node, find `staticPodPath`, put the YAML there.
- Control plane component changes happen by editing files in this folder.

### Key takeaways

- Static Pods are kubelet-owned; manage them via files.

@@ 03-Scheduling/17-Practice-Test-StaticPods
### How to approach this lab

Tasks: find static Pods, locate the manifest path, create/delete a static Pod, possibly on another node.

### Commands

```bash
kubectl get pods -A                        # names ending with node names
ps -ef | grep kubelet | grep config
grep staticPodPath /var/lib/kubelet/config.yaml
ls /etc/kubernetes/manifests
kubectl run static-busybox --image=busybox --command --dry-run=client -o yaml -- sleep 1000 > /etc/kubernetes/manifests/static-busybox.yaml
```

For a static Pod on another node:

```bash
kubectl get nodes -o wide                  # get the node's IP
ssh node01
grep staticPodPath /var/lib/kubelet/config.yaml
vi /etc/kubernetes/manifests/static-greenbox.yaml
exit
```

### Pointers

- How to know which node: `kubectl get pods -o wide`.
- Remove by deleting the file on that node.

@@ 03-Scheduling/18-Multiple-Schedulers
### Introduction

Kubernetes lets you run additional schedulers alongside the default one. A Pod chooses which scheduler to use with `schedulerName`. Useful for custom placement logic.

### Deploying a second scheduler

Option 1: run the binary with its own config:

```yaml
# my-scheduler-config.yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: my-scheduler
leaderElection:
  leaderElect: false
```

Option 2 (more common): run it as a Pod. Copy the default static Pod manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-scheduler
  namespace: kube-system
spec:
  containers:
  - name: kube-scheduler
    image: registry.k8s.io/kube-scheduler:v1.31.0
    command:
    - kube-scheduler
    - --config=/etc/kubernetes/my-scheduler-config.yaml
    volumeMounts:
    - name: config
      mountPath: /etc/kubernetes/my-scheduler-config.yaml
      readOnly: true
  volumes:
  - name: config
    hostPath:
      path: /etc/kubernetes/my-scheduler-config.yaml
```

### Leader election

With several control plane nodes, the default scheduler uses leader election so only one is active. For a custom one on the same lock, set `leaderElect: false` or use a different `resourceName`/`resourceNamespace`.

### Using it

```yaml
spec:
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx
```

If the named scheduler doesn't exist or isn't running, the Pod stays Pending.

### Verify

```bash
kubectl get events -o wide                  # SOURCE column shows my-scheduler
kubectl logs my-scheduler -n kube-system
```

### Troubleshooting

- Pod Pending with no events: that scheduler isn't running or `schedulerName` has a typo.
- Custom scheduler crashing: config path or RBAC (it needs the same permissions as the default scheduler).

### CKA exam tips

- Easiest approach is to copy `/etc/kubernetes/manifests/kube-scheduler.yaml`, rename, and change the config.
- `schedulerName` is in the **Pod** spec.

### Key takeaways

- Multiple schedulers coexist; Pods select with `schedulerName`.

@@ 03-Scheduling/19-Practice-Test-Multiple-Schedulers
### How to approach this lab

Tasks: inspect the default scheduler, deploy another, and use it for a Pod.

### Commands

```bash
kubectl -n kube-system get pods | grep scheduler
kubectl -n kube-system describe pod kube-scheduler-controlplane | grep Image
kubectl get events -o wide
kubectl logs my-scheduler -n kube-system
kubectl apply -f my-scheduler.yaml
kubectl get pods -n kube-system
```

Use the scheduler:

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > nginx.yaml
vi nginx.yaml          # add spec.schedulerName: my-scheduler
kubectl apply -f nginx.yaml
kubectl describe pod nginx      # Events: Scheduled by my-scheduler
```

### Tips

- Pod `Pending` forever: wrong `schedulerName` or scheduler Pod not Running.
- Give the new scheduler a unique `schedulerName` in its configuration.

@@ 03-Scheduling/20-Configuring-Kubernetes-Schedulers
### Introduction

The scheduler is a pipeline of plugins that you can enable, disable and weight through scheduler *profiles*. This lesson explains the internals so you can reason about scheduling behaviour.

### Scheduling cycle

```
 Scheduling Queue ─► Filter ─► Score ─► Bind
   (PreEnqueue,        (nodes     (rank     (assign
    QueueSort)          that fit)  nodes)    node)
```

#### Queue

Pods wait in a priority queue. **Priority Classes** decide the order: higher priority Pods go first.

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "critical workloads"
```

```yaml
spec:
  priorityClassName: high-priority
```

A high-priority Pod can **preempt** (evict) lower priority Pods when no node has room.

#### Filter plugins

Examples: `NodeResourcesFit`, `NodeName`, `NodeUnschedulable`, `TaintToleration`, `NodePorts`, `NodeAffinity`.

#### Score plugins

Examples: `NodeResourcesFit` (scoring strategies), `ImageLocality`, `TaintToleration`, `NodeAffinity`, `PodTopologySpread`.

#### Bind

`DefaultBinder` sets `nodeName`.

### Extension points

Plugins attach at points: `queueSort`, `preFilter`, `filter`, `postFilter`, `preScore`, `score`, `reserve`, `permit`, `preBind`, `bind`, `postBind`.

### Profiles: customising one scheduler

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: default-scheduler
- schedulerName: no-scoring-scheduler
  plugins:
    preScore:
      disabled:
      - name: '*'
    score:
      disabled:
      - name: '*'
```

One scheduler process can host several profiles, each acting as a separate `schedulerName`. This is the modern alternative to running separate binaries.

### Related features

- **Pod topology spread constraints** to spread Pods across zones/nodes.
- **Pod affinity / anti-affinity** to co-locate or separate Pods.
- **Pod priority and preemption**.

### Troubleshooting

- Pods unexpectedly evicted: a higher-priority Pod preempted them.
- Config file error: scheduler crashes; check logs.

### CKA exam tips

- Know PriorityClass and `priorityClassName`.
- Know that the default scheduler is a plugin pipeline and profiles configure it.

### Key takeaways

- Queue → filter → score → bind.
- Profiles and plugins customise the scheduler.
