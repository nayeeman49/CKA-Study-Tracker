@@+ 03-Scheduling/03-Practice-Test-Manual-Scheduling
### Worked example

Scenario: Pod `nginx` is `Pending` and `kubectl describe pod nginx` shows **no Events**. Cause: no scheduler is running.

```bash
kubectl -n kube-system get pods | grep scheduler     # missing or crashing
kubectl get nodes                                    # controlplane, node01
kubectl get pod nginx -o yaml > nginx.yaml
sed -i '/^spec:/a\  nodeName: node01' nginx.yaml    # or edit with vi
kubectl replace --force -f nginx.yaml
kubectl get pod nginx -o wide                        # NODE = node01
```

### Common mistakes

- Putting `nodeName` under `containers` instead of `spec`.
- Using `kubectl edit` on a running Pod: `nodeName` cannot be changed, the edit is rejected.
- Typo in the node name, which leaves the Pod stuck.

### Exam angle

A question may say "the scheduler is not working, run Pod X on node Y": set `nodeName`, do not waste time fixing the scheduler unless asked.

@@+ 03-Scheduling/05-Practice-Test-Labels-and-Selectors
### Worked example

Count everything labelled `env=prod,bu=finance,tier=frontend`:

```bash
kubectl get all -l env=prod,bu=finance,tier=frontend --no-headers
kubectl get pods -l env=dev --no-headers | wc -l
kubectl get pods -A -l 'env in (prod,qa)' --show-labels
```

Fix a ReplicaSet whose selector doesn't match its template:

```bash
kubectl get rs replicaset-1 -o yaml | grep -A3 -E "selector|labels"
kubectl explain rs.spec.selector
```

Selector `tier: front-end` and template label `tier: nginx` is rejected with `selector does not match template labels`.

### Common mistakes

- Spaces after commas in `-l a=b, c=d` (no spaces allowed).
- Forgetting `-A` when the objects are in other namespaces.
- Assuming `get all` lists every kind (it omits ConfigMaps, Secrets, Ingresses...).

@@+ 03-Scheduling/10-Practice-Test-Node-Affinity
### Worked example

Task: Deployment `blue` (3 replicas) must run only on nodes labelled `color=blue`.

```bash
kubectl label node node01 color=blue
kubectl create deployment blue --image=nginx --replicas=3 --dry-run=client -o yaml > blue.yaml
```

Add under `spec.template.spec`:

```yaml
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: color
                operator: In
                values: [blue]
```

```bash
kubectl apply -f blue.yaml
kubectl get pods -o wide        # all on node01
```

For "controlplane" placement add `key: node-role.kubernetes.io/control-plane`, `operator: Exists`, plus a toleration for `node-role.kubernetes.io/control-plane:NoSchedule`.

### Common mistakes

- Putting `affinity` in the Deployment spec instead of the Pod template.
- Forgetting to label the node first, so Pods stay Pending.
- Mixing up `values` list syntax and quoting.

@@+ 03-Scheduling/13-Practice-Test-Resource-Limits
### Worked example

Pod `elephant` keeps restarting:

```bash
kubectl describe pod elephant
#  Last State: Terminated  Reason: OOMKilled  Exit Code: 137
#  Limits: memory 10Mi
```

Raise the limit:

```bash
kubectl get pod elephant -o yaml > e.yaml
sed -i 's/memory: 10Mi/memory: 20Mi/' e.yaml
kubectl replace --force -f e.yaml
kubectl get pod elephant -w
```

### Why this works

Memory is incompressible, so crossing the limit kills the container; CPU is compressible and only slows the process.

### Common mistakes

- Increasing the **request** but not the **limit**.
- Writing `memory: 20m` (milli-bytes) instead of `20Mi`.
- Setting a request above any node's capacity, leaving the Pod Pending.

@@+ 03-Scheduling/15-Practice-Test-DaemonSets
### Worked example

```bash
kubectl create deployment elasticsearch --image=registry.k8s.io/fluentd-elasticsearch:1.20 \
  -n kube-system --dry-run=client -o yaml > ds.yaml
```

Edit the file: change `kind: Deployment` to `DaemonSet`, delete `replicas: 1` and `strategy: {}`, and keep the `selector` and template labels equal.

```bash
kubectl apply -f ds.yaml
kubectl get ds -n kube-system
kubectl get pods -n kube-system -o wide | grep elasticsearch   # one per node
```

### Common mistakes

- Leaving `replicas` in the YAML (DaemonSets reject it).
- Forgetting `-n kube-system` when the task asks for it.
- Expecting a Pod on the control plane node without a toleration.

@@+ 03-Scheduling/17-Practice-Test-StaticPods
### Worked example

Create a static Pod `static-busybox` on the control plane node:

```bash
kubectl run static-busybox --image=busybox --command --dry-run=client -o yaml -- sleep 1000 \
  > /etc/kubernetes/manifests/static-busybox.yaml
kubectl get pods                      # static-busybox-controlplane
```

