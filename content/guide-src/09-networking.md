@@ 09-Networking/01-Networking-Introduction
### What this section covers
Networking prerequisites (switching, routing, DNS, namespaces, Docker networking, CNI) followed by how Kubernetes builds Pod, Service and DNS networking on top.

### Commands to know
```
ip link                      # interfaces
ip addr show / ip addr add 192.168.1.10/24 dev eth0
ip route / ip route add 192.168.2.0/24 via 192.168.1.1
ip netns                     # network namespaces
ss -tlnp  (or netstat -natulp)   # listening ports
cat /proc/sys/net/ipv4/ip_forward
```
### Exam angle
You rarely type these in the exam, but you read them to debug: which CNI is installed, which port the scheduler/etcd listens on, whether a node can reach the API server. Section order: prerequisites → cluster/Pod networking → Services → DNS → Ingress.

@@ 09-Networking/02-Pre-requisite-Switching-Routing-Gateways
### Concepts
- A **switch** connects hosts on one network (same subnet); each host has an interface (`eth0`) with an IP.
- A **router** connects networks; a host reaches another network through a **gateway** (the router's address on its own network). Without a route, traffic goes nowhere.
- To make a Linux host forward packets between interfaces: `echo 1 > /proc/sys/net/ipv4/ip_forward` (persist in `/etc/sysctl.conf`).

### How to do it
```
ip link
ip addr add 192.168.1.10/24 dev eth0
ip route add 192.168.2.0/24 via 192.168.1.1
ip route add default via 192.168.1.1          # default gateway
ip route                                      # view routing table
```
### Check
`ping 192.168.2.5`, `traceroute`. Routes added with `ip` vanish on reboot; persist in network config.

### Why it matters
Kubernetes networks rely on routes/overlays between nodes; "Pod can't reach another node's Pod" is often a missing route or ip_forward off.

@@ 09-Networking/03-Pre-requisite-DNS
### Concepts
DNS maps names to IPs. A host consults `/etc/hosts` first, then the DNS server in `/etc/resolv.conf` (`nameserver 192.168.1.100`); the order is in `/etc/nsswitch.conf`. Record types: **A** (name→IPv4), **AAAA** (IPv6), **CNAME** (alias). Domain `web.mycompany.com`: web = host, mycompany.com = domain; **search** domains in resolv.conf let you type `web`.

### Tools
```
nslookup www.google.com           # ignores /etc/hosts
dig www.google.com
cat /etc/resolv.conf /etc/hosts
```
### Why it matters
Kubernetes sets each Pod's `/etc/resolv.conf` to the cluster DNS (CoreDNS) with search domains like `default.svc.cluster.local`, which is how `db-service` resolves.

@@ 09-Networking/04-Pre-requisite-CoreDNS
### What it is
CoreDNS is a flexible DNS server written in Go (replaced kube-dns). Configuration is a **Corefile** with plugins; Kubernetes uses the `kubernetes` plugin to answer for `cluster.local`.

### How it is set up in a cluster (preview)
```
.:53 {
    errors
    health
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
    }
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
}
```
- `kubernetes` answers Service/Pod names; `forward` sends everything else to the node's resolver; `cache`, `loop` and `reload` are helpers.
- Corefile lives in the `coredns` ConfigMap in `kube-system`: `kubectl -n kube-system get cm coredns -o yaml`.

### Try standalone
`./coredns` listens on port 53 with a Corefile; point `/etc/resolv.conf` or `dig @127.0.0.1` at it.

@@ 09-Networking/05-Pre-requisite-Network-Namespace
### Concept
A **network namespace** gives a process its own interfaces, routing table and ARP table, which is how containers get isolation. A Pod's containers share one.

### How to do it (connect two namespaces)
```
ip netns add red ; ip netns add blue
ip link add veth-red type veth peer name veth-blue
ip link set veth-red netns red ; ip link set veth-blue netns blue
ip -n red addr add 192.168.15.1/24 dev veth-red
ip -n blue addr add 192.168.15.2/24 dev veth-blue
ip -n red link set veth-red up ; ip -n blue link set veth-blue up
ip netns exec red ping 192.168.15.2
```
For many namespaces create a **bridge** (`ip link add v-net-0 type bridge`), connect each veth to it, and give the bridge an IP so the host can reach them. For internet access add a default route in the namespace and NAT: `iptables -t nat -A POSTROUTING -s 192.168.15.0/24 -j MASQUERADE`.

### Why it matters
This is exactly what a CNI plugin automates for each Pod.

@@ 09-Networking/06-Pre-requisite-Docker-Networking
### Concept
Docker network modes: `none` (no network), `host` (shares the host's network, ports clash), `bridge` (default private network `docker0`, 172.17.0.0/16; containers get an IP and are NATed out).

### How it works
Docker creates a bridge `docker0`, and for each container a namespace + veth pair attached to it. Published ports (`-p 8080:80`) add an iptables DNAT rule: host port 8080 → container IP:80.
```
docker network ls
ip addr show docker0
iptables -nvL -t nat | grep DNAT
```
### Why it matters
Kubernetes uses the same building blocks but with CNI plugins and a flat network where every Pod can reach every Pod without NAT.

@@ 09-Networking/07-Pre-requisite-CNI
### What it is
The **Container Network Interface** is a standard (a spec for executables) for plugging network setup into runtimes: `ADD` (attach a container to the network), `DEL`, `CHECK`, `VERSION`. Plugins: bridge, ipvlan, macvlan (reference), and third parties: Weave, Flannel, Calico, Cilium. Docker uses its own model (CNM), not CNI.

### How it works
The runtime creates the container's namespace, then calls the plugin binary with the config; the plugin creates the interface, assigns an IP (IPAM) and routes.
- Plugin binaries: `/opt/cni/bin`
- Config: `/etc/cni/net.d`
```
ls /opt/cni/bin /etc/cni/net.d
```
### Why it matters
No CNI configured → nodes `NotReady` and Pods `ContainerCreating`. Install one by applying its manifest (`kubectl apply -f <cni>.yaml`).

@@ 09-Networking/08-Cluster-Networking
### What it covers
The ports and addresses in a cluster, to know what must be reachable.

| Component | Port |
|---|---|
| kube-apiserver | 6443 |
| etcd | 2379 (clients), 2380 (peers) |
| kubelet | 10250 |
| kube-scheduler | 10259 |
| kube-controller-manager | 10257 |
| NodePort Services | 30000-32767 |

### How to check
```
ss -tlnp | grep -E '6443|2379|10250'
kubectl get nodes -o wide                  # node IPs
ip addr show                               # which interface the node uses
ip route
```
### Watch out
Find which interface a component uses with `ip a` + `--advertise-address`/`--node-ip`. For HA etcd every peer needs port 2380 open. Firewall/security groups blocking these cause NotReady nodes or timeouts.

@@ 09-Networking/09-Practice-Test-Explore-Env
### How to work through this lab
1. **Nodes and IPs:** `kubectl get nodes -o wide` (INTERNAL-IP).
2. **Which interface does the node use?** `ip a | grep -B2 192.168` and match the node's IP, e.g. `eth0`.
3. **MAC address / state of an interface:** `ip link show eth0`.
4. **Route to another network:** `ip route`; default gateway.
5. **Listening ports:** `netstat -natulp | grep kube-scheduler` (10259) and `etcd` (2379 and 2380; more client connections on 2379 than 2380).
6. **CNI and plugin config:** `ls /etc/cni/net.d`, `ls /opt/cni/bin`.

### Tip
Use `ip link`/`ip addr` for details, `ss -ltnp` or `netstat` for ports; both are available in the lab.

@@ 09-Networking/10-Pod-Networking
### The model
Every Pod gets its own IP; all Pods can reach all Pods **without NAT**; nodes can reach Pods. Kubernetes does not implement this itself: a CNI plugin does.

### What the plugin does per node
1. Allocates a Pod CIDR to the node (e.g. 10.244.1.0/24).
2. For each new Pod: create namespace + veth pair, attach to a bridge, assign an IP from the node's range.
3. Provide routes or an overlay so nodes know where each Pod CIDR lives.

### How to check
```
kubectl get pods -o wide                       # Pod IPs and nodes
kubectl get nodes -o jsonpath='{.items[*].spec.podCIDR}'
ip route | grep 10.244
```
### Watch out
Pod CIDRs must not overlap node or Service ranges. Pod IPs are ephemeral: use Services.

@@ 09-Networking/11-CNI-in-Kubernetes
### Where CNI is configured
The container runtime (not Kubernetes core) calls CNI. In kubelet/containerd configuration:
- `--cni-bin-dir=/opt/cni/bin`, `--cni-conf-dir=/etc/cni/net.d`.
- First file (alphabetical) in `/etc/cni/net.d` is used, e.g. `10-weave.conflist`.

### How to find out what is installed
```
ls /etc/cni/net.d
cat /etc/cni/net.d/*.conflist
ls /opt/cni/bin
kubectl -n kube-system get pods | grep -E 'weave|calico|flannel|cilium'
ps aux | grep kubelet | grep cni
```
### Typical task
"Which CNI plugin is configured?" → file name/`type` in `/etc/cni/net.d`; "which binary does the config run?" → `type` field maps to a file in `/opt/cni/bin`.

### Watch out
Delete old CNI config files when switching plugins, and reboot/restart the Pods; leftover files cause the wrong plugin to be picked.

@@ 09-Networking/12-CNI-weave
### What it is
**Weave Net** deploys an agent (DaemonSet Pod) on every node. The agents form a mesh, know the topology and route Pod traffic between nodes, encapsulating packets when needed. The peer on each node assigns Pod IPs from a shared range.

### How to install
```
kubectl apply -f <weave-net-manifest-from-the-lab>        # Weave Net is no longer maintained; Calico, Cilium and Flannel are current choices
kubectl -n kube-system get pods -l name=weave-net -o wide
kubectl -n kube-system logs weave-net-xxxxx -c weave
```
For a kubeadm cluster set `--pod-network-cidr` at `init` to match the plugin's default range, or set `IPALLOC_RANGE` env in the DaemonSet.

### Verify
Nodes become `Ready`; one `weave-net` Pod per node; Pod IPs come from the configured range.

### Watch out
Install a CNI before Pods can leave `ContainerCreating`. Ranges that overlap node networks cause strange routing.

@@ 09-Networking/13-Practice-Test-CNI-weave
### How to work through this lab
1. **Which CNI?** `ls /etc/cni/net.d`; `kubectl -n kube-system get pods` (weave-net / flannel). **Binary:** `ls /opt/cni/bin`.
2. **Pods per node:** `kubectl get pods -n kube-system -o wide | grep weave`.
3. **Which bridge/interface?** `ip link` → `weave` bridge; `ip addr show weave` → IP range (e.g. 10.32.0.0/12).
4. **Default gateway for Pods on a node:** `kubectl run busybox --image=busybox --command sleep 1000`, then `kubectl exec busybox -- ip route`.
5. **Weave agent logs:** `kubectl logs -n kube-system weave-net-xxx -c weave`.

### Verify
Answers come from `ip` commands and the Pod listings.

@@ 09-Networking/14-Practice-Test-Deploy-Network-Solution
### How to work through this lab
Scenario: Pods stay `ContainerCreating` because no network plugin is installed.
1. **Diagnose:** `kubectl describe pod app` → `failed to find plugin ... in path [/opt/cni/bin]` / `network plugin is not ready`.
2. **Deploy Weave Net:** `kubectl apply -f <the Weave manifest URL given in the lab>`.
3. **If the lab uses a pod CIDR other than weave's default:** add `- name: IPALLOC_RANGE value: <your-cidr>` to the weave container env in the DaemonSet YAML before applying.
4. **Verify:** `kubectl get pods -n kube-system | grep weave` Running; the app Pod becomes `Running`.

### Watch out
Find the cluster's Pod CIDR: `kubectl cluster-info dump | grep -m1 cluster-cidr`, or in `/etc/kubernetes/manifests/kube-controller-manager.yaml`.

@@ 09-Networking/15-ipam-weave
### What it is
**IPAM** (IP Address Management) decides which Pod gets which IP. Options: `host-local` (each node has a fixed range, simple but you manage ranges) or a plugin-managed pool. Weave allocates from a shared range (default 10.32.0.0/12) and splits it between nodes automatically (10.32.0.1 - 10.47.255.254).

### How to see it
```
kubectl exec -n kube-system weave-net-xxx -c weave -- /home/weave/weave --local status ipam
ip addr show weave
```
`/etc/cni/net.d/*.conflist` has an `ipam` block (`"type": "host-local"` with `subnet` or `ranges`).

### Why it matters
Choose a Pod CIDR that doesn't overlap node/Service networks and is large enough (`/24` per node = 254 Pods).

@@ 09-Networking/16-Practice-Test-Networking-weave
### How to work through this lab
1. **Which network plugin and IP range?** `kubectl -n kube-system logs weave-net-xxx -c weave | grep ipalloc-range` or `ip addr show weave`.
2. **Pod default gateway on a node:** `kubectl run test --image=busybox --command -- sleep 600`; `kubectl exec test -- ip route` (the node-side weave address).
3. **Change the range** (if asked): edit the DaemonSet `kubectl -n kube-system edit ds weave-net`, set `IPALLOC_RANGE`, then restart the weave Pods (`kubectl -n kube-system delete pods -l name=weave-net`).

### Verify
New Pods get IPs in the range: `kubectl get pods -o wide`.

@@ 09-Networking/17-Service-Networking
### How Services work
A Service gets a virtual IP from the **Service CIDR** (`--service-cluster-ip-range` on the API server). No interface owns it: **kube-proxy** on every node watches Services and writes rules (iptables DNAT / IPVS) mapping `ClusterIP:port` to Pod IP:port. NodePort adds a rule on each node's port; kube-proxy mode is `iptables` by default.

### How to check
```
kubectl get svc
kubectl -n kube-system logs <kube-proxy-pod>        # first lines: "Using iptables Proxier"
iptables -t nat -L KUBE-SERVICES -n | grep <svc>
grep service-cluster-ip-range /etc/kubernetes/manifests/kube-apiserver.yaml
```
### Watch out
Pod CIDR and Service CIDR must not overlap. `ClusterIP` is only reachable inside the cluster (not pingable; use the port). Endpoints must exist.

@@ 09-Networking/18-Practice-Test-Service-Networking
### How to work through this lab
1. **Service CIDR:** `grep service-cluster-ip-range /etc/kubernetes/manifests/kube-apiserver.yaml` (or `ps aux | grep apiserver`).
2. **Pod CIDR / network range:** `ip addr show weave` or the CNI config.
3. **Which proxy type is kube-proxy using?** `kubectl -n kube-system logs <kube-proxy-pod>` → "Using iptables Proxier".
4. **How does kube-proxy run?** `kubectl -n kube-system get ds`: it is a DaemonSet.
5. **Inspect rules:** `iptables -L -t nat | grep db-service`.

### Verify
Your answers come from the manifest and the logs; the ranges don't overlap.

@@ 09-Networking/19-DNS-in-kubernetes
### How names resolve
Kubernetes runs a DNS server (CoreDNS) that creates records for **Services** and optionally **Pods**:
- Service: `<service>.<namespace>.svc.cluster.local` (e.g. `web-service.apps.svc.cluster.local`).
- Pod: `10-244-2-5.apps.pod.cluster.local` (dashes instead of dots).
- Same namespace: use just `web-service`; across namespaces `web-service.apps`.
Pods' `/etc/resolv.conf` (set by the kubelet) points at the DNS Service IP with `search default.svc.cluster.local svc.cluster.local cluster.local`.

### How to test
```
kubectl run test --image=busybox:1.36 --rm -it --restart=Never -- nslookup web-service
kubectl exec -it test -- cat /etc/resolv.conf
kubectl exec -it test -- nslookup web-service.apps.svc.cluster.local
```
### Watch out
Use the **full** name when a tool doesn't read search domains. Use `nslookup`/`dig` (not `ping`) for DNS tests.

@@ 09-Networking/20-CoreDNS-in-Kubernetes
### What runs
A Deployment `coredns` (2 replicas) in `kube-system` + the Service `kube-dns` (the IP in every Pod's `/etc/resolv.conf`). Configuration is the `coredns` ConfigMap holding the **Corefile**; the kubelet hands out the DNS IP via its config (`clusterDNS`, `clusterDomain`).

### How to inspect
```
kubectl -n kube-system get deploy,po,svc -l k8s-app=kube-dns
kubectl -n kube-system get cm coredns -o yaml
grep -A3 clusterDNS /var/lib/kubelet/config.yaml
```
### Change something
Edit the ConfigMap (`kubectl -n kube-system edit cm coredns`) – the `reload` plugin picks it up in about a minute (or roll the Deployment: `kubectl -n kube-system rollout restart deploy coredns`).

### Debug
Pods in `Running`? Logs: `kubectl -n kube-system logs deploy/coredns`. `kubectl get ep kube-dns -n kube-system` must list the Pod IPs.

@@ 09-Networking/21-Practice-Test-CoreDNS-in-Kubernetes
### How to work through this lab
1. **What DNS solution?** `kubectl get pods -n kube-system` → coredns Pods; `kubectl get svc -n kube-system` → `kube-dns`.
2. **Where's the config?** `kubectl -n kube-system describe deploy coredns` → `-conf /etc/coredns/Corefile`; ConfigMap `coredns`.
3. **Root domain:** the `kubernetes cluster.local ...` line in the Corefile.
4. **Service name resolution:** `kubectl exec hr -- nslookup mysql.payroll > /root/out.txt`; use full name `mysql.payroll.svc.cluster.local` for apps.
5. **Fix a webapp whose DB host is wrong:** `kubectl edit deployment webapp` → `DB_Host=mysql.payroll` (name.namespace) and verify.

### Verify
The web page connects; `nslookup` returns the Service IP.

@@ 09-Networking/22-Ingress
### What it is
**Ingress** routes external HTTP(S) traffic to Services by host and path. It requires two things: an **Ingress controller** (nginx, Traefik, HAProxy, ... not installed by default) and **Ingress resources**.

### How to do it
1. Deploy a controller (Deployment + NodePort/LoadBalancer Service + ConfigMap + ServiceAccount/RBAC); on exam clusters it's usually provided: `kubectl get pods -A | grep ingress`, `kubectl get ingressclass`.
2. Create the resource:
```
kubectl create ingress shop --class=nginx --rule="shop.example.com/wear*=wear-svc:80" --rule="shop.example.com/watch*=video-svc:80"
```
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: {name: ingress-wear-watch, namespace: app-space}
spec:
  ingressClassName: nginx
  rules:
  - host: shop.example.com            # optional
    http:
      paths:
      - path: /wear
        pathType: Prefix
        backend: {service: {name: wear-service, port: {number: 8080}}}
```
### Verify
`kubectl get ingress`; `kubectl describe ingress` (backends resolve to Pod IPs); `curl -H "Host: shop.example.com" http://<node-ip>:<nodeport>/wear`.

### Watch out
The Ingress must be in the **same namespace** as its backend Services. `pathType` and `ingressClassName` are required. A "default backend" handles unmatched requests (404 if missing).

@@ 09-Networking/23-Ingress-Annotations-and-rewrite-target
### What it is
Controller-specific behaviour is set with annotations. With the NGINX controller, `nginx.ingress.kubernetes.io/rewrite-target` changes the path sent to the backend: without it `/pay` is forwarded as `/pay` and the app returns 404 if it only serves `/`.

### How to do it
```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - http:
      paths:
      - path: /pay
        pathType: Prefix
        backend: {service: {name: pay-service, port: {number: 8282}}}
```
With a capture group: `path: /something(/|$)(.*)` and `rewrite-target: /$2` → `/something/new` becomes `/new`.

### Verify
`curl http://<host>/pay` returns the app's root page. `kubectl describe ingress` lists the annotation.

### Watch out
Annotation keys are specific to the controller (NGINX vs Traefik). Newer controllers may require a regex path (`pathType: ImplementationSpecific`) with capture groups.

@@ 09-Networking/24-Practice-Test-CKA-Ingress-Net-1
### How to work through this lab
1. **Find the controller:** `kubectl get pods -A | grep ingress`; Services/ConfigMaps in its namespace; `kubectl get ingress -A`.
2. **Inspect:** `kubectl describe ingress -n app-space` (hosts, paths, backends); wrong backend → `kubectl edit ingress`.
3. **Change a path** (`/pay` → another service): edit the Ingress rule's path and backend (`service.name` and `port.number` must match the Service).
4. **Create a new rule:** `kubectl create ingress ingress-pay -n critical-space --rule="/pay=pay-service:8282"`; for rewrite add the annotation `nginx.ingress.kubernetes.io/rewrite-target: /`.

### Verify
`curl` / browser through the controller's NodePort (e.g. `30080/pay`).

@@ 09-Networking/25-Practice-Test-CKA-Ingress-Net-2
### How to work through this lab
1. **Namespaces:** create the namespace the controller needs: `kubectl create ns ingress-nginx`.
2. **Create the objects** for the controller in order: ConfigMap, ServiceAccount, Role/RoleBinding/ClusterRole bindings; the Deployment (`kubectl create -f` with the given args `--configmap=$(POD_NAMESPACE)/nginx-configuration`); then a NodePort Service (`nodePort: 30080`).
3. **Create the Ingress resource** in the app namespace: `kubectl create ingress ... --rule="/wear=wear-service:8080" --rule="/watch=video-service:8080"`, or use YAML.
4. **Verify:** `kubectl get all -n ingress-nginx`; browse `<node-ip>:30080/wear` and `/watch`. Fix 404s: the Service names/ports, namespace match, and rewrite-target if needed.

### Watch out
Controller Pods Pending/CrashLoop: `kubectl describe` and logs; Ingress without `ingressClassName` may be ignored.
