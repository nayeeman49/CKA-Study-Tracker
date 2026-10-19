# CKA Mock Exam 4

> Harder paper: cluster build, external etcd, aggregation and deeper troubleshooting.

**Time:** 2 hours  |  **Questions:** 19  |  **Total:** 100%  |  **Pass mark:** 66%

**Rules (as in the real exam):** you may use the Kubernetes documentation (kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs and the Gateway API docs). Each task names the cluster to use, so always run the given `kubectl config use-context` first. Skip hard tasks and return to them; partial credit is given. Try the whole paper before opening any solution.

| Domain | Weight |
|---|---|
| Cluster Architecture | 25% |
| Workloads & Scheduling | 15% |
| Storage | 10% |
| Services & Networking | 20% |
| Troubleshooting | 30% |

**Setup tips:** `alias k=kubectl`, `export do="--dry-run=client -o yaml"`, `source <(kubectl completion bash)`. These are probably already set in the exam terminal.

---

## Question 1 (3%)

**Domain:** Cluster Architecture

> Context: `kubectl config use-context cluster4`

Node `kb1` is a clean Ubuntu machine that will become a new control plane node. Before running `kubeadm init`, prepare it: swap must be off permanently, the kernel module `br_netfilter` must load at boot, and the sysctls `net.bridge.bridge-nf-call-iptables=1` and `net.ipv4.ip_forward=1` must be set persistently.

<details><summary>Show solution</summary>

```bash
ssh kb1
sudo -i
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab
cat > /etc/modules-load.d/k8s.conf <<'EOF2'
overlay
br_netfilter
EOF2
modprobe overlay && modprobe br_netfilter
cat > /etc/sysctl.d/k8s.conf <<'EOF2'
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF2
sysctl --system
sysctl net.ipv4.ip_forward net.bridge.bridge-nf-call-iptables
free -m | grep -i swap
```
Verify the module with `lsmod | grep br_netfilter`. Editing only `/etc/fstab` or only running `swapoff -a` is not enough: the first needs a reboot, the second does not persist.

</details>

---

## Question 2 (7%)

**Domain:** Cluster Architecture

> Context: `kubectl config use-context cluster4`

Initialise a new control plane on `kb1` with kubeadm: Kubernetes version `v1.35.0`, Pod network CIDR `10.244.0.0/16`, Service CIDR `10.96.0.0/12` and the API server advertise address `192.168.50.10`. Configure `kubectl` for the `root` user and then print the command needed to join workers.

<details><summary>Show solution</summary>

```bash
ssh kb1
sudo -i
kubeadm init \
  --kubernetes-version=v1.35.0 \
  --pod-network-cidr=10.244.0.0/16 \
  --service-cidr=10.96.0.0/12 \
  --apiserver-advertise-address=192.168.50.10
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
kubectl get nodes
kubeadm token create --print-join-command
```
The node stays `NotReady` until a CNI plugin is installed (for example Flannel for 10.244.0.0/16). Preflight errors for swap or modules mean the previous task was incomplete. A config file `--config kubeadm.yaml` with `ClusterConfiguration` is the alternative.

</details>

---

## Question 3 (6%)

**Domain:** Cluster Architecture

> Context: `kubectl config use-context cluster4`

The cluster uses an **external** etcd running as a systemd service on host `etcd1` (client URL `https://10.0.0.20:2379`, certificates in `/etc/etcd/pki/`: `ca.crt`, `server.crt`, `server.key`). Take a snapshot to `/opt/backup/ext-etcd.db` on `etcd1` and check its status. Show the member list in `/opt/answers/members.txt`.

<details><summary>Show solution</summary>

```bash
ssh etcd1
sudo -i
mkdir -p /opt/backup /opt/answers
export ETCDCTL_API=3
ETCD="--endpoints=https://10.0.0.20:2379 --cacert=/etc/etcd/pki/ca.crt --cert=/etc/etcd/pki/server.crt --key=/etc/etcd/pki/server.key"
etcdctl $ETCD snapshot save /opt/backup/ext-etcd.db
etcdutl snapshot status /opt/backup/ext-etcd.db -w table
etcdctl $ETCD member list -w table > /opt/answers/members.txt
cat /opt/answers/members.txt
```
Find the external etcd on the API server with `grep etcd-servers /etc/kubernetes/manifests/kube-apiserver.yaml`. If the files must be on the student node, copy them with `scp`.

</details>

---

## Question 4 (5%)

**Domain:** Cluster Architecture

> Context: `kubectl config use-context cluster4`

