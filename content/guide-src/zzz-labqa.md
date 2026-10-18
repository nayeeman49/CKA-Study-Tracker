@@ 03-Scheduling/13-Practice-Test-Resource-Limits

<details>
<summary><b>Q1.</b> A Pod named <code>rabbit</code> is stuck <code>Pending</code>. How do you find out how much CPU it requests, and why it cannot be scheduled?</summary>

```bash
kubectl describe pod rabbit
```
Look at `Requests:` under the container, then at `Events:`. A message such as `0/2 nodes are available: Insufficient cpu` means no node has that much unreserved CPU. Lower the request or free capacity; the scheduler compares requests with each node's allocatable resources, not actual usage.

</details>

<details>
<summary><b>Q2.</b> A Pod shows status <code>OOMKilled</code>. What does it mean and how do you find the memory limit?</summary>

The container used more memory than its limit and the kernel killed it. Read the limit and the last state:
```bash
kubectl describe pod elephant        # Last State: Terminated, Reason: OOMKilled
kubectl get pod elephant -o jsonpath='{.spec.containers[*].resources}'
```

</details>

<details>
<summary><b>Q3.</b> The <code>elephant</code> Pod has a 10Mi memory limit and keeps being OOMKilled. How do you raise it to 20Mi?</summary>

A running Pod's resources cannot be edited in place, so recreate it:
```bash
kubectl get pod elephant -o yaml > elephant.yaml
# edit resources.limits.memory: 20Mi
kubectl delete pod elephant
kubectl apply -f elephant.yaml
```
(`kubectl replace --force -f elephant.yaml` does the delete and create in one step.)

</details>

<details>
<summary><b>Q4.</b> What happens if a container exceeds its CPU limit, compared with its memory limit?</summary>

CPU is compressible: the container is throttled but keeps running. Memory is not: exceeding the limit gets the container OOMKilled and restarted.

</details>

<details>
<summary><b>Q5.</b> What is the difference between a request and a limit?</summary>

A **request** is what the scheduler reserves for the Pod when picking a node. A **limit** is the maximum the container may use at runtime. A Pod with no requests or limits is `BestEffort` and is the first to be evicted under pressure.

</details>

@@ 03-Scheduling/15-Practice-Test-DaemonSets

<details>
<summary><b>Q1.</b> How many DaemonSets exist in the cluster, across all namespaces?</summary>

```bash
kubectl get daemonsets -A
```
Count the rows. DaemonSets are namespaced, so `-A` matters.

</details>

<details>
<summary><b>Q2.</b> Which Pods does the DaemonSet <code>kube-proxy</code> run, and on how many nodes?</summary>

```bash
kubectl get ds kube-proxy -n kube-system
kubectl get pods -n kube-system -o wide | grep kube-proxy
```
`DESIRED` equals the number of schedulable nodes; the `-o wide` output shows one Pod per node.

</details>

<details>
<summary><b>Q3.</b> Create a DaemonSet named <code>elasticsearch</code> with image <code>registry.k8s.io/fluentd-elasticsearch:1.20</code> in <code>kube-system</code>. What is the quickest way?</summary>

There is no `kubectl create daemonset`, so generate a Deployment and edit it:
```bash
kubectl create deployment elasticsearch --image=registry.k8s.io/fluentd-elasticsearch:1.20 -n kube-system --dry-run=client -o yaml > ds.yaml
# change kind: Deployment to DaemonSet, delete replicas, strategy and status
kubectl apply -f ds.yaml
```

</details>

<details>
<summary><b>Q4.</b> A DaemonSet's Pods are not scheduled on the control-plane node. Why, and how do you fix it?</summary>

The control-plane node is tainted (`node-role.kubernetes.io/control-plane:NoSchedule`). Add a toleration to the DaemonSet's Pod template:
```yaml
tolerations:
- key: node-role.kubernetes.io/control-plane
  operator: Exists
  effect: NoSchedule
```

</details>

<details>
<summary><b>Q5.</b> How does a DaemonSet place one Pod per node without the scheduler picking the node?</summary>

The DaemonSet controller creates a Pod for each eligible node and sets node affinity to that node, and the default scheduler binds it. New nodes get a Pod automatically; removed nodes lose theirs.

</details>

@@ 03-Scheduling/17-Practice-Test-StaticPods

<details>
<summary><b>Q1.</b> How many static Pods exist in the cluster?</summary>

Static Pods are mirrored into the API with the node name appended to their name (for example `etcd-controlplane`).
```bash
kubectl get pods -A -o wide
```
Pods whose names end with a node name, or whose `ownerReferences` kind is `Node`, are static.

</details>

<details>
<summary><b>Q2.</b> Which directory holds the static Pod manifests on a node?</summary>

Check the kubelet configuration for `staticPodPath`:
```bash
ps aux | grep kubelet                        # find --config=/var/lib/kubelet/config.yaml
grep staticPodPath /var/lib/kubelet/config.yaml
```
On a kubeadm cluster it is `/etc/kubernetes/manifests`.

</details>

<details>
<summary><b>Q3.</b> Create a static Pod named <code>static-busybox</code> with image <code>busybox</code> that sleeps for 1000 seconds.</summary>

```bash
kubectl run static-busybox --image=busybox --dry-run=client -o yaml --command -- sleep 1000 > /etc/kubernetes/manifests/static-busybox.yaml
```
The kubelet notices the file and starts the Pod. No `kubectl apply` is needed.

</details>

<details>
<summary><b>Q4.</b> How do you delete a static Pod?</summary>

`kubectl delete pod` only removes the mirror object and the kubelet recreates it. Delete or move the manifest file on that node:
```bash
rm /etc/kubernetes/manifests/static-busybox.yaml
```

</details>

<details>
<summary><b>Q5.</b> Why are the control-plane components static Pods in a kubeadm cluster?</summary>

The kubelet can run them before any API server exists. A broken component is repaired by editing its manifest in `/etc/kubernetes/manifests`.

</details>

@@ 03-Scheduling/19-Practice-Test-Multiple-Schedulers

<details>
<summary><b>Q1.</b> How do you see which scheduler places a Pod?</summary>

```bash
kubectl get pod <name> -o jsonpath='{.spec.schedulerName}'
kubectl get events -o wide | grep Scheduled
```
The `Scheduled` event names the component, for example `default-scheduler`.

</details>

<details>
<summary><b>Q2.</b> How is a second scheduler deployed so it runs alongside the default one?</summary>

As a Pod (often a static Pod or Deployment) running `kube-scheduler` with its own config, a distinct `schedulerName` profile and its own leader-election lock name:
```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: my-scheduler
leaderElection:
  leaderElect: false
```

</details>

<details>
<summary><b>Q3.</b> How do you make a Pod use the custom scheduler?</summary>

```yaml
spec:
  schedulerName: my-scheduler
```
If the scheduler is not running, the Pod stays `Pending`.

</details>

<details>
<summary><b>Q4.</b> A Pod using <code>my-scheduler</code> is <code>Pending</code>. How do you troubleshoot?</summary>

```bash
kubectl describe pod <name>                  # no Scheduled event
kubectl get pods -n kube-system | grep scheduler
kubectl logs -n kube-system my-scheduler
```
Typical causes: the scheduler Pod is not running, `schedulerName` does not match the profile, or RBAC for the scheduler is missing.

</details>

<details>
<summary><b>Q5.</b> Why must the second scheduler set a different leader-election name, or disable leader election?</summary>