Delete a static Pod running on another node:

```bash
kubectl get pods -o wide              # find the node, e.g. node01
ssh node01
grep staticPodPath /var/lib/kubelet/config.yaml
rm /etc/kubernetes/manifests/static-greenbox.yaml
```

### Common mistakes

- Running `kubectl delete pod` on a static Pod (it comes straight back).
- Editing the manifest on the wrong node.
- Using the `-o yaml` output of a running Pod (it contains status and nodeName); generate fresh YAML instead.

@@+ 03-Scheduling/19-Practice-Test-Multiple-Schedulers
### Worked example

```bash
cp /etc/kubernetes/manifests/kube-scheduler.yaml /root/my-scheduler.yaml
```

Edit the copy: `name: my-scheduler`, add `--scheduler-name=my-scheduler` (or a config file with the profile name), `--leader-elect=false` (or set a different `--lock-object-name=my-scheduler`), and change the ports (`--secure-port=10260`) so they don't clash with the default one. Move it out of the manifests folder and create it as a normal Pod in `kube-system`, then:

```bash
kubectl apply -f my-scheduler.yaml
kubectl -n kube-system get pods | grep my-scheduler
```

A Pod that uses it:

```yaml
spec:
  schedulerName: my-scheduler
```

Confirm: `kubectl get events -o wide | grep my-scheduler` or `kubectl describe pod` (Scheduled by my-scheduler).

### Common mistakes

- Leaving the copy in `/etc/kubernetes/manifests` (it becomes a second static Pod fighting for ports).
- Reusing the default scheduler's name.

@@+ 04-Logging-and-Monitoring/03-Practice-Test-Monitor-Cluster-Components
### Worked example

```bash
kubectl top node --sort-by=cpu --no-headers | head -1        # busiest node
kubectl top pod -A --sort-by=memory --no-headers | head -1   # hungriest Pod
kubectl top pod -A --sort-by=cpu --no-headers | tail -1      # least CPU
```

### If metrics are missing

```bash
kubectl -n kube-system get deploy metrics-server
kubectl -n kube-system logs deploy/metrics-server
kubectl get apiservice v1beta1.metrics.k8s.io       # Available should be True
```

### Common mistakes

- Querying before the first scrape (about a minute).
- Forgetting `-A` for Pods in other namespaces.

@@+ 04-Logging-and-Monitoring/06-Practice-Test-Managing-Application-Logs
### Worked example

```bash
kubectl get pods
kubectl logs webapp-1 | grep -i fail
kubectl get pod webapp-2 -o jsonpath='{.spec.containers[*].name}'
kubectl logs webapp-2 -c simple-webapp --tail=20
```

Example finding: "USER5 Failed to Login as the account is locked due to multiple attempts." Answer: the user is `USER5`; the reason is a locked account.

### Common mistakes

- Reading the wrong container's logs in a multi-container Pod.
- Looking at logs of a restarted container; use `--previous` to see the crashed one.

@@+ 05-Application-Lifecycle-Management/03-Practice-Test-RollingUpdates-Rollback
### Worked example

```bash
kubectl get deploy frontend -o jsonpath='{.spec.strategy}{"\n"}'
kubectl set image deploy/frontend simple-webapp=kodekloud/webapp-color:v2
kubectl rollout status deploy/frontend
kubectl rollout history deploy/frontend
kubectl set image deploy/frontend simple-webapp=kodekloud/webapp-color:v3    # bad tag
kubectl rollout status deploy/frontend --timeout=30s                          # stuck
kubectl rollout undo deploy/frontend
```

Switching to Recreate:

```bash
kubectl edit deploy frontend
# strategy:
#   type: Recreate        (delete the whole rollingUpdate: block)
```

### Common mistakes

- Using the Deployment name instead of the **container** name in `set image`.
- Leaving `rollingUpdate:` under `type: Recreate` (validation error).

@@+ 05-Application-Lifecycle-Management/06-Practice-Test-Commands-and-Arguments
### Worked example

Dockerfile: `ENTRYPOINT ["python","app.py"]`, `CMD ["--color","red"]`. Pod needs green:

```yaml
spec:
  containers:
  - name: webapp-green
    image: kodekloud/webapp-color
    args: ["--color","green"]
```

Imperative: `kubectl run webapp-green --image=kodekloud/webapp-color -- --color green`.

Ubuntu sleeper with a custom delay:

```yaml
    command: ["sleep"]
    args: ["5000"]
```

### Common mistakes

- Unquoted numbers in `args`.
- Putting flags and values in one string (`"--color green"`) instead of separate list items.
- Trying to edit `command` on a live Pod.

@@+ 05-Application-Lifecycle-Management/09-Practice-Test-Env-Variables
### Worked example

```bash
kubectl create configmap webapp-config-map --from-literal=APP_COLOR=darkblue --from-literal=APP_OTHER=disregard
kubectl get pod webapp-color -o yaml > p.yaml
```

Add to the container:

```yaml
    env:
    - name: APP_COLOR
      valueFrom:
        configMapKeyRef:
          name: webapp-config-map
          key: APP_COLOR
```

```bash
kubectl replace --force -f p.yaml
kubectl exec webapp-color -- printenv APP_COLOR
```

### Common mistakes

- Wrong `key` name (case sensitive).
- Pod in `CreateContainerConfigError` because the ConfigMap doesn't exist in that namespace.

@@+ 05-Application-Lifecycle-Management/11.Practice-Test-Secrets
### Worked example

```bash
kubectl create secret generic db-secret --from-literal=DB_Host=sql01 --from-literal=DB_User=root --from-literal=DB_Password=password123
kubectl get pod webapp-pod -o yaml > w.yaml
```

```yaml
    envFrom:
    - secretRef:
        name: db-secret
```

```bash
kubectl replace --force -f w.yaml
kubectl exec webapp-pod -- printenv | grep DB_
kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d
```

### Common mistakes

- Base64-encoding a value and then also using `--from-literal` (double encoding).
- Forgetting `echo -n` when encoding by hand.

@@+ 05-Application-Lifecycle-Management/13-Practice-Test-Multi-Container-Pods
### Worked example

A Pod needs `lemon` (busybox) plus `gold` (redis):

```yaml
spec:
  containers:
  - name: lemon
    image: busybox
    command: ["sleep","1000"]
  - name: gold
    image: redis
```

A sidecar shipping logs, sharing an `emptyDir`:

```yaml
  containers:
  - name: app
    image: kodekloud/event-simulator
    volumeMounts: [{name: log-volume, mountPath: /log}]
  - name: sidecar
    image: kodekloud/filebeat-configured
    volumeMounts: [{name: log-volume, mountPath: /var/log/event-simulator/}]
  volumes:
  - name: log-volume
    emptyDir: {}
```

### Common mistakes

- Trying to add a container to a running Pod (recreate it).
- Two containers using the same port.

@@+ 05-Application-Lifecycle-Management/16-Practice-Test-Init-Containers
### Worked example

```bash
kubectl get pod red
#  NAME  READY  STATUS     RESTARTS
#  red   0/1    Init:0/1   0
kubectl describe pod red | sed -n '/Init Containers/,/Containers:/p'
kubectl logs red -c init-myservice
```

If the init container waits for a Service, create it so DNS resolves; if the command has a typo (`sleeeep`), fix and recreate:

```bash
kubectl get pod orange -o yaml > o.yaml ; vi o.yaml
kubectl replace --force -f o.yaml
```

### Common mistakes

- Looking at `kubectl logs red` (main container) rather than `-c <init container>`.
- Expecting the Pod to be Running while init containers are still working.

@@+ 06-Cluster-Maintenance/03-Practice-Test-OS-Upgrades
### Worked example

```bash
kubectl get pods -o wide                      # where do Pods run?
kubectl drain node01 --ignore-daemonsets
kubectl get nodes                             # node01 Ready,SchedulingDisabled
kubectl get pods -o wide                      # recreated on other nodes
kubectl uncordon node01
```

A bare Pod `hr-app` on the node:

```bash
kubectl drain node01 --ignore-daemonsets
# error: cannot delete Pods declare no controller (use --force)
kubectl drain node01 --ignore-daemonsets --force      # hr-app is gone for good
```

Use `cordon` instead when you only want to stop new Pods landing there.

### Common mistakes

- Forgetting `uncordon` afterwards.
- Forgetting `--ignore-daemonsets` (the drain refuses).
- Expecting Pods to move back after uncordon.

@@+ 06-Cluster-Maintenance/09-Practice-Test-Backup-and-Restore-Methods
### Worked example

```bash
kubectl -n kube-system describe pod etcd-controlplane | grep -E "Image:|--data-dir|--listen-client|--cert-file|--key-file|--trusted-ca"
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/snapshot-pre-boot.db
etcdutl snapshot restore /opt/snapshot-pre-boot.db --data-dir /var/lib/etcd-from-backup
vi /etc/kubernetes/manifests/etcd.yaml      # hostPath of etcd-data -> /var/lib/etcd-from-backup
```

Wait for etcd and the API server to restart (`watch crictl ps`), then check that the objects from the snapshot exist and later ones are gone.

### Common mistakes

- Changing `--data-dir` and mountPath as well (only the hostPath changes in the standard solution).
- Running restore with the certificate flags (not needed) or forgetting `--data-dir`.
- Reading from the API before it has recovered.

@@+ 07-Security/04-TLS-Certificates
### Certificate roles at a glance

| Who | Presents | Verified against |
|---|---|---|
| kube-apiserver (as server) | `apiserver.crt` | cluster CA |
| kubectl / admin | `admin` client cert | cluster CA |
| scheduler, controller manager, kube-proxy | client certs | cluster CA |
| kube-apiserver → etcd | `apiserver-etcd-client.crt` | etcd CA |
| kube-apiserver → kubelet | `apiserver-kubelet-client.crt` | cluster CA |
| kubelet (server) | kubelet serving cert | cluster CA |