Create a ClusterRole `monitor-base` that allows `get` and `list` on `nodes`, and a second ClusterRole `monitor-extra` that allows `get` and `list` on `namespaces`. Create an aggregating ClusterRole `monitor` that automatically combines both of them using the label `rbac.example.com/aggregate-to-monitor=true`. Bind `monitor` to ServiceAccount `watcher` in namespace `mon` with a ClusterRoleBinding `watcher-monitor`.

<details><summary>Show solution</summary>

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitor-base
  labels:
    rbac.example.com/aggregate-to-monitor: "true"
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get","list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitor-extra
  labels:
    rbac.example.com/aggregate-to-monitor: "true"
rules:
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get","list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitor
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.example.com/aggregate-to-monitor: "true"
rules: []
```
```bash
kubectl apply -f roles.yaml
kubectl create namespace mon 2>/dev/null; kubectl -n mon create sa watcher
kubectl create clusterrolebinding watcher-monitor --clusterrole=monitor --serviceaccount=mon:watcher
kubectl auth can-i list nodes --as system:serviceaccount:mon:watcher       # yes
kubectl auth can-i list namespaces --as system:serviceaccount:mon:watcher  # yes
```
The `rules` of an aggregating role are filled in by the controller, so leave them empty.

</details>

---

## Question 5 (4%)

**Domain:** Cluster Architecture

> Context: `kubectl config use-context cluster4`

The kubeconfig at `/opt/multi/kubeconfig` contains several contexts. Without changing the file, write (a) the names of all contexts to `/opt/answers/contexts.txt`, (b) the name of the current context to `/opt/answers/current.txt`, and (c) the decoded client certificate of the user `admin-prod` to `/opt/answers/admin-prod.crt`.

<details><summary>Show solution</summary>

```bash
export KUBECONFIG=/opt/multi/kubeconfig
kubectl config get-contexts -o name > /opt/answers/contexts.txt
kubectl config current-context > /opt/answers/current.txt
kubectl config view --raw -o jsonpath='{.users[?(@.name=="admin-prod")].user.client-certificate-data}' | base64 -d > /opt/answers/admin-prod.crt
unset KUBECONFIG
openssl x509 -in /opt/answers/admin-prod.crt -noout -subject
```
`--raw` is needed because `config view` hides certificate data otherwise. If the file uses a path (`client-certificate`) instead of embedded data, copy that file.

</details>

---

## Question 6 (5%)

**Domain:** Workloads & Scheduling

> Context: `kubectl config use-context cluster4`

Deployment `shop` in namespace `shop` (image `nginx:1.25`, 6 replicas) must be updated to `nginx:1.26` using a rolling update that never lets the number of available Pods drop below 6 and creates at most 2 extra Pods. Pause the rollout after the first new Pod, check it, then resume.

<details><summary>Show solution</summary>

```bash
kubectl -n shop patch deployment shop -p '{"spec":{"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxUnavailable":0,"maxSurge":2}}}}'
kubectl -n shop set image deployment/shop nginx=nginx:1.26
kubectl -n shop rollout pause deployment/shop
kubectl -n shop get pods -o wide
kubectl -n shop rollout resume deployment/shop
kubectl -n shop rollout status deployment/shop
```
`maxUnavailable: 0` with `maxSurge: 2` guarantees 6 available at any time. If the pause happens too late the rollout may have finished already; run `pause` right after `set image` (or use `kubectl rollout pause` before changing the image and then resume).

</details>

---

## Question 7 (5%)

**Domain:** Workloads & Scheduling

> Context: `kubectl config use-context cluster4`

Add probes to Deployment `probe-app` (namespace `probes`, container `app`, port 8080): a startup probe on `/healthz` (up to 30 failures, every 2 seconds), a readiness probe on `/ready` every 5 seconds and a liveness probe that runs the command `cat /tmp/alive` every 10 seconds with an initial delay of 5 seconds.

<details><summary>Show solution</summary>

```bash
kubectl -n probes edit deployment probe-app
```
```yaml
        startupProbe:
          httpGet:
            path: /healthz
            port: 8080
          failureThreshold: 30
          periodSeconds: 2
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          periodSeconds: 5
        livenessProbe:
          exec:
            command: ["cat","/tmp/alive"]
          initialDelaySeconds: 5
          periodSeconds: 10
