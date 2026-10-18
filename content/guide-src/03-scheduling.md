@@ 03-Scheduling/02-Manual-Scheduling
### What it is
Every Pod has an optional `spec.nodeName`. The scheduler's whole job is to fill it in. If you set it yourself at creation time, the scheduler ignores the Pod and the kubelet on that node starts it directly.

### How to do it
1. Create the Pod with `nodeName`:
```yaml
spec:
  nodeName: node01
  containers:
  - name: nginx
    image: nginx
```
2. If the Pod already exists and is **Pending** (e.g. scheduler is down) you cannot edit `nodeName`. Either delete and recreate it, or send a **Binding** object to the API:
```yaml
apiVersion: v1
kind: Binding
metadata: {name: nginx}
target: {apiVersion: v1, kind: Node, name: node01}
```
posted as JSON to `/api/v1/namespaces/default/pods/nginx/binding/`. The easy exam route: `kubectl replace --force -f nginx.yaml` after adding `nodeName`.

### Verify
`kubectl get pod nginx -o wide` shows NODE = node01.

### Watch out
`nodeName` skips taints, resource checks and affinity. A typo in the node name leaves the Pod Pending forever.

@@ 03-Scheduling/03-Practice-Test-Manual-Scheduling
### How to work through this lab
1. Create the Pod from the supplied YAML: `kubectl create -f nginx.yaml`.
2. It is Pending: `kubectl get pods -n kube-system` shows **no kube-scheduler** pod.
3. Manually schedule: add `nodeName: node01` under `spec`, then recreate: `kubectl replace --force -f nginx.yaml`.
4. Verify: `kubectl get pod nginx -o wide`.
5. Second part: with the scheduler fixed or present, create another Pod normally and see which node it lands on.

### Tip
You cannot edit `nodeName` of an existing Pod with `kubectl edit`; the error saves a copy in `/tmp`, which you can `kubectl replace --force -f`.

@@ 03-Scheduling/04-Labels-and-Selectors
### What they are
**Labels** are key/value pairs on objects (`app=web, tier=frontend, env=prod`). **Selectors** pick objects by label. Services, ReplicaSets, Deployments, NetworkPolicies and scheduling all depend on them. **Annotations** are non-identifying metadata (build numbers, contact info) that selectors can't use.

### How to do it
```
kubectl get pods --show-labels
kubectl get pods -l app=web,env=prod             # AND
kubectl get pods -l 'env in (prod,dev)'          # set-based
kubectl get all -l env=prod --no-headers | wc -l
kubectl label pod web tier=frontend
kubectl label pod web tier-                      # remove a label
kubectl annotate pod web buildversion=1.34
```
In YAML: `metadata.labels` on the object; a Deployment's `spec.selector.matchLabels` must match `spec.template.metadata.labels`.

### Watch out
Changing a Pod's label so it no longer matches a ReplicaSet makes the set create a replacement and leaves the old Pod orphaned. A Service with a wrong selector has no endpoints. `selector` in Deployments is immutable after creation.

@@ 03-Scheduling/05-Practice-Test-Labels-and-Selectors
### How to work through this lab
1. **Count Pods with a label:** `kubectl get pods -l env=dev --no-headers | wc -l`.
2. **Pods in a specific bu/finance:** combine selectors: `kubectl get pods -l bu=finance,env=prod`.
3. **Everything in a group:** `kubectl get all -l env=prod` (Pods, Services, ReplicaSets).
4. **Identify the Pod with several labels:** `kubectl get pods -l env=prod,bu=finance,tier=frontend`.
5. **Fix a ReplicaSet YAML:** the template labels must contain the selector's labels; check `selector.matchLabels` against `template.metadata.labels` and apply.

### Verify
`--show-labels` shows the labels; the count printed by `wc -l` matches your expectation.

@@ 03-Scheduling/06-Taints-and-Tolerations
### What they are
A **taint** on a node repels Pods; a **toleration** on a Pod lets it ignore a matching taint. Tolerations *permit* scheduling, they don't attract: to force a Pod onto a node also use node affinity or nodeName.

### How to do it
1. Taint a node: `kubectl taint nodes node01 app=blue:NoSchedule`. Effects: `NoSchedule`, `PreferNoSchedule`, `NoExecute` (also evicts running Pods).
2. Add a toleration to the Pod (all four fields must match, quoted):
```yaml
spec:
  tolerations:
  - key: "app"
    operator: "Equal"
    value: "blue"
    effect: "NoSchedule"
```
3. Remove a taint: repeat the command with a trailing dash: `kubectl taint nodes node01 app=blue:NoSchedule-`.

### Verify
`kubectl describe node node01 | grep Taints` and `kubectl get pods -o wide`.