Schedulers contend for a lock to avoid two instances scheduling the same Pods. Two different schedulers sharing one lock name would block each other.

</details>

@@ 04-Logging-and-Monitoring/06-Practice-Test-Managing-Application-Logs

<details>
<summary><b>Q1.</b> How do you read the logs of a Pod named <code>webapp</code>?</summary>

```bash
kubectl logs webapp
kubectl logs -f webapp                       # follow
kubectl logs webapp --tail=20 --since=10m
```

</details>

<details>
<summary><b>Q2.</b> A Pod has two containers. Why does <code>kubectl logs</code> fail and how do you fix it?</summary>

You must name the container:
```bash
kubectl logs webapp -c simple-webapp
kubectl logs webapp --all-containers
```

</details>

<details>
<summary><b>Q3.</b> A container keeps restarting. How do you read the logs of its previous run?</summary>

```bash
kubectl logs webapp --previous
```

</details>

<details>
<summary><b>Q4.</b> How do you search a Pod's logs for failed logins?</summary>

```bash
kubectl logs webapp | grep -i "failed"
```

</details>

<details>
<summary><b>Q5.</b> How do you see logs of a Deployment's Pods together?</summary>

```bash
kubectl logs -l app=webapp --prefix --tail=20
```
`kubectl logs deployment/webapp` shows only one Pod, so use a label selector to cover them all.

</details>

@@ 05-Application-Lifecycle-Management/03-Practice-Test-RollingUpdates-Rollback

<details>
<summary><b>Q1.</b> How do you check which update strategy a Deployment uses?</summary>

```bash
kubectl describe deployment frontend | grep -i strategy
```
Default is `RollingUpdate` with `maxUnavailable: 25%` and `maxSurge: 25%`.

</details>

<details>
<summary><b>Q2.</b> Update the image of Deployment <code>frontend</code> to <code>kodekloud/webapp-color:v2</code> and watch the rollout.</summary>

```bash
kubectl set image deployment/frontend simple-webapp=kodekloud/webapp-color:v2
kubectl rollout status deployment/frontend
```
The container name (`simple-webapp` here) comes from `kubectl get deploy frontend -o yaml`.

</details>

<details>
<summary><b>Q3.</b> The new version is broken (Pods stuck <code>ErrImagePull</code>). How do you roll back?</summary>

```bash
kubectl rollout history deployment/frontend
kubectl rollout undo deployment/frontend
kubectl rollout undo deployment/frontend --to-revision=1
```

</details>

<details>
<summary><b>Q4.</b> How do you change the strategy to <code>Recreate</code>?</summary>

```bash
kubectl edit deployment frontend
```
Set `spec.strategy.type: Recreate` and remove the `rollingUpdate` block. All old Pods stop first, which causes downtime.

</details>

<details>
<summary><b>Q5.</b> How do you pause a rollout and resume it later?</summary>

```bash
kubectl rollout pause deployment/frontend
kubectl rollout resume deployment/frontend
```

</details>

@@ 05-Application-Lifecycle-Management/06-Practice-Test-Commands-and-Arguments

<details>
<summary><b>Q1.</b> What does the <code>ENTRYPOINT</code> and <code>CMD</code> in a Dockerfile map to in a Pod spec?</summary>

`ENTRYPOINT` maps to `command`; `CMD` maps to `args`. Setting `command` overrides the image's ENTRYPOINT (and drops CMD); setting only `args` overrides CMD.

</details>

<details>
<summary><b>Q2.</b> Create a Pod <code>ubuntu-sleeper</code> with image <code>ubuntu</code> that runs <code>sleep 5000</code>.</summary>

```bash
kubectl run ubuntu-sleeper --image=ubuntu --command -- sleep 5000
```
Equivalent YAML:
```yaml
command: ["sleep"]
args: ["5000"]
```

</details>

<details>
<summary><b>Q3.</b> The image's entrypoint is <code>python app.py</code> and CMD is <code>--color red</code>. How do you start it with <code>--color green</code>?</summary>

```yaml
args: ["--color", "green"]
```
Only `args` is set, so the ENTRYPOINT is kept and CMD is replaced.

</details>

<details>
<summary><b>Q4.</b> Why does a Pod with <code>command: ["sleep", 5000]</code> fail?</summary>

Every command argument must be a string. `5000` needs quotes: `"5000"`. The error is `cannot unmarshal number into Go struct field`.

</details>

<details>
<summary><b>Q5.</b> A Pod's args need an environment variable. How do you reference it?</summary>

```yaml
env:
- name: DELAY
  value: "10"
args: ["$(DELAY)"]
```

</details>

@@ 05-Application-Lifecycle-Management/09-Practice-Test-Env-Variables

<details>
<summary><b>Q1.</b> How do you read a Pod's environment variables?</summary>

```bash
kubectl exec <pod> -- env
kubectl get pod <pod> -o jsonpath='{.spec.containers[0].env}'
```

</details>

<details>
<summary><b>Q2.</b> Set <code>APP_COLOR=pink</code> on an existing Pod.</summary>

Environment is immutable on a running Pod, so recreate it:
```bash
kubectl get pod webapp -o yaml > webapp.yaml
# add under the container:  env: [{name: APP_COLOR, value: pink}]
kubectl replace --force -f webapp.yaml
```

</details>

<details>
<summary><b>Q3.</b> Create a ConfigMap <code>webapp-config-map</code> with <code>APP_COLOR=darkblue</code> and use it in a Pod.</summary>

```bash
kubectl create configmap webapp-config-map --from-literal=APP_COLOR=darkblue
```
```yaml
envFrom:
- configMapRef:
    name: webapp-config-map
```

</details>

<details>
<summary><b>Q4.</b> How do you inject one single key from a ConfigMap?</summary>

```yaml
env:
- name: APP_COLOR
  valueFrom:
    configMapKeyRef:
      name: webapp-config-map
      key: APP_COLOR
```

</details>

<details>
<summary><b>Q5.</b> A Pod is <code>CreateContainerConfigError</code>. What is the likely cause?</summary>

It references a ConfigMap or key that does not exist. Run `kubectl describe pod` and read the event, e.g. `configmap "x" not found`, then create it or fix the name.

</details>

@@ 05-Application-Lifecycle-Management/11.Practice-Test-Secrets

<details>
<summary><b>Q1.</b> How do you create a Secret <code>db-secret</code> with <code>DB_Host=sql01</code>, <code>DB_User=root</code> and <code>DB_Password=password123</code>?</summary>

```bash
kubectl create secret generic db-secret --from-literal=DB_Host=sql01 --from-literal=DB_User=root --from-literal=DB_Password=password123
```

</details>

<details>
<summary><b>Q2.</b> How do you read a value stored in a Secret?</summary>

Values are base64 encoded, not encrypted:
```bash
kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d
```

</details>

<details>
<summary><b>Q3.</b> Inject the whole Secret as environment variables.</summary>

```yaml
envFrom:
- secretRef:
    name: db-secret
```

</details>

<details>
<summary><b>Q4.</b> Mount a Secret as files.</summary>

```yaml
volumes:
- name: sec
  secret:
    secretName: db-secret
containers:
- name: app
  volumeMounts:
  - name: sec
    mountPath: /etc/secret
```
Each key becomes a file in `/etc/secret`.

</details>

<details>
<summary><b>Q5.</b> Why is a Secret not secure by default?</summary>