```
```bash
kubectl -n probes rollout status deployment probe-app
kubectl -n probes describe pod -l app=probe-app | grep -E "Liveness|Readiness|Startup"
```
Liveness and readiness probes do not start until the startup probe succeeds. A failing readiness probe removes the Pod from Service endpoints; a failing liveness probe restarts the container.

</details>

---

## Question 8 (5%)

**Domain:** Workloads & Scheduling

> Context: `kubectl config use-context cluster4`

Create a DaemonSet `node-agent` in namespace `agents` (image `busybox`, command `sleep 86400`) that runs on **every** node, including the control plane node (which has the taint `node-role.kubernetes.io/control-plane:NoSchedule`). Limit its resources to `50m` CPU and `64Mi` memory.

<details><summary>Show solution</summary>

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
  namespace: agents
spec:
  selector:
    matchLabels:
      app: node-agent
  template:
    metadata:
      labels:
        app: node-agent
    spec:
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: agent
        image: busybox
        command: ["sleep","86400"]
        resources:
          limits:
            cpu: 50m
            memory: 64Mi
```
```bash
kubectl create namespace agents 2>/dev/null
kubectl apply -f ds.yaml
kubectl -n agents get ds node-agent
kubectl -n agents get pods -o wide        # one per node
```
Generate a base file with `kubectl create deployment ... --dry-run=client -o yaml` and change `kind` to `DaemonSet`, then delete `replicas` and `strategy`.

</details>

---

## Question 9 (5%)

**Domain:** Storage

> Context: `kubectl config use-context cluster4`

A Pod `projected` in namespace `vols` must mount a **projected** volume at `/etc/combo` that contains the ConfigMap `app-cfg`, the Secret `app-sec` and the Pod's own labels as a file called `labels`. Also add an `emptyDir` volume backed by memory (`medium: Memory`, size limit `64Mi`) mounted at `/cache`. Use image `busybox` and `sleep 3600`.

<details><summary>Show solution</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: projected
  namespace: vols
  labels:
    app: demo
spec:
  containers:
  - name: c
    image: busybox
    command: ["sleep","3600"]
    volumeMounts:
    - name: combo
      mountPath: /etc/combo
    - name: cache
      mountPath: /cache
  volumes:
  - name: combo
    projected:
      sources:
      - configMap:
          name: app-cfg
      - secret:
          name: app-sec
      - downwardAPI:
          items:
          - path: labels
            fieldRef:
              fieldPath: metadata.labels
  - name: cache
    emptyDir:
      medium: Memory
      sizeLimit: 64Mi
```
```bash
kubectl apply -f projected.yaml
kubectl -n vols exec projected -- ls /etc/combo
kubectl -n vols exec projected -- cat /etc/combo/labels
```

</details>

---

## Question 10 (5%)

**Domain:** Storage

> Context: `kubectl config use-context cluster4`

The PersistentVolumeClaim `archive-pvc` in namespace `vault` was deleted by mistake. The PersistentVolume `archive-pv` (reclaim policy `Retain`) shows `Released` and still holds the data. Make the PV available again and create a new PVC `archive-pvc` (namespace `vault`, `5Gi`, same storage class and access mode as the PV) that binds to it.

<details><summary>Show solution</summary>

```bash
kubectl get pv archive-pv -o yaml | grep -E "storageClassName|accessModes|capacity|claimRef" -A2
kubectl patch pv archive-pv --type=json -p='[{"op":"remove","path":"/spec/claimRef"}]'
kubectl get pv archive-pv          # Available
```
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: archive-pvc
  namespace: vault
spec:
  storageClassName: <same as PV>
  accessModes: ["ReadWriteOnce"]
  volumeName: archive-pv
  resources:
    requests:
      storage: 5Gi
```
```bash
kubectl apply -f pvc.yaml
kubectl -n vault get pvc archive-pvc       # Bound
```
A `Released` PV keeps the old `claimRef`, so it will not bind again until that reference is cleared. `volumeName` pins the claim to this PV.

</details>

---

## Question 11 (6%)

**Domain:** Services & Networking

> Context: `kubectl config use-context cluster4`

Ingress `rewrite-ing` in namespace `docs` (class `nginx`, host `docs.example.com`) must send requests to `/docs/<anything>` to Service `docs-svc:80` with the prefix `/docs` removed (so `/docs/guide` reaches the backend as `/guide`). Also add an **exact** match for `/status` that goes to `status-svc:80` without rewriting.