### Why it breaks

Typical TLS failures in Kubernetes: expired cert, wrong CA, missing SAN (name or IP not listed), wrong file path in a manifest. The error text usually says `x509: certificate ...`.

```bash
kubeadm certs check-expiration
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -issuer -dates
```

@@+ 07-Security/10-Practice-Test-View-Certificate-Details
### Worked example

Find the SANs of the API server certificate and its expiry:

```bash
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A1 "Alternative Name"
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -enddate
openssl x509 -in /etc/kubernetes/pki/etcd/server.crt -noout -subject
```

If ETCD won't start: `grep -E "cert-file|key-file|trusted-ca" /etc/kubernetes/manifests/etcd.yaml`, then `ls /etc/kubernetes/pki/etcd` and fix any name that doesn't exist (for example `server-certificate.crt`).

### Common mistakes

- Reading the wrong CA (ETCD has its own under `pki/etcd`).
- Not waiting for the kubelet to restart the static Pod after a manifest change.

@@+ 07-Security/12-Practice-Test-Certificates-API
### Worked example

```bash
cat akshay.csr | base64 -w 0
```

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: akshay
spec:
  groups: [system:authenticated]
  signerName: kubernetes.io/kube-apiserver-client
  usages: [client auth]
  request: <paste base64>
```

```bash
kubectl apply -f akshay.yaml
kubectl get csr
kubectl certificate approve akshay
kubectl get csr agent-smith -o yaml | grep -A3 groups      # requests system:masters?
kubectl certificate deny agent-smith
```

### Common mistakes

- Line breaks inside the base64 string.
- Forgetting `signerName`.

@@+ 07-Security/14-Practice-Test-KubeConfig
### Worked example

```bash
kubectl config view --kubeconfig /root/my-kube-config
kubectl config get-contexts --kubeconfig /root/my-kube-config
kubectl config use-context research --kubeconfig /root/my-kube-config
kubectl config current-context --kubeconfig /root/my-kube-config
```

Make it the default:

```bash
cp /root/my-kube-config /root/.kube/config
```

Broken `kubectl get pods` ("unable to read certificate-authority ..."): compare the `certificate-authority:` path in `~/.kube/config` with `ls /etc/kubernetes/pki/` and fix the filename.

### Common mistakes

- Setting `KUBECONFIG` in one shell and testing in another.
- Using `use-context` without `--kubeconfig` when a non-default file is meant.

@@+ 07-Security/18-Practice-Test-RBAC
### Worked example

User `dev-user` must create, list and delete Pods in `default`, and manage Deployments:

```bash
kubectl create role developer --verb=create,list,delete --resource=pods
kubectl create rolebinding dev-user-binding --role=developer --user=dev-user
kubectl auth can-i delete pods --as dev-user
kubectl auth can-i create deployments --as dev-user       # no
kubectl edit role developer       # add apiGroups: ["apps"], resources: ["deployments"]
```

Inspect an existing grant:

```bash
kubectl describe rolebinding kube-proxy -n kube-system
kubectl describe role kube-proxy -n kube-system
```

### Common mistakes

- Role created in the wrong namespace.
- Missing `apps` group for Deployments.
- Using `--user=dev-user` on a role instead of a binding.

@@+ 07-Security/20-Practice-Test-Cluster-Roles
### Worked example

```bash
kubectl create clusterrole nodeadmin --verb=get,watch,list,create,delete --resource=nodes
kubectl create clusterrolebinding michelle-binding --clusterrole=nodeadmin --user=michelle
kubectl auth can-i list nodes --as michelle           # yes
kubectl auth can-i delete pods --as michelle          # no
```

Add storage rights later:

```bash
kubectl create clusterrole storage-admin --resource=persistentvolumes,storageclasses --verb=get,watch,list,create,delete
kubectl create clusterrolebinding michelle-storage-admin --user=michelle --clusterrole=storage-admin
```

### Common mistakes

- Using Role/RoleBinding for nodes or PVs (cluster scoped).
- Forgetting the binding after creating the role.

@@+ 07-Security/22-Practice-Test-Service-Accounts
### Worked example

```bash
kubectl create serviceaccount dashboard-sa
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding dashboard-sa-binding --role=pod-reader --serviceaccount=default:dashboard-sa
kubectl set serviceaccount deploy/web-dashboard dashboard-sa
kubectl create token dashboard-sa --duration=24h
kubectl auth can-i list pods --as system:serviceaccount:default:dashboard-sa
```

### Common mistakes

- Using `--user` instead of `--serviceaccount namespace:name`.
- Editing a bare Pod's `serviceAccountName` (immutable; recreate it).

@@+ 07-Security/24-Practice-Test-Image-Security
### Worked example

```bash
kubectl create secret docker-registry private-reg-cred \
  --docker-username=dock_user --docker-password=dock_password \
  --docker-server=myprivateregistry.com:5000 --docker-email=dock_user@myprivateregistry.com