It is only base64 encoded and stored in etcd unencrypted unless encryption at rest is enabled. Use RBAC to limit who can read Secrets and enable an `EncryptionConfiguration`.

</details>

@@ 05-Application-Lifecycle-Management/13-Practice-Test-Multi-Container-Pods

<details>
<summary><b>Q1.</b> How many containers does the Pod <code>lemon</code> have, and what are their names?</summary>

```bash
kubectl get pod lemon                                  # READY x/y
kubectl get pod lemon -o jsonpath='{.spec.containers[*].name}'
```

</details>

<details>
<summary><b>Q2.</b> Create a Pod <code>yellow</code> with two containers: <code>lemon</code> (image <code>busybox</code>, sleep 1000) and <code>gold</code> (image <code>redis</code>).</summary>

```bash
kubectl run yellow --image=busybox --dry-run=client -o yaml --command -- sleep 1000 > yellow.yaml
```
Edit the file: rename the container to `lemon` and add a second one:
```yaml
- name: gold
  image: redis
```

</details>

<details>
<summary><b>Q3.</b> How do you view the logs of one container in a multi-container Pod?</summary>

```bash
kubectl logs yellow -c gold
```

</details>

<details>
<summary><b>Q4.</b> In a sidecar logging pattern, how does the app container share logs with the sidecar?</summary>

Both mount the same `emptyDir` volume. The app writes log files into it and the sidecar (for example Fluentd) reads them.

</details>

<details>
<summary><b>Q5.</b> How do you open a shell in a specific container?</summary>

```bash
kubectl exec -it yellow -c lemon -- sh
```

</details>

@@ 05-Application-Lifecycle-Management/16-Practice-Test-Init-Containers

<details>
<summary><b>Q1.</b> A Pod shows <code>Init:0/1</code>. What does it mean?</summary>

Init containers run one after another before the app containers start. `0/1` means the first of one init container has not completed. Read its logs:
```bash
kubectl logs <pod> -c <init-container-name>
kubectl describe pod <pod>
```

</details>

<details>
<summary><b>Q2.</b> Add an init container <code>init-myservice</code> (busybox) that waits for a Service named <code>myservice</code> to resolve.</summary>

```yaml
initContainers:
- name: init-myservice
  image: busybox
  command: ['sh','-c','until nslookup myservice; do echo waiting; sleep 2; done']
```

</details>

<details>
<summary><b>Q3.</b> A Pod is stuck in <code>Init:CrashLoopBackOff</code>. What do you check?</summary>

The init container's command probably exits non-zero. Check `kubectl logs <pod> -c <init>` and `describe pod` for the exit code. The Pod does not start until every init container succeeds.

</details>

<details>
<summary><b>Q4.</b> How do init containers differ from sidecars?</summary>

Init containers run to completion, in order, before app containers. Sidecars run alongside the app for the Pod's whole life.

</details>

<details>
<summary><b>Q5.</b> Do init containers share volumes with the main container?</summary>

Yes. Mount the same volume in both to hand data over, for example an init container clones a git repo into an `emptyDir` that the app serves.

</details>

@@ 06-Cluster-Maintenance/03-Practice-Test-OS-Upgrades

<details>
<summary><b>Q1.</b> A node needs a reboot. How do you move its workloads off safely?</summary>

```bash
kubectl drain node01 --ignore-daemonsets
```
This cordons the node and evicts its Pods so they are recreated elsewhere.

</details>

<details>
<summary><b>Q2.</b> <code>kubectl drain</code> refuses because a Pod is not managed by a controller. What are the options?</summary>

A bare Pod would be lost forever. Either delete it yourself, or force the drain and accept the loss:
```bash
kubectl drain node01 --ignore-daemonsets --force
```

</details>

<details>
<summary><b>Q3.</b> After maintenance, how do you let Pods schedule on the node again?</summary>

```bash
kubectl uncordon node01
```
Pods that moved do not automatically move back.

</details>

<details>
<summary><b>Q4.</b> What is the difference between <code>cordon</code> and <code>drain</code>?</summary>

`cordon` marks the node unschedulable but leaves its Pods running. `drain` cordons and also evicts the Pods.

</details>

<details>
<summary><b>Q5.</b> How do you check which Pods are on a node before draining?</summary>

```bash
kubectl get pods -A -o wide --field-selector spec.nodeName=node01
```

</details>

@@ 06-Cluster-Maintenance/06-Practice-Test-Cluster-Upgrade-Process

<details>
<summary><b>Q1.</b> How do you find the current and available versions?</summary>

```bash
kubectl get nodes                      # VERSION column
kubeadm version
kubeadm upgrade plan
```

</details>

<details>
<summary><b>Q2.</b> Which order do you upgrade a kubeadm cluster?</summary>

Control plane first, then workers, one node at a time. Never skip a minor version (1.34 to 1.35, not 1.33 to 1.35).

</details>

<details>
<summary><b>Q3.</b> Give the steps to upgrade the control plane node to v1.35.0.</summary>

```bash
apt-get update && apt-get install -y kubeadm=1.35.0-1.1
kubeadm upgrade apply v1.35.0
apt-get install -y kubelet=1.35.0-1.1 kubectl=1.35.0-1.1
systemctl daemon-reload && systemctl restart kubelet
```
(Package version strings depend on the repository.)

</details>

<details>
<summary><b>Q4.</b> Give the steps to upgrade a worker node.</summary>

From the control plane: `kubectl drain node01 --ignore-daemonsets`. On the worker:
```bash
apt-get install -y kubeadm=1.35.0-1.1
kubeadm upgrade node
apt-get install -y kubelet=1.35.0-1.1
systemctl daemon-reload && systemctl restart kubelet
```
Back on the control plane: `kubectl uncordon node01`.

</details>

<details>
<summary><b>Q5.</b> Why does <code>kubectl get nodes</code> still show the old version after <code>kubeadm upgrade apply</code>?</summary>

`get nodes` shows the kubelet version. Upgrade and restart the kubelet to change it.

</details>

@@ 07-Security/10-Practice-Test-View-Certificate-Details

<details>
<summary><b>Q1.</b> Where are the Kubernetes certificates on a kubeadm control plane node?</summary>

```bash
ls /etc/kubernetes/pki
```
The API server's manifest `/etc/kubernetes/manifests/kube-apiserver.yaml` lists every path it uses.

</details>

<details>
<summary><b>Q2.</b> What is the Common Name (CN) and the issuer of the API server certificate?</summary>

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -E "Subject:|Issuer:"
```
Issuer is usually `CN=kubernetes` (the cluster CA).

</details>

<details>
<summary><b>Q3.</b> How do you list the Subject Alternative Names (SANs) of the API server cert?</summary>

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -A1 "Alternative Name"
```

</details>

<details>
<summary><b>Q4.</b> When does the API server certificate expire?</summary>

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -enddate
kubeadm certs check-expiration
```

</details>

<details>
<summary><b>Q5.</b> The API server will not start and the log shows an x509 error. What do you do?</summary>

Find the failing component's cert path in its manifest, check it with `openssl x509 -text -noout`, and look for a wrong CN/SAN, wrong issuer or expired date. With a container runtime: `crictl ps -a | grep kube-apiserver` then `crictl logs <id>`.

</details>

@@ 07-Security/12-Practice-Test-Certificates-API

<details>
<summary><b>Q1.</b> A new user <code>akshay</code> sends a CSR. How do you create the CertificateSigningRequest object?</summary>

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: akshay
spec:
  request: <base64 of the .csr file, no newlines>
  signerName: kubernetes.io/kube-apiserver-client
  usages:
  - client auth
```
```bash
cat akshay.csr | base64 -w0
```