<details><summary>Show solution</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rewrite-ing
  namespace: docs
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
  - host: docs.example.com
    http:
      paths:
      - path: /docs(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: docs-svc
            port:
              number: 80
```
The annotation applies to the whole Ingress, so put `/status` in a **second** Ingress without the annotation:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: status-ing
  namespace: docs
spec:
  ingressClassName: nginx
  rules:
  - host: docs.example.com
    http:
      paths:
      - path: /status
        pathType: Exact
        backend:
          service:
            name: status-svc
            port:
              number: 80
```
```bash
kubectl apply -f ing.yaml
curl -H "Host: docs.example.com" http://<ingress-ip>/docs/guide
```

</details>

---

## Question 12 (6%)

**Domain:** Services & Networking

> Context: `kubectl config use-context cluster4`

Use the Gateway API to do a canary release. HTTPRoute `canary` (namespace `prod`, attached to Gateway `prod-gw`, host `www.example.org`) must send 90% of traffic to Service `site-v1` and 10% to `site-v2`, both on port 80. Show the route's status conditions.

<details><summary>Show solution</summary>

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary
  namespace: prod
spec:
  parentRefs:
  - name: prod-gw
  hostnames: ["www.example.org"]
  rules:
  - backendRefs:
    - name: site-v1
      port: 80
      weight: 90
    - name: site-v2
      port: 80
      weight: 10
```
```bash
kubectl apply -f canary.yaml
kubectl -n prod get httproute canary
kubectl -n prod get httproute canary -o jsonpath='{.status.parents[0].conditions}'
kubectl -n prod describe httproute canary
```
Weights are relative (they do not need to add to 100). Healthy conditions are `Accepted=True` and `ResolvedRefs=True`.

</details>

---

## Question 13 (4%)

**Domain:** Services & Networking

> Context: `kubectl config use-context cluster4`

Namespace `locked` must deny **all** ingress and egress traffic by default, except that Pods labelled `app=frontend` may receive traffic on port 80 from anywhere in the cluster. Create the NetworkPolicies `default-deny` and `allow-frontend`.

<details><summary>Show solution</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: locked
spec:
  podSelector: {}
  policyTypes: ["Ingress","Egress"]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
  namespace: locked
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes: ["Ingress"]
  ingress:
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 80
```
```bash
kubectl apply -f np.yaml
kubectl -n locked get netpol
```
`podSelector: {}` selects every Pod in the namespace. An empty `namespaceSelector` means "all namespaces". Replies to allowed connections are permitted automatically.

</details>

---

## Question 14 (4%)

**Domain:** Services & Networking

> Context: `kubectl config use-context cluster4`

Create a NodePort Service `edge-np` (namespace `edge`, port 80, target 8080) for Pods labelled `app=edge` so that traffic keeps the client source IP (no extra hop). Then find out which proxy mode kube-proxy uses and save it to `/opt/answers/proxy-mode.txt`.

<details><summary>Show solution</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: edge-np
  namespace: edge
spec:
  type: NodePort
  externalTrafficPolicy: Local
  selector:
    app: edge
  ports:
  - port: 80
    targetPort: 8080
```
```bash
kubectl apply -f svc.yaml
kubectl -n kube-system get cm kube-proxy -o jsonpath='{.data.config\.conf}' | grep -E "^mode" 
kubectl -n kube-system logs -l k8s-app=kube-proxy --tail=50 | grep -i proxier
echo iptables > /opt/answers/proxy-mode.txt        # the value you found; empty mode means iptables
```
`externalTrafficPolicy: Local` keeps the source IP but only nodes that run a matching Pod answer on the node port.

</details>

---

## Question 15 (8%)

**Domain:** Troubleshooting

> Context: `kubectl config use-context cluster4`

The API server works, but `kubectl get nodes` takes long and the etcd Pod `etcd-controlplane` keeps restarting. Find the reason and fix it.

<details><summary>Show solution</summary>

```bash
kubectl -n kube-system describe pod etcd-controlplane
sudo -i
crictl ps -a | grep etcd
crictl logs <etcd-container-id> 2>&1 | tail -20
vi /etc/kubernetes/manifests/etcd.yaml
```
Common faults to look for in the log and manifest:
- `--data-dir` pointing to a directory that does not match the `etcd-data` hostPath
- wrong certificate paths (`--cert-file`, `--key-file`, `--trusted-ca-file`, `--peer-*`)
- wrong ports or `--listen-client-urls` / `--advertise-client-urls`
- a data directory with wrong ownership or permissions (`ls -ld /var/lib/etcd`)
```bash
ls -l /etc/kubernetes/pki/etcd
ls -ld /var/lib/etcd
```
After the fix, the kubelet recreates the Pod:
```bash
crictl ps | grep etcd
ETCDCTL_API=3 etcdctl endpoint health --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
```

</details>

---

## Question 16 (6%)

**Domain:** Troubleshooting

> Context: `kubectl config use-context cluster4`

kube-proxy Pods in `kube-system` are in `CrashLoopBackOff` and Services stop working on some nodes. Find the cause and fix it.

<details><summary>Show solution</summary>

```bash
kubectl -n kube-system get pods -l k8s-app=kube-proxy -o wide
kubectl -n kube-system logs <kube-proxy-pod>
kubectl -n kube-system describe ds kube-proxy
kubectl -n kube-system get cm kube-proxy -o yaml
```
Look for a wrong `kubeconfig` path in the ConfigMap or the command (`--config=/var/lib/kube-proxy/config.conf`), an unsupported `mode`, a bad `clusterCIDR`, or a changed image tag in the DaemonSet.
```bash
kubectl -n kube-system edit cm kube-proxy
kubectl -n kube-system edit ds kube-proxy
kubectl -n kube-system rollout restart ds kube-proxy
kubectl -n kube-system get pods -l k8s-app=kube-proxy
```
ConfigMap changes do not apply to running Pods until they are restarted.

</details>

---

## Question 17 (5%)

**Domain:** Troubleshooting

> Context: `kubectl config use-context cluster4`

Pod `private-app` (namespace `registry-test`) is in `ImagePullBackOff` pulling `registry.corp.example/team/app:2.1` from a private registry. The registry user is `deployer` with password `Pa55w0rd!` and email `ops@example.com`. Fix it so the Pod runs, without changing the image.

<details><summary>Show solution</summary>

```bash
kubectl -n registry-test describe pod private-app | tail -10       # "pull access denied" / unauthorized
kubectl -n registry-test create secret docker-registry corp-reg \
  --docker-server=registry.corp.example \
  --docker-username=deployer \
  --docker-password='Pa55w0rd!' \
  --docker-email=ops@example.com
kubectl -n registry-test get pod private-app -o yaml > pod.yaml
vi pod.yaml          # add under spec: imagePullSecrets: [{name: corp-reg}]
kubectl -n registry-test replace --force -f pod.yaml
kubectl -n registry-test get pod private-app
```
```yaml
spec:
  imagePullSecrets:
  - name: corp-reg
```
To apply the secret to every Pod in the namespace: `kubectl -n registry-test patch serviceaccount default -p '{"imagePullSecrets":[{"name":"corp-reg"}]}'`. Always check the registry host name matches the image path.

</details>

---

## Question 18 (6%)

**Domain:** Troubleshooting

> Context: `kubectl config use-context cluster4`

A Deployment `quota-app` in namespace `capped` is stuck at 0 of 3 replicas. `kubectl describe replicaset` shows that Pods are being rejected. Find the reason and fix it so all 3 Pods run, **without** deleting the ResourceQuota.

<details><summary>Show solution</summary>

```bash
kubectl -n capped get deploy,rs
kubectl -n capped describe rs -l app=quota-app | tail -10
kubectl -n capped describe quota
kubectl -n capped get limitrange
```
Typical messages: `exceeded quota: ... requested: limits.memory=1Gi, used: ..., limited: ...` or `must specify limits.cpu, requests.memory`. Fix by changing the **Pod template** so that every Pod sets resources and fits within the remaining quota:
```bash
kubectl -n capped edit deployment quota-app
```
```yaml
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
```
```bash
kubectl -n capped rollout status deployment quota-app
kubectl -n capped describe quota        # Used is within Hard
```
Add up `3 x limits.memory` to check the numbers fit the `Hard` value, and keep the quota as the task says.

</details>

---

## Question 19 (5%)

**Domain:** Troubleshooting

> Context: `kubectl config use-context cluster4`

Several Pods on node `kb3` were evicted and new Pods stay `Pending` for that node. `kubectl describe node kb3` shows a condition about **disk**. Find the problem and clear it so that the node can accept Pods again. You can ssh to the node.

<details><summary>Show solution</summary>

```bash
kubectl describe node kb3 | sed -n '/Conditions/,/Addresses/p'
kubectl describe node kb3 | grep -i taint        # node.kubernetes.io/disk-pressure
ssh kb3
sudo -i
df -h
du -xh /var --max-depth=2 2>/dev/null | sort -h | tail
crictl images
crictl rmi --prune
journalctl --vacuum-size=200M
```
Remove big unused files, unused images and old logs (never the data of running workloads). The kubelet removes the `disk-pressure` taint after usage drops below the eviction threshold:
```bash
exit; exit
kubectl describe node kb3 | grep -i -A8 Conditions     # DiskPressure False
kubectl get pods -A -o wide | grep kb3
```

</details>

---

*These solutions are written for practice. Always verify commands against the official documentation and your cluster version.*