### Watch out
The control-plane node carries `node-role.kubernetes.io/control-plane:NoSchedule` by default. `NoExecute` taints evict existing Pods that don't tolerate them. `operator: Exists` ignores the value.

@@ 03-Scheduling/07-Practice-Test-Taints-and-Tolerations
### How to work through this lab
1. **Check nodes for taints:** `kubectl describe node node01 | grep -i taint`.
2. **Create a Pod and see where it lands:** `kubectl run mosquito --image=nginx`. It stays Pending if all nodes are tainted.
3. **Taint node01:** `kubectl taint nodes node01 spray=mortein:NoSchedule`.
4. **Create a Pod with a toleration:** `kubectl run bee --image=nginx --dry-run=client -o yaml > bee.yaml`, add `tolerations` (key `spray`, operator `Equal`, value `mortein`, effect `NoSchedule`), then `kubectl apply -f bee.yaml`.
5. **Why did Pods land on controlplane?** Remove its taint: `kubectl taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-`.

### Verify
`kubectl get pods -o wide`: `bee` runs on node01, `mosquito` stays Pending.

@@ 03-Scheduling/08-Node-Selectors
### What it is
The simplest placement rule: label the node, then require that label on the Pod. It supports only equality (AND of several labels); for "or", "not", "exists" use node affinity.

### How to do it
```
kubectl label nodes node01 size=Large
kubectl get nodes --show-labels
```
```yaml
spec:
  nodeSelector:
    size: Large
  containers:
  - name: data-processor
    image: data-processor
```
### Verify
`kubectl get pod -o wide` shows the labelled node. If no node matches the Pod stays Pending with `didn't match Pod's node affinity/selector`.

### Watch out
Labels are case sensitive. The selector is a hard requirement (no preferred mode).

@@ 03-Scheduling/09-Node-Affinity
### What it is
A richer version of nodeSelector with operators (`In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`) and two strengths:
- `requiredDuringSchedulingIgnoredDuringExecution`: hard rule, Pod stays Pending if unmet.
- `preferredDuringSchedulingIgnoredDuringExecution`: soft, with a `weight` 1-100.
"IgnoredDuringExecution" means running Pods are not moved if labels change later.

### How to do it
```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: size
            operator: In
            values: [Large, Medium]
```
Preferred form: `preferredDuringSchedulingIgnoredDuringExecution: - weight: 1, preference: {matchExpressions: [...]}`.
Label first: `kubectl label node node01 size=Large`. Use `kubectl explain pod.spec.affinity.nodeAffinity` or copy from the docs.

### Verify
`kubectl get pod -o wide`; `kubectl describe pod` explains Pending Pods.

### Watch out
Multiple `nodeSelectorTerms` are ORed; expressions inside one term are ANDed. Deployments need the affinity under `spec.template.spec`.

@@ 03-Scheduling/10-Practice-Test-Node-Affinity
### How to work through this lab
1. **Show node labels:** `kubectl get nodes --show-labels`, `kubectl describe node node01 | grep -A5 Labels`.
2. **Label a node:** `kubectl label node node01 color=blue`.
3. **Create a Deployment on the blue node:** `kubectl create deployment blue --image=nginx --replicas=3 --dry-run=client -o yaml > blue.yaml`; add `nodeSelector` or affinity under `spec.template.spec`; `kubectl apply -f blue.yaml`.
4. **Use `Exists`:** for "run only on nodes that have label `node-role.kubernetes.io/control-plane`" use `operator: Exists` with no `values`.
5. Confirm placement: `kubectl get pods -o wide`.

### Watch out
Check `taints` too: the controlplane node may reject Pods even if affinity matches.

@@ 03-Scheduling/11.Taints-and-Tolerations-vs-Node-Affinity
### The decision
- **Taints/tolerations** keep unwanted Pods *away* from nodes. They do not pull your Pod in.
- **Node affinity/nodeSelector** pull your Pod *toward* nodes but don't stop other Pods landing there.
- To **dedicate** nodes to certain Pods you need both.