</details>

<details>
<summary><b>Q2.</b> How do you list and approve the request?</summary>

```bash
kubectl get csr
kubectl certificate approve akshay
```

</details>

<details>
<summary><b>Q3.</b> Another CSR looks suspicious. How do you reject it?</summary>

```bash
kubectl certificate deny agent-smith
kubectl delete csr agent-smith
```

</details>

<details>
<summary><b>Q4.</b> How do you view the request details and extract the signed certificate?</summary>

```bash
kubectl get csr akshay -o yaml
kubectl get csr akshay -o jsonpath='{.status.certificate}' | base64 -d > akshay.crt
```

</details>

<details>
<summary><b>Q5.</b> Which component actually signs the certificates?</summary>

The kube-controller-manager, using the cluster CA key and cert passed with `--cluster-signing-cert-file` and `--cluster-signing-key-file`.

</details>

@@ 07-Security/14-Practice-Test-KubeConfig

<details>
<summary><b>Q1.</b> Where is the default kubeconfig and how do you view it?</summary>

```bash
cat ~/.kube/config
kubectl config view
```

</details>

<details>
<summary><b>Q2.</b> How many clusters, users and contexts are defined, and what is the current context?</summary>

```bash
kubectl config get-contexts
kubectl config current-context
kubectl config get-clusters
kubectl config get-users
```

</details>

<details>
<summary><b>Q3.</b> Switch to the context <code>research</code>.</summary>

```bash
kubectl config use-context research
```

</details>

<details>
<summary><b>Q4.</b> Use a different kubeconfig file just for one command.</summary>

```bash
kubectl get pods --kubeconfig /root/my-kube-config
export KUBECONFIG=/root/my-kube-config     # for the whole shell
```

</details>

<details>
<summary><b>Q5.</b> A kubeconfig fails with <code>Unable to connect</code> or <code>certificate signed by unknown authority</code>. What do you check?</summary>

The cluster `server:` address and port, and the `certificate-authority` path or `certificate-authority-data` in the cluster block. A wrong CA path in the file is a common lab fault.

</details>

@@ 07-Security/18-Practice-Test-RBAC

<details>
<summary><b>Q1.</b> Which authorization modes does the API server use?</summary>

```bash
kubectl describe pod kube-apiserver-controlplane -n kube-system | grep authorization-mode
```
Typically `Node,RBAC`.

</details>

<details>
<summary><b>Q2.</b> How do you list Roles and RoleBindings, and see what a Role allows?</summary>

```bash
kubectl get roles,rolebindings -A
kubectl describe role developer -n blue
kubectl describe rolebinding dev-user-binding -n blue
```

</details>

<details>
<summary><b>Q3.</b> Create a Role <code>developer</code> allowing a user to list, create and delete Pods in <code>default</code>, and bind it to <code>dev-user</code>.</summary>

```bash
kubectl create role developer --verb=list,create,delete --resource=pods
kubectl create rolebinding dev-user-binding --role=developer --user=dev-user
```

</details>

<details>
<summary><b>Q4.</b> How do you test whether <code>dev-user</code> can do something?</summary>

```bash
kubectl auth can-i create pods --as dev-user
kubectl auth can-i delete deployments --as dev-user -n blue
```

</details>

<details>
<summary><b>Q5.</b> <code>dev-user</code> gets <code>forbidden</code> when getting a Pod. How do you fix it?</summary>

Add the missing verb or resource to the Role (`kubectl edit role developer -n blue`). The Role must be in the same namespace as the Pod, and `resourceNames` must match if set.

</details>

@@ 07-Security/20-Practice-Test-Cluster-Roles

<details>
<summary><b>Q1.</b> Which ClusterRoles exist and how many are there?</summary>

```bash
kubectl get clusterroles --no-headers | wc -l
kubectl get clusterrolebindings --no-headers | wc -l
```

</details>

<details>
<summary><b>Q2.</b> Create a ClusterRole that lets <code>michelle</code> list and get nodes, and bind it.</summary>

```bash
kubectl create clusterrole node-admin --verb=get,list,watch --resource=nodes
kubectl create clusterrolebinding michelle-binding --clusterrole=node-admin --user=michelle
```

</details>

<details>
<summary><b>Q3.</b> Extend the same user to storage: allow list/get/create/delete on PersistentVolumes and PVCs.</summary>

```bash
kubectl create clusterrole storage-admin --verb=list,get,create,delete --resource=persistentvolumes,storageclasses
kubectl create clusterrolebinding michelle-storage --clusterrole=storage-admin --user=michelle
```
(PVCs are namespaced, so they need a Role/RoleBinding, or a ClusterRole bound with a RoleBinding.)

</details>

<details>
<summary><b>Q4.</b> Which resources are cluster-scoped?</summary>

```bash
kubectl api-resources --namespaced=false
```
Nodes, PersistentVolumes, StorageClasses, Namespaces and ClusterRoles are cluster-scoped.

</details>

<details>
<summary><b>Q5.</b> What is the difference between a RoleBinding and a ClusterRoleBinding that reference the same ClusterRole?</summary>

A RoleBinding grants the ClusterRole's permissions only in its own namespace. A ClusterRoleBinding grants them cluster-wide.

</details>

@@ 07-Security/24-Practice-Test-Image-Security

<details>
<summary><b>Q1.</b> What image does a Pod use and from which registry?</summary>

```bash
kubectl describe pod web | grep Image
```
An image name like `myregistry.io/app/web:1.0` has the registry first. Without a registry it defaults to Docker Hub (`docker.io`).

</details>

<details>
<summary><b>Q2.</b> How do you create a Secret for a private registry?</summary>

```bash
kubectl create secret docker-registry regcred \
  --docker-server=private-registry.io --docker-username=registry-user \
  --docker-password=registry-password --docker-email=registry@org.com
```

</details>

<details>
<summary><b>Q3.</b> How do you make a Pod pull from that registry?</summary>

```yaml
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: private-registry.io/apps/internal-app
```

</details>

<details>
<summary><b>Q4.</b> A Pod is in <code>ImagePullBackOff</code>. How do you troubleshoot?</summary>

```bash
kubectl describe pod <pod>            # Events show the exact error
```
Common causes: typo in image or tag, private registry without `imagePullSecrets`, wrong credentials, registry unreachable.

</details>

<details>
<summary><b>Q5.</b> Where does <code>imagePullSecrets</code> go if every Pod in a namespace needs it?</summary>

Attach it to the ServiceAccount: `kubectl patch serviceaccount default -p '{"imagePullSecrets":[{"name":"regcred"}]}'`.

</details>

@@ 07-Security/26-Practice-Test-Security-Context

<details>
<summary><b>Q1.</b> What user does a container run as?</summary>

```bash
kubectl exec <pod> -- whoami
kubectl exec <pod> -- id
```

</details>

<details>
<summary><b>Q2.</b> Run the Pod <code>ubuntu-sleeper</code> as user ID 1010.</summary>

```yaml
spec:
  securityContext:
    runAsUser: 1010
  containers:
  - name: ubuntu
    image: ubuntu
    command: ["sleep","4800"]
```
A Pod-level `securityContext` applies to all containers.