kubectl edit deploy web
```

```yaml
    spec:
      imagePullSecrets:
      - name: private-reg-cred
      containers:
      - name: nginx
        image: myprivateregistry.com:5000/nginx:alpine
```

```bash
kubectl rollout status deploy/web
```

### Common mistakes

- Secret created in a different namespace.
- Putting `imagePullSecrets` under the container instead of the Pod spec.

@@+ 07-Security/26-Practice-Test-Security-Context
### Worked example

Run `ubuntu-sleeper` as user 1010 and add `SYS_TIME`:

```yaml
spec:
  securityContext:
    runAsUser: 1010
  containers:
  - name: ubuntu
    image: ubuntu
    command: ["sleep","4800"]
    securityContext:
      capabilities:
        add: ["SYS_TIME"]
```

```bash
kubectl replace --force -f p.yaml
kubectl exec ubuntu-sleeper -- id
kubectl exec ubuntu-sleeper -- date -s "12:00"       # works only with SYS_TIME
```

### Common mistakes

- Putting `capabilities` at the Pod level (invalid).
- Quoting UID as a string.

@@+ 07-Security/28-Practice-Test-Network-Policies
### Worked example

Allow only `internal` Pods to reach `payroll` on port 8080, and nothing else:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: internal-policy
spec:
  podSelector:
    matchLabels:
      name: payroll
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: internal
    ports:
    - protocol: TCP
      port: 8080
```

```bash
kubectl exec internal -- curl -m 3 payroll:8080     # works
kubectl exec external -- curl -m 3 payroll:8080     # times out
```

### Common mistakes

- Writing `podSelector` under `from` at the wrong indentation (AND vs OR).
- Selecting the wrong Pods in the policy's top-level `podSelector`.

@@+ 08-Storage/04-Volume-Driver-Plugins-in-Docker
### Why this matters for Kubernetes

Docker's volume plugins hid storage details behind a driver. Kubernetes took the same idea further: instead of each runtime having plugins, the **CSI** standard lets any vendor ship a driver that works in any orchestrator. When you see `provisioner: ebs.csi.aws.com` in a StorageClass, that's the descendant of a Docker volume driver.

```
Docker:       container ─► volume driver (rexray/ebs) ─► cloud disk
Kubernetes:   Pod ─► PVC ─► StorageClass ─► CSI driver ─► cloud disk
```

@@+ 08-Storage/10-Practice-Test-Persistent-Volume-Claims
### Worked example

```yaml
apiVersion: v1
kind: PersistentVolume
metadata: {name: pv-log}
spec:
  capacity: {storage: 100Mi}
  accessModes: [ReadWriteMany]
  persistentVolumeReclaimPolicy: Retain
  hostPath: {path: /pv/log}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: claim-log-1}
spec:
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 50Mi}}
```