### How to do it (dedicate node01 to blue Pods)
1. `kubectl taint nodes node01 color=blue:NoSchedule` (others can't use it).
2. `kubectl label nodes node01 color=blue` (blue Pods are pulled to it).
3. On blue Pods add both: a toleration for `color=blue:NoSchedule` and `nodeAffinity`/`nodeSelector` for `color=blue`.

### Verify
Unlabelled Pods avoid node01 (`kubectl get pods -o wide`); blue Pods land on it.

### Watch out
Forgetting either half is the usual mistake: toleration only → Pod may still go elsewhere; affinity only → other Pods can still be placed on the node.

@@ 03-Scheduling/12-Resource-Limits
### What it is
- **requests**: what the scheduler reserves for the container; Pods are placed on nodes with enough *unrequested* capacity.
- **limits**: the cap enforced at runtime. Over the **CPU** limit → throttled. Over the **memory** limit → container is **OOMKilled** (exit 137).
CPU `500m` = half a core; memory `256Mi`/`1Gi`.

### How to do it
```yaml
resources:
  requests: {cpu: "250m", memory: "128Mi"}
  limits:   {cpu: "500m", memory: "256Mi"}
```
Namespace defaults and caps use a **LimitRange**; totals use a **ResourceQuota**:
```yaml
apiVersion: v1
kind: LimitRange
metadata: {name: cpu-mem-defaults}
spec:
  limits:
  - type: Container
    default: {cpu: 500m, memory: 512Mi}
    defaultRequest: {cpu: 250m, memory: 256Mi}
```
### Verify
`kubectl describe pod` (Requests/Limits, QoS class), `kubectl top pod`, `kubectl describe node` (Allocated resources). A Pod needing more than any node offers stays Pending with `Insufficient cpu/memory`.

### Watch out
Limits without requests make requests equal limits. LimitRange only applies to new Pods. QoS: `Guaranteed` (requests=limits), `Burstable`, `BestEffort` (first to be evicted).

@@ 03-Scheduling/13-Practice-Test-Resource-Limits
### How to work through this lab
1. **Why is the Pod crashing?** `kubectl describe pod elephant`: `Reason: OOMKilled`, exit code 137, and the memory limit shown (e.g. 10Mi).
2. **Raise the limit:** you can't edit resources of a running Pod. `kubectl get pod elephant -o yaml > e.yaml`, edit `limits.memory` (e.g. `20Mi`), then `kubectl replace --force -f e.yaml`.
3. **Check LimitRange/Quota in the namespace:** `kubectl get limitrange,resourcequota -n <ns>`.
4. **Verify:** `kubectl get pod elephant` Running; `kubectl describe pod` no OOMKilled.

### Tip
`kubectl replace --force` deletes and recreates the Pod in one step.

@@ 03-Scheduling/14-DaemonSets
### What it is
Runs **one copy of a Pod on every node** (or on matching nodes). New nodes get a Pod automatically; removed nodes' Pods are garbage-collected. Used for log shippers, monitoring agents, kube-proxy, CNI agents.

### How to do it
Generate from a Deployment and edit (there is no `create daemonset`):
```
kubectl create deployment monitor --image=busybox --dry-run=client -o yaml > ds.yaml
```
Change `kind: DaemonSet`, delete `replicas`, `strategy` and `status`, add a command if needed, then `kubectl apply -f ds.yaml`.
```
kubectl get ds -A
kubectl describe ds monitor
kubectl get pods -o wide        # one per node
```
### Watch out
The `selector` must match template labels. To run on tainted control-plane nodes add a toleration. To limit to some nodes use `nodeSelector`/affinity. DaemonSet Pods are scheduled by the default scheduler using node affinity (not `nodeName`) in current versions.

@@ 03-Scheduling/15-Practice-Test-DaemonSets
### How to work through this lab
1. **Find existing DaemonSets:** `kubectl get ds -A`; Pods per node: `kubectl get pods -n kube-system -o wide`.
2. **Which nodes run a given DaemonSet?** `kubectl describe ds kube-proxy -n kube-system`.
3. **Create one** (e.g. `elasticsearch` in kube-system with image `registry.k8s.io/fluentd-elasticsearch:1.20`): `kubectl create deployment elasticsearch --image=... -n kube-system --dry-run=client -o yaml > ds.yaml`; edit to `kind: DaemonSet`, remove `replicas`/`strategy`/`status`; `kubectl apply -f ds.yaml`.
4. Verify: DESIRED = CURRENT = READY in `kubectl get ds -n kube-system`.

@@ 03-Scheduling/16-Static-Pods
### What they are
Pods created and managed **directly by the kubelet** from manifest files on the node, with no API server involved (the API shows a read-only mirror Pod named `<name>-<nodename>`). This is how kubeadm runs the control plane, and why you can bring a cluster up without a working API server.

### How to do it
1. Find the manifest folder: `ps aux | grep kubelet` → `--config=/var/lib/kubelet/config.yaml` → `grep staticPodPath /var/lib/kubelet/config.yaml` (normally `/etc/kubernetes/manifests`).
2. Create a Pod YAML there:
```
kubectl run static-busybox --image=busybox --dry-run=client -o yaml --command -- sleep 1000 > /etc/kubernetes/manifests/static-busybox.yaml
```
3. The kubelet starts it within seconds.
4. To remove it delete the file; `kubectl delete pod` only removes the mirror, and the kubelet recreates it.

### Verify
`kubectl get pods -A` shows `static-busybox-<node>`; `crictl ps`.

### Watch out
Do the work **on the node that owns the manifest folder** (SSH to it). Static Pod names end with the node name. Edits to the file restart the Pod.

@@ 03-Scheduling/17-Practice-Test-StaticPods
### How to work through this lab
1. **Count static pods:** `kubectl get pods -A` and look for names ending in the node name (e.g. `-controlplane`).
2. **Where are they defined?** `grep staticPodPath /var/lib/kubelet/config.yaml` → `/etc/kubernetes/manifests`.
3. **Create one on controlplane:** `kubectl run static-busybox --image=busybox --command --dry-run=client -o yaml -- sleep 1000 > /etc/kubernetes/manifests/static-busybox.yaml`.
4. **Edit its image:** edit the file; the kubelet recreates the Pod.
5. **Delete it:** remove the file.
6. **Static Pod on another node:** `ssh node01`, find *that* kubelet's `staticPodPath` (check `ps aux | grep kubelet`, `/var/lib/kubelet/config.yaml`) and place the manifest there.

### Verify
`kubectl get pods`; for another node, `ssh node01 crictl ps`.

@@ 03-Scheduling/18-Multiple-Schedulers
### What it is
You can run extra schedulers next to the default one, and choose per Pod with `spec.schedulerName`. Pods that name a scheduler that isn't running stay Pending.

### How to do it (custom scheduler as a Pod)
1. Give it its own name via a `KubeSchedulerConfiguration`: profile `schedulerName: my-scheduler`, and `leaderElection` with a unique `resourceName` (or `leaderElect: false` for a single copy).
2. Deploy it as a Pod/Deployment in `kube-system` using the kube-scheduler image, `--config=/etc/kubernetes/my-scheduler-config.yaml` and the same `--kubeconfig` (`/etc/kubernetes/scheduler.conf`) mounted from the host. Copy `kube-scheduler.yaml` from the manifests folder and change the name, config and port.
3. Reference it in a Pod:
```yaml
spec:
  schedulerName: my-scheduler
  containers: [{name: nginx, image: nginx}]
```
### Verify
`kubectl get pods -n kube-system | grep my-scheduler`; `kubectl get events -o wide` shows `Scheduled` events whose source is `my-scheduler`; `kubectl logs my-scheduler -n kube-system`.

### Watch out
Needs RBAC (the default scheduler ClusterRoles are bound to `system:kube-scheduler`; a ServiceAccount needs the same bindings). Two schedulers using the same leader-election lease will fight.

@@ 03-Scheduling/19-Practice-Test-Multiple-Schedulers
### How to work through this lab
1. **Inspect the default scheduler:** `kubectl get pods -n kube-system | grep scheduler`, `kubectl describe pod kube-scheduler-controlplane -n kube-system` (image version, config).
2. **Deploy a second scheduler:** copy `/etc/kubernetes/manifests/kube-scheduler.yaml` to a new file, change `name`, add `--scheduler-name=my-scheduler` (or config file) and `--leader-elect=false`, a different `--secure-port`, then `kubectl create -f` (outside the manifests folder so it isn't static).
3. **Use it:** add `schedulerName: my-scheduler` to a Pod and `kubectl create -f`.
4. **Verify:** `kubectl get pod nginx -o wide` Running; `kubectl get events -o wide | grep my-scheduler`.

### Watch out
If the new scheduler Pod crashes check `kubectl logs`; port clashes and missing kubeconfig mounts are common.

@@ 03-Scheduling/20-Configuring-Kubernetes-Schedulers
### What it is
Modern scheduling is configurable through **scheduler profiles** in a `KubeSchedulerConfiguration`, built from a pipeline of extension points (queue sort → filter → score → bind), each implemented by plugins such as `NodeResourcesFit`, `NodeAffinity`, `TaintToleration`, `ImageLocality`, `PrioritySort`.

### How to configure
```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: default-scheduler
- schedulerName: no-scoring-scheduler
  plugins:
    score:
      disabled:
      - name: '*'
```
Run the scheduler with `--config=/path/file.yaml`. One scheduler process can serve several profiles, selected by `schedulerName` in each Pod.

### Related tools
**PriorityClass** (`value`, `preemptionPolicy`) controls queue order and preemption; **topologySpreadConstraints** spread Pods across zones/nodes.

### Watch out
This is mostly background for the exam; the tested skills are taints, affinity, nodeName, static pods, and fixing a broken scheduler manifest.