</details>

<details>
<summary><b>Q3.</b> Add the Linux capabilities <code>SYS_TIME</code> and <code>NET_ADMIN</code> to a container.</summary>

Capabilities are set per container, not on the Pod:
```yaml
containers:
- name: ubuntu
  image: ubuntu
  securityContext:
    capabilities:
      add: ["SYS_TIME","NET_ADMIN"]
```

</details>

<details>
<summary><b>Q4.</b> A container-level and a Pod-level <code>runAsUser</code> disagree. Which wins?</summary>

The container-level setting overrides the Pod-level one.

</details>

<details>
<summary><b>Q5.</b> How do you stop a container running as root or escalating privileges?</summary>

```yaml
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
```

</details>

@@ 07-Security/28-Practice-Test-Network-Policies

<details>
<summary><b>Q1.</b> How do you list Network Policies and see which Pods one applies to?</summary>

```bash
kubectl get netpol
kubectl describe netpol payroll-policy
```
`podSelector` in the policy defines the target Pods.

</details>

<details>
<summary><b>Q2.</b> Allow only the Pod labelled <code>name=internal</code> to reach <code>payroll</code> on port 8080.</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: internal-policy
spec:
  podSelector:
    matchLabels:
      name: payroll
  policyTypes: ["Ingress"]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: internal
    ports:
    - port: 8080
```

</details>

<details>
<summary><b>Q3.</b> Allow egress from <code>internal</code> to <code>mysql</code> on 3306 and <code>payroll</code> on 8080.</summary>

Add `Egress` to `policyTypes` and an `egress:` block with two `to:` entries and their `ports`. Remember DNS: allow UDP/TCP 53 egress too, or name lookups will fail.

</details>

<details>
<summary><b>Q4.</b> What is the difference between a list of <code>from</code> entries and two selectors in one entry?</summary>

Separate list items are ORed. Selectors in one item (for example `namespaceSelector` plus `podSelector`) are ANDed.

</details>

<details>
<summary><b>Q5.</b> A policy exists but has no effect. Why?</summary>

The CNI plugin must support Network Policies (Calico, Cilium, Weave do; Flannel alone does not). Also check the policy's namespace and labels.

</details>

@@ 02-Core-Concepts/13-Practice-Test-PODs

<details>
<summary><b>Q1.</b> Create a Pod named <code>redis</code> using the <code>redis123</code> image, then find out why it fails.</summary>

```bash
kubectl run redis --image=redis123
kubectl describe pod redis      # Events: ErrImagePull / ImagePullBackOff
```
Fix the image name in place: `kubectl edit pod redis` (image is one of the few editable Pod fields), set `image: redis`.

</details>

<details>
<summary><b>Q2.</b> How do you see how many containers are in a Pod and how many are ready?</summary>

```bash
kubectl get pods              # READY column, e.g. 2/3
kubectl describe pod <pod>
```

</details>

<details>
<summary><b>Q3.</b> How do you find which node a Pod runs on, and its image?</summary>

```bash
kubectl get pods -o wide
kubectl describe pod <pod> | grep -E "Node:|Image:"
```

</details>

<details>
<summary><b>Q4.</b> Generate a Pod YAML without creating it.</summary>

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
```

</details>

@@ 02-Core-Concepts/15-Practice-Tests-ReplicaSet

<details>
<summary><b>Q1.</b> A ReplicaSet is not creating Pods. How do you find the reason?</summary>

```bash
kubectl describe rs <name>
```
Check the Events and that `selector.matchLabels` matches the Pod template labels, and that the image name is valid.

</details>

<details>
<summary><b>Q2.</b> Scale a ReplicaSet to 5 replicas.</summary>

```bash
kubectl scale rs new-replica-set --replicas=5
```

</details>

<details>
<summary><b>Q3.</b> Delete one Pod of a ReplicaSet. What happens?</summary>

The ReplicaSet creates a replacement to keep the desired count.

</details>

<details>
<summary><b>Q4.</b> Fix a ReplicaSet whose Pods use a bad image.</summary>

```bash
kubectl edit rs new-replica-set      # fix image
kubectl delete pod -l <label>        # existing Pods keep the old image until deleted
```

</details>

@@ 02-Core-Concepts/17-Practice-Tests-Deployments

<details>
<summary><b>Q1.</b> Create a Deployment <code>httpd-frontend</code> with 3 replicas of <code>httpd:2.4-alpine</code>.</summary>

```bash
kubectl create deployment httpd-frontend --image=httpd:2.4-alpine --replicas=3
```

</details>

<details>
<summary><b>Q2.</b> How do you see the Deployment's strategy, image and the ReplicaSet it owns?</summary>

```bash
kubectl describe deployment httpd-frontend
kubectl get rs
```

</details>

<details>
<summary><b>Q3.</b> Update the image and watch the rollout.</summary>

```bash
kubectl set image deployment/httpd-frontend httpd=httpd:2.4-alpine
kubectl rollout status deployment/httpd-frontend
```

</details>

<details>
<summary><b>Q4.</b> Change the strategy to Recreate.</summary>

```bash
kubectl edit deployment <name>      # strategy.type: Recreate (remove rollingUpdate block)
```

</details>

@@ 02-Core-Concepts/19-Practice-Test-Namespaces

<details>
<summary><b>Q1.</b> List namespaces and count the Pods in one.</summary>

```bash
kubectl get ns
kubectl get pods -n research --no-headers | wc -l
```

</details>

<details>
<summary><b>Q2.</b> Create a Pod in a namespace.</summary>

```bash
kubectl run redis --image=redis -n finance
```

</details>

<details>
<summary><b>Q3.</b> Find which namespace a Pod <code>blue</code> lives in.</summary>

```bash
kubectl get pods -A | grep blue
```

</details>

<details>
<summary><b>Q4.</b> How do you reach a Service in another namespace by DNS?</summary>

`<service>.<namespace>.svc.cluster.local`, for example `db-service.dev.svc.cluster.local`.

</details>

@@ 02-Core-Concepts/22-Practice-Test-Services

<details>
<summary><b>Q1.</b> Get a Service's type, port, target port and endpoints.</summary>

```bash
kubectl get svc
kubectl describe svc kubernetes
kubectl get endpoints
```

</details>

<details>
<summary><b>Q2.</b> Create a Service for a Deployment on port 80 of type NodePort 30080.</summary>

```bash
kubectl expose deployment simple-webapp-deployment --name=webapp-service --port=8080 --target-port=8080 --type=NodePort --dry-run=client -o yaml > svc.yaml
```
Edit the file to add `nodePort: 30080`, then `kubectl apply -f svc.yaml`.

</details>

<details>
<summary><b>Q3.</b> A Service has no endpoints. Why?</summary>

The Service `selector` does not match any Pod labels, or the matching Pods are not Ready.

</details>

<details>
<summary><b>Q4.</b> Quickly create a Pod and a ClusterIP Service together.</summary>

```bash
kubectl run redis --image=redis --port=6379 --expose
```

</details>

@@ 02-Core-Concepts/24-Practice-Test-Imperative-Commands

<details>
<summary><b>Q1.</b> Create an nginx Pod with a label <code>tier=db</code>.</summary>

```bash
kubectl run redis --image=redis:alpine --labels=tier=db
```

</details>

<details>
<summary><b>Q2.</b> Expose that Pod on port 6379 with a Service.</summary>