The claim above stays `Pending`: the PV offers `ReadWriteMany` only. Change the claim to `ReadWriteMany` (PVCs can't be edited, so delete and recreate) and it binds.

```bash
kubectl get pv,pvc
kubectl delete pvc claim-log-1          # PV becomes Released (Retain)
```

### Common mistakes

- Different `storageClassName` on PV and PVC.
- Requesting more storage than the PV offers.

@@+ 08-Storage/13-Practice-Test-Storage-Class
### Worked example

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {name: delayed-volume-sc}
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

```bash
kubectl get pvc local-pvc          # Pending (waiting for first consumer) - normal
kubectl apply -f nginx-pod.yaml    # uses the PVC
kubectl get pvc,pv                 # Bound once the Pod is scheduled
```

### Common mistakes

- Treating a `WaitForFirstConsumer` Pending PVC as an error.
- Forgetting that `no-provisioner` needs a PV created by hand.

@@+ 09-Networking/01-Networking-Introduction
### What you must be able to do by the end of this section

1. Explain how Pods get IP addresses and reach each other across nodes (CNI).
2. Explain what a ClusterIP is and how kube-proxy implements it.
3. Resolve Services by DNS and fix CoreDNS problems.
4. Expose applications with NodePort, Ingress or Gateway API.
5. Write NetworkPolicies (covered in Security).
6. Troubleshoot connectivity layer by layer.

### Connectivity debug ladder

```
 Pod → Pod IP        (CNI)
 Pod → Service IP    (kube-proxy, endpoints)
 Pod → Service name  (CoreDNS)
 outside → app       (NodePort / Ingress / Gateway)
```

Test from the bottom up and stop at the first layer that fails.

@@+ 09-Networking/04-Pre-requisite-CoreDNS
### Worked example: a tiny local DNS server

```
# Corefile
. {
    hosts /tmp/hosts {
        fallthrough
    }
    forward . 8.8.8.8
    log
}
```

```
# /tmp/hosts
192.168.1.10   web.example.test
```

```bash
./coredns -conf Corefile
dig @127.0.0.1 web.example.test
```

Plugins run in the order defined by CoreDNS (not the file order), `fallthrough` passes unanswered queries on, and `forward` sends them upstream. In Kubernetes the same Corefile lives in the `coredns` ConfigMap.

@@+ 09-Networking/09-Practice-Test-Explore-Env
### Worked example

```bash
kubectl get nodes -o wide                    # INTERNAL-IP 192.168.121.x
ip -o -4 addr show | grep 192.168.121        # interface eth0
ip link show eth0 | grep link/ether          # MAC
ip route | grep default                      # gateway
ss -tlnp | grep -E "kube-sched|etcd"
```

Ports: scheduler 10259, controller manager 10257, etcd 2379 (client) and 2380 (peer). The etcd client port has more connections because every API server connects to it.

@@+ 09-Networking/13-Practice-Test-CNI-weave
### Worked example

```bash
ls /etc/cni/net.d/                      # 10-weave.conflist
grep -E '"type"' /etc/cni/net.d/*.conflist
ls /opt/cni/bin | head
ps aux | grep kubelet | grep -o "container-runtime-endpoint=[^ ]*"
kubectl -n kube-system get pods | grep weave
```

The plugin binary a Pod uses is the one named by `type` (for Weave: `weave-net`, plus `weave-ipam`).

@@+ 09-Networking/14-Practice-Test-Deploy-Network-Solution
### Worked example

Symptoms: new Pods stay in `ContainerCreating`; `kubectl describe pod` shows `network plugin is not ready: cni config uninitialized`.

```bash
ls /etc/cni/net.d            # empty
kubectl apply -f weave-daemonset.yaml
kubectl -n kube-system get pods -l name=weave-net
kubectl get pods             # now Running
```

Check the Pod CIDR (`kubectl cluster-info dump | grep -m1 cluster-cidr`) and set `IPALLOC_RANGE` in the weave container env if the default range overlaps with your nodes.

### Common mistakes

- Applying a manifest meant for a different Kubernetes version.
- Leaving a previous CNI config in `/etc/cni/net.d` (the first file alphabetically wins).

@@+ 09-Networking/16-Practice-Test-Networking-weave
### Worked example

```bash
kubectl -n kube-system get pods -o wide | grep weave        # one per node
kubectl -n kube-system logs weave-net-xxxxx -c weave | grep -i ipalloc
ip addr show weave                                          # bridge IP on the node
kubectl run busybox --image=busybox --command -- sleep 1000
kubectl get pod busybox -o wide                             # node + Pod IP
ip route | grep weave
```

The default gateway inside Pods on a node is the weave bridge address on that node.

@@+ 09-Networking/18-Practice-Test-Service-Networking
### Worked example

```bash
ip addr show eth0                                              # node network
kubectl cluster-info dump | grep -m1 service-cluster-ip-range
kubectl -n kube-system logs ds/kube-proxy | grep -i proxier     # "Using iptables Proxier"
iptables -t nat -L KUBE-SERVICES -n | head
```

Rules show the Service IP, port and the chain that leads to Pod endpoints.

### Common mistakes

- Confusing the Pod CIDR with the Service CIDR.
- Looking for kube-proxy as a systemd service (it's a DaemonSet in kubeadm clusters).

@@+ 09-Networking/21-Practice-Test-CoreDNS-in-Kubernetes
### Worked example

```bash
kubectl -n kube-system get deploy coredns
kubectl -n kube-system get cm coredns -o jsonpath='{.data.Corefile}'
kubectl exec -it hr -- nslookup mysql.payroll > /root/CKA/nslookup.out
kubectl get pod webapp -o yaml | grep -A2 DB_Host
kubectl set env deploy/webapp DB_Host=mysql.payroll
```

The `hr` Pod in a different namespace needs `mysql.payroll` (or the full `mysql.payroll.svc.cluster.local`); plain `mysql` only works in the same namespace.

@@+ 09-Networking/24-Practice-Test-CKA-Ingress-Net-1
### Worked example

```bash
kubectl get svc -n app-space                     # wear-service:8080, video-service:8080
kubectl create ingress ingress-wear-watch -n app-space \
  --rule="/wear=wear-service:8080" --rule="/watch=video-service:8080" \
  --annotation nginx.ingress.kubernetes.io/rewrite-target=/ \
  --annotation nginx.ingress.kubernetes.io/ssl-redirect=false
kubectl describe ingress -n app-space
curl http://<node-ip>:<node-port>/wear
```

### Common mistakes

- Wrong Service port.
- Ingress in a namespace different from its Services.
- Missing `rewrite-target` when the app serves at `/`.

@@+ 09-Networking/25-Practice-Test-CKA-Ingress-Net-2
### Worked example

```bash
kubectl create ns ingress-nginx
kubectl apply -f ingress-controller.yaml
kubectl -n ingress-nginx get deploy,svc          # NodePort 30080
kubectl get ingressclass
kubectl create ingress shop -n app-space --class=nginx --rule="/pay=pay-service:8282"
curl -I http://<node-ip>:30080/pay
```

If `curl` returns 404 from nginx, check the path; 503 means the Service has no ready endpoints; connection refused means the controller Service isn't exposed.

@@+ 11-Install-Kubernetes-the-kubeadm-way/02-Resources
### How to use the docs in the exam

The Kubernetes documentation (kubernetes.io/docs) is available. Bookmark-style paths worth remembering:

| Task | Search for |
|---|---|
| Install / init cluster | "creating a cluster with kubeadm" |
| Upgrade | "upgrading kubeadm clusters" |
| ETCD backup | "operating etcd clusters" |
| NetworkPolicy | "network policies" |
| PV/PVC | "configure a pod to use a persistent volume" |
| Ingress | "ingress" |
| RBAC | "using RBAC authorization" |
| Static Pods | "create static pods" |

Practise reaching each page in under 30 seconds.

@@+ 11-Install-Kubernetes-the-kubeadm-way/03-Provision-VMs-with-Vagrant
### What the lab VMs look like

| VM | Role | Typical IP |
|---|---|---|
| kubemaster | control plane | 192.168.56.11 |
| kubenode01 | worker | 192.168.56.21 |
| kubenode02 | worker | 192.168.56.22 |

### After `vagrant up`

```bash
vagrant ssh kubemaster
hostname -I ; ping -c1 192.168.56.21
```

Note the host-only network IP: use it as `--apiserver-advertise-address` (not the NAT address `10.0.2.15` that every Vagrant VM shares).

### Common mistakes

- Using the NAT interface IP for the API server.
- Starting too many VMs for the host's RAM.

@@+ 11-Install-Kubernetes-the-kubeadm-way/05-Practice-Test-Deploy-Kubernetes-Cluster-using-Kubeadm
### Worked example

```bash
# controlplane
kubeadm init --apiserver-advertise-address=$(hostname -I | awk '{print $1}') --pod-network-cidr=10.244.0.0/16
mkdir -p ~/.kube && cp /etc/kubernetes/admin.conf ~/.kube/config
kubectl apply -f kube-flannel.yml
kubeadm token create --print-join-command
# node01
kubeadm join <ip>:6443 --token ... --discovery-token-ca-cert-hash sha256:...
# controlplane
kubectl get nodes -w
```

### Common mistakes

- Pod CIDR in the CNI manifest not matching `--pod-network-cidr`.
- Running `kubeadm join` before the control plane is ready.
- Forgetting to copy `admin.conf`.

@@+ 12-Troubleshooting/05-Practice-Test-Control-Plane-Failure
### Worked example

Pods stay Pending, scaling does nothing:

```bash
kubectl get pods -n kube-system
# kube-scheduler-controlplane   CrashLoopBackOff
kubectl -n kube-system logs kube-scheduler-controlplane
# ... unable to read config / invalid path
vi /etc/kubernetes/manifests/kube-scheduler.yaml        # fix --kubeconfig=/etc/kubernetes/scheduler.conf
kubectl -n kube-system get pods -w
```

Then:

```bash
kubectl scale deploy app --replicas=3         # no new Pods
kubectl -n kube-system logs kube-controller-manager-controlplane
vi /etc/kubernetes/manifests/kube-controller-manager.yaml   # hostPath /etc/kubernetes/pki
```

### Common mistakes

- Fixing the flag but not the volume mount, or the reverse.
- Not waiting for the kubelet to recreate the Pod.

@@+ 12-Troubleshooting/06-Solution-Control-Plane-Failure
### Order of checks

1. `kubectl get pods -n kube-system` (which Pod is not Running?).
2. `kubectl logs` / `crictl logs` (what exactly is wrong?).
3. Compare the manifest against reality: `ls` every path it names.
4. Edit, save, wait, verify with a functional test (scale a Deployment, create a Pod).

A functional test matters: a Pod can be `Running` while still misconfigured.

@@+ 12-Troubleshooting/08-Practice-Test-Worker-Node-Failure
### Worked example

```bash
kubectl get nodes                       # node01 NotReady
ssh node01
systemctl status kubelet                # inactive (dead)
systemctl start kubelet ; systemctl enable kubelet
journalctl -u kubelet -n 30             # still failing? read the error
vi /var/lib/kubelet/config.yaml         # fix clientCAFile path
systemctl restart kubelet
exit ; kubectl get nodes
```

@@+ 12-Troubleshooting/09-Solution-Worker-Node-Failure
### Fault catalogue

| Log message | Fix |
|---|---|
| `failed to load Kubelet config file` | correct path in the systemd drop-in |
| `unable to load client CA file ... no such file` | fix `clientCAFile` in `config.yaml` |
| `dial tcp ...:6553: connection refused` | change port to 6443 in `kubelet.conf` |
| `container runtime is not running` | start containerd |

After changes: `systemctl daemon-reload` (for unit files) and `systemctl restart kubelet`.

@@+ 13-Other-Topics/01-Labs-JSON-PATH
### Practice set

```bash
kubectl get pods -o jsonpath='{.items[0].spec.containers[0].image}'
kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}'
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.nodeName}{"\n"}{end}'
kubectl get deploy -A -o jsonpath='{.items[*].spec.template.spec.containers[*].image}' | tr ' ' '\n' | sort -u
```

Debug trick: an empty result usually means a wrong key, a missing `.items` (list vs single object) or `[0]` vs `[*]` mix-up.

@@+ 13-Other-Topics/03-Advance-Kubectl-Commands
### Output cheat sheet

| Need | Flag |
|---|---|
| Wider columns | `-o wide` |
| Names only | `-o name` |
| Own columns | `-o custom-columns=A:.path` |
| Single value | `-o jsonpath='{...}'` |
| Sort | `--sort-by=.path` |
| Filter on fields | `--field-selector` |
| No header | `--no-headers` |

Combine with `wc -l`, `awk`, `sort -u` for quick answers.

@@+ 13-Other-Topics/04-Practice-Test-Advance-Kubectl-Commands
### Verify your answers

```bash
cat /opt/outputs/node_names.txt
wc -w /opt/outputs/node_names.txt
kubectl get nodes --no-headers | wc -l      # should match
```

Output files must hold only the requested data: no headers, no extra blank lines unless the task specifies a format.

@@+ 14-Lightning-Labs/01-Lightning-Labs-Introduction
### Exam-style time plan

| Minutes | Activity |
|---|---|
| 0-5 | Aliases, completion, read all questions, note weights |
| 5-90 | Solve in order of (weight / difficulty) |
| 90-110 | Return to skipped questions |
| 110-120 | Verify results |

Flag any question you can't do in about 8 minutes and move on.

@@+ 14-Lightning-Labs/02-Lightning-Lab-1
### Worked snippets

```bash
# rolling update + rollback
kubectl create deploy web --image=nginx:1.26 --replicas=3
kubectl set image deploy/web nginx=nginx:1.27
kubectl rollout undo deploy/web
# pod with command and emptyDir shared by two containers
kubectl run multi --image=busybox --dry-run=client -o yaml --command -- sleep 3600 > multi.yaml
# etcd snapshot
ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=... --cert=... --key=... snapshot save /opt/backup.db
```

Verify each answer with `kubectl get` and `kubectl describe` before moving on.

@@+ 16-Ultimate-Mocks/02-Troubleshooting/docs/11-C1-orange-pvc-cka13-trb
### Typical error messages

| Message | Meaning |
|---|---|
| `persistentvolumeclaim "orange-pvc" not found` | PVC missing/wrong name/namespace |
| `waiting for first consumer` | WaitForFirstConsumer; normal until a Pod uses it |
| `no persistent volumes available for this claim` | Size, class or mode mismatch |
| `Multi-Attach error` | RWO volume still attached to another node |

@@+ 16-Ultimate-Mocks/02-Troubleshooting/docs/19-C1-netpol-cyan-pod-cka28-trb
### Checklist

1. Which Pods does the policy select (`podSelector`)?
2. Which directions are restricted (`policyTypes`)?
3. Does the client match a `from` entry (labels, namespace labels)?
4. Is the port correct?
5. Is egress from the client blocked by another policy?

@@+ 16-Ultimate-Mocks/04-Storage/docs/10-CI-olive-pvc-cka10-str
### Example manifests

```yaml
apiVersion: v1
kind: PersistentVolume
metadata: {name: olive-pv}
spec:
  capacity: {storage: 1Gi}
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  hostPath: {path: /mnt/olive}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: olive-pvc}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  resources: {requests: {storage: 500Mi}}
```

@@+ 16-Ultimate-Mocks/05-Services-Networking/docs/03-C3-External-Webserver
### Choosing between the options

| Need | Use |
|---|---|
| External server has a fixed IP | Service without selector + Endpoints |
| External server has a DNS name | `ExternalName` |

`ExternalName` doesn't work with IP addresses and doesn't proxy ports; it only returns a CNAME.

@@+ 16-Ultimate-Mocks/09-general/docs/01-cluster-state-questions
### More one-liners

```bash
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.kubeletVersion}'
kubectl get pods -A --field-selector=status.phase!=Running
kubectl api-resources --namespaced=false | wc -l
kubectl -n kube-system get cm kubeadm-config -o yaml | grep -E "podSubnet|serviceSubnet"
```

@@+ 17-tips-and-tricks/docs/01-server-for-testing-network-policies
### Example test matrix

| Client | Namespace | Expect (policy allows `role=frontend` only) |
|---|---|---|
| `client` (role=frontend) | same | works |
| `client2` (role=other) | same | timeout |
| client from other namespace | other | timeout unless namespaceSelector |

@@+ 17-tips-and-tricks/docs/02-client--for-testing-network-things
### Handy one-liners

```bash
kubectl exec client -- wget -qO- -T2 http://server.default.svc.cluster.local
kubectl exec client -- nc -zvw2 server 80
kubectl exec client -- cat /etc/resolv.conf
```