```bash
kubectl expose pod redis --port=6379 --name=redis-service
```

</details>

<details>
<summary><b>Q3.</b> Create a Deployment with 2 replicas, then a Pod with a custom port.</summary>

```bash
kubectl create deployment webapp --image=kodekloud/webapp-color --replicas=3
kubectl run custom-nginx --image=nginx --port=8080
```

</details>

<details>
<summary><b>Q4.</b> Create a NodePort service from a Pod with a specific node port.</summary>

`kubectl expose` cannot set `nodePort`. Generate YAML with `--dry-run=client -o yaml`, add `nodePort`, and apply it.

</details>

@@ 03-Scheduling/03-Practice-Test-Manual-Scheduling

<details>
<summary><b>Q1.</b> A Pod is <code>Pending</code> with no node. How do you place it manually?</summary>

Set `nodeName` in the Pod spec. It cannot be changed on a live Pod, so force-replace:
```bash
kubectl replace --force -f nginx.yaml
```

</details>

<details>
<summary><b>Q2.</b> Alternatively, bind an existing Pod without recreating it.</summary>

POST a `Binding` object to the API. In practice, delete and recreate with `nodeName`.

</details>

<details>
<summary><b>Q3.</b> Why is the Pod Pending in the first place?</summary>

The scheduler is not running. Check `kubectl get pods -n kube-system | grep scheduler`.

</details>

@@ 03-Scheduling/05-Practice-Test-Labels-and-Selectors

<details>
<summary><b>Q1.</b> List Pods with a specific label.</summary>

```bash
kubectl get pods -l env=dev
kubectl get pods --selector env=dev --no-headers | wc -l
```

</details>

<details>
<summary><b>Q2.</b> Select by several labels.</summary>

```bash
kubectl get all --selector env=prod,bu=finance,tier=frontend
```

</details>

<details>
<summary><b>Q3.</b> Fix a ReplicaSet whose selector does not match its template.</summary>

Make `spec.selector.matchLabels` match `spec.template.metadata.labels`.

</details>

@@ 03-Scheduling/07-Practice-Test-Taints-and-Tolerations

<details>
<summary><b>Q1.</b> Taint a node so Pods avoid it.</summary>

```bash
kubectl taint nodes node01 spray=mortein:NoSchedule
```

</details>

<details>
<summary><b>Q2.</b> Create a Pod that tolerates that taint.</summary>

```yaml
spec:
  tolerations:
  - key: spray
    operator: Equal
    value: mortein
    effect: NoSchedule
```

</details>

<details>
<summary><b>Q3.</b> Remove a taint.</summary>

```bash
kubectl taint nodes controlplane node-role.kubernetes.io/control-plane:NoSchedule-
```

</details>

<details>
<summary><b>Q4.</b> Does a toleration force a Pod onto the tainted node?</summary>

No, it only allows it. Use node affinity or `nodeSelector` to attract it.

</details>

@@ 03-Scheduling/10-Practice-Test-Node-Affinity

<details>
<summary><b>Q1.</b> Label a node.</summary>

```bash
kubectl label node node01 color=blue
```

</details>

<details>
<summary><b>Q2.</b> Create a Deployment <code>blue</code> whose Pods must run on nodes labelled <code>color=blue</code>.</summary>

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
      - matchExpressions:
        - key: color
          operator: In
          values: ["blue"]
```

</details>

<details>
<summary><b>Q3.</b> Require a node that has a label at all, whatever its value.</summary>

Use `operator: Exists` with just the `key`.

</details>

@@ 04-Logging-and-Monitoring/03-Practice-Test-Monitor-Cluster-Components

<details>
<summary><b>Q1.</b> Deploy metrics-server and check it works.</summary>

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl top node
```

</details>

<details>
<summary><b>Q2.</b> Which Pod uses the most memory/CPU?</summary>

```bash
kubectl top pod --sort-by=memory
kubectl top pod --sort-by=cpu
```

</details>

<details>
<summary><b>Q3.</b> <code>kubectl top</code> says "Metrics API not available".</summary>

Metrics-server is missing or not Ready. Check `kubectl get pods -n kube-system` and its logs.

</details>

@@ 06-Cluster-Maintenance/09-Practice-Test-Backup-and-Restore-Methods

<details>
<summary><b>Q1.</b> Which etcd version is running and where are its certs?</summary>

```bash
kubectl -n kube-system describe pod etcd-controlplane | grep -E "Image:|--cert|--key|--trusted-ca|--listen-client"
```

</details>

<details>
<summary><b>Q2.</b> Take an etcd snapshot.</summary>

```bash
ETCDCTL_API=3 etcdctl snapshot save /opt/snapshot-pre-boot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

</details>

<details>
<summary><b>Q3.</b> Restore it.</summary>

```bash
etcdutl snapshot restore /opt/snapshot-pre-boot.db --data-dir /var/lib/etcd-from-backup
```
Then edit `/etc/kubernetes/manifests/etcd.yaml` so the `etcd-data` hostPath is `/var/lib/etcd-from-backup`; the static Pod restarts itself.

</details>

@@ 06-Cluster-Maintenance/10-Practice-Test-Backup-and-Restore-Methods-2

<details>
<summary><b>Q1.</b> How do you tell whether etcd is stacked or external?</summary>

Stacked etcd runs as a static Pod on the control plane. External etcd is a separate server: check `--etcd-servers` in the API server manifest.

</details>

<details>
<summary><b>Q2.</b> How do you back up external etcd?</summary>

SSH to the etcd host and run `etcdctl snapshot save` with that host's certs, then copy the file back.

</details>

<details>
<summary><b>Q3.</b> How do you restore external etcd?</summary>

Stop the etcd service, restore to a new data dir, point `--data-dir` in the systemd unit at it, `chown etcd:etcd`, `systemctl daemon-reload`, then start etcd and restart the control plane components.

</details>

@@ 07-Security/22-Practice-Test-Service-Accounts

<details>
<summary><b>Q1.</b> Create a ServiceAccount and a token.</summary>

```bash
kubectl create serviceaccount dashboard-sa
kubectl create token dashboard-sa
```

</details>

<details>
<summary><b>Q2.</b> Make a Deployment use that ServiceAccount.</summary>

Set `serviceAccountName: dashboard-sa` in the Pod template.

</details>

<details>
<summary><b>Q3.</b> Why does the default token no longer appear as a Secret?</summary>

Since v1.24 tokens are short-lived and requested via the TokenRequest API. Long-lived tokens need a Secret of type `kubernetes.io/service-account-token`.

</details>

@@ 08-Storage/10-Practice-Test-Persistent-Volume-Claims

<details>
<summary><b>Q1.</b> Create a PVC that binds to a PV.</summary>

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: claim-log-1
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 50Mi
```

</details>

<details>
<summary><b>Q2.</b> The PVC stays <code>Pending</code>. Why?</summary>

`kubectl describe pvc` shows it. Usual causes: access mode mismatch, requested size larger than any PV, `storageClassName` mismatch.

</details>

<details>
<summary><b>Q3.</b> Mount the PVC in a Pod.</summary>

```yaml
volumes:
- name: v
  persistentVolumeClaim:
    claimName: claim-log-1
```

</details>

<details>
<summary><b>Q4.</b> What happens to a PV when its PVC is deleted?</summary>

It follows `persistentVolumeReclaimPolicy`: Retain (kept, not reusable), Delete (removed), Recycle (deprecated).

</details>

@@ 08-Storage/13-Practice-Test-Storage-Class

<details>
<summary><b>Q1.</b> List StorageClasses and find the default.</summary>

```bash
kubectl get sc
```
The default is marked `(default)`.

</details>

<details>
<summary><b>Q2.</b> What does <code>WaitForFirstConsumer</code> do?</summary>

Delays provisioning and binding until a Pod using the PVC is scheduled.

</details>

<details>
<summary><b>Q3.</b> Create a StorageClass <code>delayed-volume-sc</code> using the no-provisioner.</summary>

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: delayed-volume-sc
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

</details>

@@ 09-Networking/09-Practice-Test-Explore-Env

<details>
<summary><b>Q1.</b> Find the node IP, Pod CIDR and container runtime.</summary>

```bash
kubectl get nodes -o wide
ip addr
```

</details>

<details>
<summary><b>Q2.</b> Find the interface used for the cluster network and its MAC.</summary>

```bash
ip link
ip addr show eth0
```

</details>

<details>
<summary><b>Q3.</b> Which ports do the control plane components listen on?</summary>

```bash
netstat -natulp | grep -E "kube-apiserver|etcd|kube-sched"
```
API server 6443, etcd 2379/2380, kubelet 10250.

</details>

@@ 09-Networking/13-Practice-Test-CNI-weave

<details>
<summary><b>Q1.</b> Which CNI plugin is installed and where is its config?</summary>

```bash
ls /etc/cni/net.d/
ls /opt/cni/bin
```

</details>

<details>
<summary><b>Q2.</b> Pods are stuck <code>ContainerCreating</code>. Why?</summary>

Often no CNI is installed. `kubectl describe pod` shows "network plugin is not ready".

</details>

<details>
<summary><b>Q3.</b> Which binary does the kubelet run to set up Pod networking?</summary>

The one named in the CNI config, such as `weave-net` or `flannel`, found in `/opt/cni/bin`.

</details>

@@ 09-Networking/14-Practice-Test-Deploy-Network-Solution

<details>
<summary><b>Q1.</b> Deploy Weave Net.</summary>

```bash
kubectl apply -f https://reweave.azurewebsites.net/k8s/v1.29/net.yaml
```
(Use the manifest URL from the lab or Weave docs.)

</details>

<details>
<summary><b>Q2.</b> How do you confirm it works?</summary>

```bash
kubectl get pods -n kube-system | grep weave
```
Then check that previously stuck Pods become `Running`.

</details>

<details>
<summary><b>Q3.</b> Pods get IPs from the wrong range. How do you change it?</summary>

Set `IPALLOC_RANGE` in the weave container env of the DaemonSet.

</details>

@@ 09-Networking/16-Practice-Test-Networking-weave

<details>
<summary><b>Q1.</b> How many Weave agents run and where?</summary>

One per node (DaemonSet): `kubectl get pods -n kube-system -o wide | grep weave`.

</details>

<details>
<summary><b>Q2.</b> What is the Pod network range and the bridge name?</summary>

```bash
ip addr show weave
kubectl logs -n kube-system weave-net-xxxx -c weave | grep ipalloc-range
```

</details>

<details>
<summary><b>Q3.</b> What is the default gateway of a Pod?</summary>

```bash
kubectl exec -it <pod> -- ip route
```
It points to the bridge IP on the Pod's node.

</details>

@@ 09-Networking/18-Practice-Test-Service-Networking

<details>
<summary><b>Q1.</b> What is the Service IP range?</summary>

```bash
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep service-cluster-ip-range
```

</details>

<details>
<summary><b>Q2.</b> Which proxy mode does kube-proxy use?</summary>

```bash
kubectl logs -n kube-system <kube-proxy-pod> | grep -i proxier
```
Usually `iptables`.

</details>

<details>
<summary><b>Q3.</b> Find the iptables rules for a Service.</summary>

```bash
iptables -t nat -L -n | grep db-service
```

</details>

@@ 09-Networking/21-Practice-Test-CoreDNS-in-Kubernetes

<details>
<summary><b>Q1.</b> Where does CoreDNS run and how is it exposed?</summary>

Deployment `coredns` in `kube-system`, exposed by Service `kube-dns`.

</details>

<details>
<summary><b>Q2.</b> Where is the CoreDNS config?</summary>

```bash
kubectl -n kube-system describe cm coredns
```
It is the Corefile, mounted at `/etc/coredns`.

</details>

<details>
<summary><b>Q3.</b> How does a Pod find the DNS server?</summary>

The kubelet writes the `kube-dns` IP into the Pod's `/etc/resolv.conf`.

</details>

<details>
<summary><b>Q4.</b> What is the FQDN of a Service?</summary>

`<svc>.<ns>.svc.cluster.local`.

</details>

@@ 09-Networking/24-Practice-Test-CKA-Ingress-Net-1

<details>
<summary><b>Q1.</b> Which Ingress controller is deployed and in which namespace?</summary>

```bash
kubectl get pods -A | grep -i ingress
kubectl get ingress -A
```

</details>

<details>
<summary><b>Q2.</b> Create an Ingress that routes <code>/wear</code> to <code>wear-service</code>.</summary>

```bash
kubectl create ingress ingress-wear --rule="/wear=wear-service:8080" -n app-space
```

</details>

<details>
<summary><b>Q3.</b> An Ingress returns 404 from the controller. What is wrong?</summary>

The backend Service name or port is wrong, or `rewrite-target` annotation is missing. `kubectl describe ingress` shows the backends.

</details>

@@ 09-Networking/25-Practice-Test-CKA-Ingress-Net-2

<details>
<summary><b>Q1.</b> Add a second path to an existing Ingress.</summary>

```bash
kubectl edit ingress ingress-wear-watch -n app-space
```
Add another `paths` entry with `path: /watch`, `pathType: Prefix` and the backend Service.

</details>

<details>
<summary><b>Q2.</b> Why use <code>nginx.ingress.kubernetes.io/rewrite-target: /</code>?</summary>

Without it the backend sees `/wear`, which it may not serve.

</details>

<details>
<summary><b>Q3.</b> Create an Ingress for a different namespace.</summary>

An Ingress can only reference Services in its own namespace, so create it in the same namespace as the Service.

</details>

@@ 11-Install-Kubernetes-the-kubeadm-way/05-Practice-Test-Deploy-Kubernetes-Cluster-using-Kubeadm

<details>
<summary><b>Q1.</b> Which steps are common to every node?</summary>

Disable swap, load `br_netfilter`, set sysctl `net.ipv4.ip_forward=1`, install a container runtime, then `kubeadm`, `kubelet`, `kubectl`.

</details>

<details>
<summary><b>Q2.</b> Initialise the control plane.</summary>

```bash
kubeadm init --apiserver-advertise-address=<ip> --pod-network-cidr=10.244.0.0/16
mkdir -p ~/.kube && cp /etc/kubernetes/admin.conf ~/.kube/config
```

</details>

<details>
<summary><b>Q3.</b> Join a worker, and what if the join command is lost?</summary>

Run the printed `kubeadm join ...`. To get a new one:
```bash
kubeadm token create --print-join-command
```

</details>

<details>
<summary><b>Q4.</b> Nodes are <code>NotReady</code> after join.</summary>

Install a CNI plugin (Flannel, Calico, Weave) with `kubectl apply -f`.

</details>

@@ 12-Troubleshooting/05-Practice-Test-Control-Plane-Failure

<details>
<summary><b>Q1.</b> A Pod stays Pending and nothing schedules. What do you check?</summary>

```bash
kubectl get pods -n kube-system
```
If `kube-scheduler` is down, read its manifest `/etc/kubernetes/manifests/kube-scheduler.yaml` for typos.

</details>

<details>
<summary><b>Q2.</b> Scaling a Deployment does nothing.</summary>

The controller manager is likely broken. `kubectl -n kube-system logs kube-controller-manager-controlplane` and check its manifest and kubeconfig paths.

</details>

<details>
<summary><b>Q3.</b> Where are static Pod manifests and the logs?</summary>

`/etc/kubernetes/manifests/`. Logs: `kubectl logs` or `crictl logs`, `journalctl -u kubelet`.

</details>

@@ 12-Troubleshooting/08-Practice-Test-Worker-Node-Failure

<details>
<summary><b>Q1.</b> A node shows <code>NotReady</code>. First steps?</summary>

```bash
kubectl describe node node01
ssh node01
systemctl status kubelet
journalctl -u kubelet -f
```

</details>

<details>
<summary><b>Q2.</b> Kubelet is stopped or crashing.</summary>

```bash
systemctl start kubelet && systemctl enable kubelet
```
If it still fails, check `/var/lib/kubelet/config.yaml` and `/etc/kubernetes/kubelet.conf` (CA path, API server address and port).

</details>

<details>
<summary><b>Q3.</b> Which certificate path is commonly wrong?</summary>

The `clientCAFile` in the kubelet config or the CA in kubelet.conf; fix to `/etc/kubernetes/pki/ca.crt`.

</details>

@@ 12-Troubleshooting/10-Practice-Test-Troubleshoot-Network

<details>
<summary><b>Q1.</b> Pods in <code>ContainerCreating</code> or failing DNS. What first?</summary>

Confirm the CNI and kube-proxy are running: `kubectl get pods -n kube-system`.

</details>

<details>
<summary><b>Q2.</b> kube-proxy is in CrashLoopBackOff.</summary>

```bash
kubectl logs -n kube-system <kube-proxy-pod>
kubectl describe ds kube-proxy -n kube-system
```
Check the ConfigMap `kube-proxy` and the config path in the DaemonSet command.

</details>

<details>
<summary><b>Q3.</b> Services work by IP but not by name.</summary>

Check CoreDNS Pods, the `kube-dns` Service and its endpoints.

</details>

@@ 13-Other-Topics/04-Practice-Test-Advance-Kubectl-Commands

<details>
<summary><b>Q1.</b> List node names with JSONPath.</summary>

```bash
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'
```

</details>

<details>
<summary><b>Q2.</b> Show node name and CPU count in custom columns.</summary>

```bash
kubectl get nodes -o custom-columns=NODE:.metadata.name,CPU:.status.capacity.cpu
```

</details>

<details>
<summary><b>Q3.</b> Sort PVs by capacity.</summary>

```bash
kubectl get pv --sort-by=.spec.capacity.storage
```

</details>

<details>
<summary><b>Q4.</b> Find the context of a user in kubeconfig by JSONPath.</summary>

```bash
kubectl config view --kubeconfig=/root/my-kube-config -o jsonpath='{.contexts[?(@.context.user=="aws-user")].name}'
```

</details>

@@ 16-Ultimate-Mocks/02-Troubleshooting/docs/11-C1-orange-pvc-cka13-trb

<details>
<summary><b>Q1.</b> The PVC is Pending. How do you find why?</summary>

```bash
kubectl describe pvc orange-pvc-cka13-trb      # "requested PV is too small"
kubectl describe pv orange-pv-cka13-trb
```

</details>

<details>
<summary><b>Q2.</b> How do you fix it?</summary>

A PVC request cannot be shrunk in place. Export, set the request to the PV size, and recreate:
```bash
kubectl get pvc orange-pvc-cka13-trb -o yaml > pvc.yaml
kubectl replace --force -f pvc.yaml
```

</details>

@@ 16-Ultimate-Mocks/02-Troubleshooting/docs/19-C1-netpol-cyan-pod-cka28-trb

<details>
<summary><b>Q1.</b> What is the goal?</summary>

Only `cyan-white-cka28-trb` may reach `cyan-pod-cka28-trb` on port 80.

</details>

<details>
<summary><b>Q2.</b> How do you investigate?</summary>

```bash
kubectl -n cyan-ns-cka28-trb describe netpol cyan-np-cka28-trb
kubectl get pods --show-labels
kubectl get ns --show-labels
```
The policy's `from` selectors usually don't match the real namespace and Pod labels (the source Pods are in `default`, so use a `namespaceSelector` on `kubernetes.io/metadata.name: default` together with a `podSelector`).

</details>

<details>
<summary><b>Q3.</b> How do you verify?</summary>

```bash
kubectl exec cyan-white-cka28-trb -- curl -s --max-time 3 cyan-svc-cka28-trb.cyan-ns-cka28-trb
kubectl exec cyan-black-cka28-trb -- curl -s --max-time 3 cyan-svc-cka28-trb.cyan-ns-cka28-trb
```
The first works, the second times out.

</details>

@@ 16-Ultimate-Mocks/04-Storage/docs/10-CI-olive-pvc-cka10-str

<details>
<summary><b>Q1.</b> What must be added to the template?</summary>

A PVC `olive-pvc-cka10-str` requesting `100Mi` from `olive-pv-cka10-str`, a `busybox` sidecar mounting `python-data` at `/usr/src` with `readOnly: true`, and a NodePort Service `olive-svc-cka10-str` on `32006`.

</details>

<details>
<summary><b>Q2.</b> How do you make the PVC bind to the right PV?</summary>

Match `accessModes` and `storageClassName` with the PV (`kubectl get pv`) and set `volumeName: olive-pv-cka10-str`.

</details>

<details>
<summary><b>Q3.</b> How do you keep the sidecar running?</summary>

Give it a command, such as `command: ["sleep","3600"]`.

</details>

@@ 16-Ultimate-Mocks/05-Services-Networking/docs/03-C3-External-Webserver

<details>
<summary><b>Q1.</b> Why can't Pods reach the external web server through the Service?</summary>

```bash
kubectl describe svc external-webserver-cka03-svcn
kubectl get endpoints external-webserver-cka03-svcn
```
A Service without a selector needs a manually created Endpoints object, and the endpoint IP/port are wrong or missing.

</details>

<details>
<summary><b>Q2.</b> How do you fix it?</summary>

Create or edit an Endpoints object with the same name as the Service, pointing at the `student-node` IP and port `9999`:
```yaml
apiVersion: v1
kind: Endpoints
metadata:
  name: external-webserver-cka03-svcn
subsets:
- addresses:
  - ip: <student-node-ip>
  ports:
  - port: 9999
```

</details>

@@ 16-Ultimate-Mocks/09-general/docs/01-cluster-state-questions

<details>
<summary><b>Q1.</b> Why can questions like "write the Pod using most CPU to a file" be marked wrong?</summary>

The marker checks cluster state at the end of the exam. Later deployments may change which Pod is top.

</details>

<details>
<summary><b>Q2.</b> What is the safe approach?</summary>

Save the command as a script, test it, and re-run it just before ending the exam so the file reflects the final state.

</details>

