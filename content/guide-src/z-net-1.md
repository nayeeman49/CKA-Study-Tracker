@@ 09-Networking/01-Networking-Introduction
### Introduction

Kubernetes networking builds on ordinary Linux networking. This section first covers prerequisites (switching, routing, DNS, namespaces, Docker networking, CNI), then Kubernetes cluster networking, Pod networking, Services, DNS and Ingress.

### Roadmap

```
 prerequisites:  switching/routing ─ DNS ─ network namespaces ─ Docker networking ─ CNI
 cluster:        node ports, Pod network (CNI), Service network (kube-proxy)
 discovery:      CoreDNS
 exposure:       Services, Ingress
```

### Key takeaways

- If you know Linux networking basics, skip the prerequisites; otherwise they explain everything later.

@@ 09-Networking/02-Pre-requisite-Switching-Routing-Gateways
### Introduction

How machines talk on a network.

### Switching

A **switch** connects hosts on one network (e.g. 192.168.1.0/24). Each host has an interface (`eth0`).

```bash
ip link                         # list interfaces
ip addr add 192.168.1.10/24 dev eth0
ip addr show
```

Hosts on the same network communicate through the switch without a router.

### Routing

A **router** connects different networks (192.168.1.0/24 and 192.168.2.0/24). It has an IP on each. Hosts need a route to tell them where to send traffic for other networks.

```bash
ip route                        # or route
ip route add 192.168.2.0/24 via 192.168.1.1
ip route add default via 192.168.1.1
```

### Gateway

The gateway is the router address a host uses to leave its network. The **default gateway** (`0.0.0.0/0`) handles anything with no specific route.

### Linux as a router

By default Linux does not forward packets between interfaces.

```bash
cat /proc/sys/net/ipv4/ip_forward        # 0 = off
echo 1 > /proc/sys/net/ipv4/ip_forward
# permanent: /etc/sysctl.conf  net.ipv4.ip_forward = 1
```

### Diagnostics

```bash
ping 192.168.2.5
traceroute 192.168.2.5
ip route get 192.168.2.5
```

### Key takeaways

- Switch = same network; router = between networks; route entries + gateways.
- IP forwarding must be enabled for a Linux router (and Kubernetes nodes need it).

@@ 09-Networking/03-Pre-requisite-DNS
### Introduction

DNS maps names to IP addresses.

### Local name resolution

`/etc/hosts` maps names to IPs on a single machine:

```
192.168.1.11   db
```

For many hosts, use a DNS server. Point hosts at it in `/etc/resolv.conf`:

```
nameserver 192.168.1.100
search mycompany.com prod.mycompany.com
```

Order of lookup is in `/etc/nsswitch.conf` (`hosts: files dns`: files first, then DNS).

### Domain hierarchy

```
 root (.) ─► com ─► google ─► www
 www.google.com  = host www in domain google.com
```

`search` domains let you type `web` and resolve `web.mycompany.com`.

### Record types

| Type | Maps |
|---|---|
| A | name → IPv4 |
| AAAA | name → IPv6 |
| CNAME | name → another name (alias) |
| MX, TXT, SRV, PTR | mail, text, service location, reverse |

### Tools

```bash
ping web
nslookup www.google.com        # ignores /etc/hosts
dig www.google.com
host web
```

### Key takeaways

- Files, then DNS; `resolv.conf` sets the server and search domains.

@@ 09-Networking/04-Pre-requisite-CoreDNS
### Introduction

CoreDNS is a flexible DNS server written in Go, and it's the default DNS in Kubernetes.

### Running it

```bash
wget https://github.com/coredns/coredns/releases/...
./coredns
```

It listens on port 53 and is configured with a **Corefile** made of plugins:

```
.:53 {
    errors
    health
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
    }
    prometheus :9153
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
}
```

The `hosts` plugin can serve entries from a file, and `kubernetes` serves cluster records.

### Key takeaways

- CoreDNS = pluggable DNS configured by the Corefile.

@@ 09-Networking/05-Pre-requisite-Network-Namespace
### Introduction

Linux **network namespaces** isolate network stacks: each has its own interfaces, routes and ARP table. Containers use them for isolation.

### Create and use

```bash
ip netns add red
ip netns add blue
ip netns list
ip netns exec red ip link          # run a command inside
ip -n red link                     # shorter
```

The namespace sees none of the host's interfaces.

### Connect two namespaces with a virtual cable

```bash
ip link add veth-red type veth peer name veth-blue
ip link set veth-red netns red
ip link set veth-blue netns blue
ip -n red addr add 192.168.15.1/24 dev veth-red
ip -n blue addr add 192.168.15.2/24 dev veth-blue
ip -n red link set veth-red up
ip -n blue link set veth-blue up
ip netns exec red ping 192.168.15.2
```

### Many namespaces: a virtual bridge

For more than two, create a bridge switch on the host:

```bash
ip link add v-net-0 type bridge
ip link set dev v-net-0 up
ip link add veth-red type veth peer name veth-red-br
ip link set veth-red netns red
ip link set veth-red-br master v-net-0
ip -n red addr add 192.168.15.1/24 dev veth-red
ip -n red link set veth-red up
ip link set veth-red-br up
```

Give the bridge an IP so the host can reach namespaces: `ip addr add 192.168.15.5/24 dev v-net-0`.

### Reaching the outside

```bash
ip netns exec blue ip route add default via 192.168.15.5
iptables -t nat -A POSTROUTING -s 192.168.15.0/24 -j MASQUERADE
```

### Reaching inwards (port forwarding)

```bash
iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.15.2:80
```

### Key takeaways

- Namespace = isolated network stack; veth pairs + bridge + NAT connect it. This is what container runtimes automate.

@@ 09-Networking/06-Pre-requisite-Docker-Networking
### Introduction

How Docker uses namespaces, bridges and NAT to network containers. Kubernetes uses similar ideas.

### Network modes

| Mode | Behaviour |
|---|---|
| `none` | No network |
| `host` | Shares the host's network (no isolation; port conflicts) |
| `bridge` (default) | Private internal network `172.17.0.0/16` via `docker0` bridge |

```bash
docker run --network none nginx
docker run --network host nginx
docker network ls
ip addr show docker0
```

### How bridge mode works

For each container Docker creates a namespace and a veth pair attached to the bridge. Containers on the bridge reach each other by IP.

### Port mapping

Containers are not reachable from outside by default. Publish ports:

```bash
docker run -p 8080:80 nginx
```

Docker adds an iptables NAT rule:

```
iptables -t nat -A DOCKER -j DNAT --dport 8080 --to-destination 172.17.0.3:80
```

```bash
iptables -nvL -t nat
```

### Key takeaways

- Bridge + veth + iptables NAT = Docker networking.
- Kubernetes needs a different model (every Pod reachable without NAT), supplied by CNI plugins.

@@ 09-Networking/07-Pre-requisite-CNI
### Introduction

Every container runtime repeated the same networking steps. The **Container Network Interface (CNI)** defines a standard so runtimes and network plugins interoperate.

### The standard

For the runtime (kubelet/containerd): create a namespace, identify the network, invoke the plugin on **add** and **delete**, and handle the JSON config.

For the plugin: support `ADD`, `DEL`, `CHECK` commands, take container ID and namespace, assign IPs, set up routes, return results.

```
 runtime ──► plugin ADD(container id, netns, config) ──► IP, routes assigned
```

### Plugins

bridge, vlan, ipvlan, macvlan, host-device (built-in); Weave, Flannel, Calico, Cilium, Cisco ACI, VMware NSX and others (third-party).

**Docker does not implement CNI**; it uses its own CNM (container network model). That's why Kubernetes with Docker created its networking manually with `--network=none` and the CNI plugin.

### Key takeaways

- CNI = plugin standard for container networking; Kubernetes uses it.

@@ 09-Networking/08-Cluster-Networking
### Introduction

What networking a Kubernetes cluster needs between its nodes and components.

### Node requirements

- Each node has at least one interface on the node network with an IP, a unique hostname and a unique MAC address.
- Required open ports:

| Port | Component | Where |
|---|---|---|
| 6443 | kube-apiserver | control plane |
| 10250 | kubelet API | all nodes |
| 10259 | kube-scheduler | control plane |
| 10257 | kube-controller-manager | control plane |
| 2379 | etcd client | control plane |
| 2380 | etcd peer | control plane |
| 30000–32767 | NodePort services | workers |

Firewalls and security groups must allow these. (In clusters with multiple control planes, ETCD ports are open between them.)

### Commands to explore

```bash
ip link ; ip addr
ip addr show eth0
ip route
netstat -nplt             # listening ports (or ss -tlnp)
netstat -anp | grep etcd
arp node01
```

### Notable details

- The API server listens on 6443, ETCD on 2379 (clients) and 2380 (peers). Because there are more client connections to 2379, etcd on multiple control planes needs both.
- The kubelet's port 10250 and the control plane component ports are used by health checks and metrics.

### Key takeaways

- Know the port table.

@@ 09-Networking/09-Practice-Test-Explore-Env
### How to approach this lab

Explore the interfaces, routes and ports of the lab cluster.

### Commands

```bash
kubectl get nodes -o wide                    # INTERNAL-IP
ip a | grep -B2 192.168                      # interface for that IP
ip link show eth0                            # MAC address
ip route
ip link show cni0 ; ip link show flannel.1
netstat -natulp | grep kube-scheduler
netstat -natulp | grep etcd | grep LISTEN
```

### Typical answers

| Question | How |
|---|---|
| Interface used for the cluster network | The one with the node's INTERNAL-IP |
| Default gateway | `ip route` default line |
| Port the scheduler listens on | `netstat -nplt \| grep scheduler` (10259) |
| ETCD ports | 2379 and 2380 (2379 has more connections) |
| CNI bridge / interface name | `ip link` (cni0, docker0, flannel.1) |

@@ 09-Networking/10-Pod-Networking
### Introduction

Kubernetes expects a flat Pod network. The model:

- Every Pod gets its own IP.
- Pods on the same node can communicate.
- Pods on different nodes can communicate **without NAT**.

Kubernetes doesn't implement this; a CNI plugin does.

### Manual illustration

Each node gets a Pod subnet (e.g. 10.244.1.0/24, 10.244.2.0/24). On each node:

```
 node1                                node2
 ┌─────────────────┐                 ┌─────────────────┐
 │ bridge v-net-0  │                 │ bridge v-net-0  │
 │ 10.244.1.1/24   │                 │ 10.244.2.1/24   │
 │ pod 10.244.1.2  │                 │ pod 10.244.2.2  │
 └────────┬────────┘                 └────────┬────────┘
          └────────── node network ───────────┘
 routes: node1: 10.244.2.0/24 via node2 IP ; node2: 10.244.1.0/24 via node1 IP
```

### What the CNI script does

When a Pod is created, the runtime calls the plugin which:

1. Creates a veth pair.
2. Attaches one end to the Pod namespace and the other to the bridge.
3. Assigns an IP (from the node's Pod CIDR) and adds routes.
4. Brings the interfaces up.

On delete it removes them.

### Routes between nodes

Implemented as host routes, an overlay (VXLAN), or BGP (Calico). Plugins do this automatically.

### Key takeaways

- Flat Pod network, no NAT, with per-node Pod CIDRs.

@@ 09-Networking/11-CNI-in-Kubernetes
### Introduction

How Kubernetes finds and calls the CNI plugin.

### Who invokes CNI

The container runtime (containerd/CRI-O) creates the Pod sandbox and calls the CNI plugin. The kubelet provides the configuration via the runtime settings.

### Where it's configured

```
/opt/cni/bin/               plugin executables (bridge, host-local, flannel, ...)
/etc/cni/net.d/             configuration files (first file alphabetically is used)
```

```bash
ls /opt/cni/bin
ls /etc/cni/net.d
cat /etc/cni/net.d/10-flannel.conflist
```

### A config

```json
{
  "cniVersion": "0.3.1",
  "name": "mynet",
  "type": "bridge",
  "bridge": "cni0",
  "isGateway": true,
  "ipMasq": true,
  "ipam": {
    "type": "host-local",
    "subnet": "10.244.0.0/16",
    "routes": [{ "dst": "0.0.0.0/0" }]
  }
}
```

The `type` is the plugin, `ipam` decides IP allocation, `isGateway` gives the bridge an IP, `ipMasq` enables NAT for outside access.

### Check which plugin runs

```bash
ps aux | grep kubelet           # container-runtime-endpoint
kubectl -n kube-system get pods # weave-net / calico / flannel
```

### Troubleshooting

- Nodes `NotReady` with "network plugin not ready: cni config uninitialized": no CNI installed.
- Pods stuck in `ContainerCreating` with errors about CNI: plugin Pods not running, or config missing.

### Key takeaways

- Binaries in `/opt/cni/bin`, config in `/etc/cni/net.d`.

@@ 09-Networking/12-CNI-weave
### Introduction

Weave Net is a CNI plugin that creates an overlay network. A Weave agent runs on each node, they learn about each other and encapsulate traffic between nodes.

```
 node1: weave peer ◄═══ encapsulated traffic ═══► weave peer :node2
        pod A ──► weave bridge                      weave bridge ──► pod B
```

### Deploying

Weave runs as a DaemonSet, one Pod per node:

```bash
kubectl apply -f https://reweave.azurewebsites.net/k8s/v1.29/net.yaml
kubectl get pods -n kube-system | grep weave
kubectl logs -n kube-system weave-net-xxxxx -c weave
```

### Inspect

```bash
ip link | grep weave            # weave bridge
ip addr show weave
kubectl -n kube-system get ds weave-net
```

Default Pod network range `10.32.0.0/12`.

### Other CNI choices

| Plugin | Notes |
|---|---|
| Flannel | Simple overlay; **no NetworkPolicy** |
| Calico | BGP/routing; NetworkPolicy; popular |
| Cilium | eBPF; NetworkPolicy, observability |
| Weave | Overlay; NetworkPolicy support |

### Key takeaways

- Weave = DaemonSet overlay; check its Pods and bridge interface.

@@ 09-Networking/13-Practice-Test-CNI-weave
### How to approach this lab

Identify which CNI the cluster uses and its settings.

### Commands

```bash
ls /etc/cni/net.d
cat /etc/cni/net.d/*.conflist
ls /opt/cni/bin
kubectl -n kube-system get pods -o wide
ps -aux | grep kubelet | grep -i container-runtime
ip link
```

### Typical answers

| Question | Where |
|---|---|
| Which plugin is configured | file name / `type` in `/etc/cni/net.d` |
| Binary executed | `/opt/cni/bin/<type>` |
| Which runtime | kubelet flag `--container-runtime-endpoint` |
| Pod subnet | `ipam.subnet` or `kubeadm` pod CIDR |

@@ 09-Networking/14-Practice-Test-Deploy-Network-Solution
### How to approach this lab

Pods are stuck because no CNI is installed. Deploy one (Weave) with the correct Pod CIDR.

### Steps

```bash
kubectl get pods                         # ContainerCreating
kubectl describe pod app                 # no CNI / network plugin not ready
kubectl apply -f <weave-net-manifest>
kubectl -n kube-system get pods | grep weave
kubectl get pods -w
```

### Pod CIDR conflict

If the Weave default range overlaps with the node network, set `IPALLOC_RANGE` in the DaemonSet:

```yaml
containers:
- name: weave
  env:
  - name: IPALLOC_RANGE
    value: 10.32.0.0/16
```

```bash
kubectl edit ds weave-net -n kube-system
```

### Verify

Pods become `Running` and get IPs from the range; test connectivity between Pods.

@@ 09-Networking/15-ipam-weave
### Introduction

IP Address Management (IPAM) decides how Pods receive unique IP addresses. The CNI plugin delegates to an IPAM plugin.

### Options

- **host-local**: each node has its own subnet and a local file tracks allocations. Simple; the cluster must carve out per-node ranges.
- **Weave's IPAM**: allocates from a shared range, split dynamically among peers. Default range `10.32.0.0/12` divided across nodes.
- **Calico IPAM**, cloud-specific IPAMs.

### Config

```json
"ipam": {
  "type": "host-local",
  "subnet": "10.244.1.0/24"
}
```

### Check

```bash
kubectl get nodes -o jsonpath='{.items[*].spec.podCIDR}'
kubectl get pods -A -o wide     # Pod IPs
```

### Key takeaways

- IPAM ensures unique Pod IPs; the node CIDR (`--pod-network-cidr`, `--cluster-cidr`) matters.

@@ 09-Networking/16-Practice-Test-Networking-weave
### How to approach this lab

Find the Weave agent details and which node a Pod is on.

### Commands

```bash
kubectl get pods -n kube-system -o wide | grep weave
kubectl logs -n kube-system weave-net-xxxx -c weave | grep -i ipalloc
ip addr show weave
ip route | grep weave
kubectl run busybox --image=busybox --command -- sleep 1000
kubectl get pods -o wide
```

### Typical answers

- Weave peers = number of nodes.
- Pod IP range = log line `ipalloc-range`.
- Default gateway for Pods on a node = the weave bridge IP.

@@ 09-Networking/17-Service-Networking
### Introduction

How Service IPs work. Services are cluster-wide virtual objects: no process, no interface. Kube-proxy on every node turns them into forwarding rules.

### Ranges

```
Pod network       10.244.0.0/16     (CNI)
Service network   10.96.0.0/12      (--service-cluster-ip-range on the API server)
```

The two ranges must not overlap with each other or the node network.

```bash
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep service-cluster-ip-range
```

### Creation flow

```
 Service created ─► kube-proxy on each node watches the API
                  ─► adds rules: ClusterIP:port → Pod IP:port
```

### Types as rules

- **ClusterIP**: rule on each node for internal use.
- **NodePort**: also listens on a port on each node (30000–32767).

### See the rules

```bash
iptables -t nat -L -n | grep db-service
iptables -t nat -L KUBE-SERVICES | head
```

Rule comments show `default/db-service`. Log: `/var/log/kube-proxy.log` or Pod logs.

### Mode options

kube-proxy `--proxy-mode`: `iptables` (default), `ipvs`, `nftables`.

### Key takeaways

- Service IPs are virtual and implemented as NAT rules by kube-proxy.

@@ 09-Networking/18-Practice-Test-Service-Networking
### How to approach this lab

Discover ranges and kube-proxy configuration.

### Commands

```bash
ip addr show eth0                                    # node network
kubectl -n kube-system describe pod kube-apiserver-controlplane | grep service-cluster
kubectl get pods -n kube-system | grep proxy
kubectl logs -n kube-system kube-proxy-xxxxx | head       # "Using iptables Proxier"
kubectl -n kube-system get cm kube-proxy -o yaml | grep -E "mode|clusterCIDR"
iptables -t nat -L | grep db-service
kubectl get ds -n kube-system
```

### Typical answers

| Question | Answer |
|---|---|
| Service IP range | API server `--service-cluster-ip-range` |
| Pod IP range | CNI config / `clusterCIDR` / pod CIDR |
| Proxy mode | kube-proxy Pod logs or ConfigMap (default iptables) |
| Where does kube-proxy run | DaemonSet, one per node |

@@ 09-Networking/19-DNS-in-kubernetes
### Introduction

Kubernetes runs an internal DNS server so Pods find Services by name.

### Service records

For a Service `web-service` in namespace `apps`:

```
web-service                              (same namespace)
web-service.apps
web-service.apps.svc
web-service.apps.svc.cluster.local       (fully qualified)
```

Root domain `cluster.local`, then `svc`, then namespace.

### Pod records

Not created by default; if enabled, Pods get names such as `10-244-2-5.apps.pod.cluster.local` (dots replaced by dashes).

### How Pods use it

The kubelet writes `/etc/resolv.conf` in each Pod:

```
nameserver 10.96.0.10          # the kube-dns Service IP
search apps.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

The search list makes short names work. `ndots:5` means names with fewer than five dots try the search domains first.

### Test

```bash
kubectl run test --image=busybox:1.28 --rm -it --restart=Never -- nslookup web-service
kubectl exec -it pod -- cat /etc/resolv.conf
kubectl run test --image=busybox:1.28 --rm -it --restart=Never -- nslookup web-service.apps.svc.cluster.local
```

### Key takeaways

- `service.namespace.svc.cluster.local`; resolv.conf search domains make short names work.

@@ 09-Networking/20-CoreDNS-in-Kubernetes
### Introduction

CoreDNS is the cluster DNS. It runs as a Deployment (two replicas) in `kube-system` behind the `kube-dns` Service.

### Components

```bash
kubectl -n kube-system get deploy coredns
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get cm coredns -o yaml
```

### Corefile ConfigMap

```
.:53 {
    errors
    health { lameduck 5s }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
    loadbalance
}
```

- `kubernetes` plugin handles `cluster.local`.
- `forward . /etc/resolv.conf` sends everything else to the node's resolvers.
- Edit the ConfigMap and CoreDNS reloads (`reload` plugin) or restart the Pods: `kubectl -n kube-system rollout restart deploy coredns`.

### How Pods find CoreDNS

The kubelet sets `--cluster-dns=10.96.0.10` and `--cluster-domain=cluster.local` in `/var/lib/kubelet/config.yaml`:

```bash
grep -A2 clusterDNS /var/lib/kubelet/config.yaml
```

### Troubleshooting DNS

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
kubectl get endpoints kube-dns -n kube-system
kubectl run t --image=busybox:1.28 --rm -it --restart=Never -- nslookup kubernetes.default
```

Common causes: CoreDNS Pods down, wrong Corefile, loop plugin detecting a loop with `/etc/resolv.conf` pointing to itself, NetworkPolicy blocking port 53, wrong `clusterDNS`.

### Key takeaways

- CoreDNS Deployment + `kube-dns` Service + Corefile ConfigMap.

@@ 09-Networking/21-Practice-Test-CoreDNS-in-Kubernetes
### How to approach this lab

Answer questions about CoreDNS and fix DNS-related application problems.

### Commands

```bash
kubectl get pods -n kube-system | grep dns
kubectl get svc -n kube-system
kubectl -n kube-system describe deploy coredns | grep -i -E "args|config"
kubectl get cm -n kube-system coredns -o yaml
kubectl exec -it hr -- nslookup mysql.payroll > /root/nslookup.out
kubectl describe pod webapp | grep -i mysql        # DB_Host env
kubectl edit deploy webapp                         # fix DB_Host to mysql.payroll
```

### Typical answers

| Question | Where |
|---|---|
| Root domain | Corefile `kubernetes cluster.local` |
| Config file location in Pod | `/etc/coredns/Corefile` |
| How configured | ConfigMap `coredns` mounted into Pods |
| Service name for reaching DNS | `kube-dns` |
| Cross-namespace reachability | `service.namespace` |

@@ 09-Networking/22-Ingress
### Introduction

NodePort and LoadBalancer expose one Service each. **Ingress** is a layer 7 (HTTP/HTTPS) router that exposes many Services through one entry point using URL paths or hostnames, and also handles TLS.

```
 Internet ─► [Ingress controller (NodePort/LB)] ─► rules ─► Service A (/wear)
                                                       └──► Service B (/watch)
```

### Two parts

1. **Ingress controller** - the software that does the work (NGINX, Traefik, HAProxy, Istio, Contour). **Not installed by default.**
2. **Ingress resources** - rules the controller reads.

### Deploy a controller (NGINX example)

Needs a Deployment, a Service to expose it (NodePort/LB), a ConfigMap, a ServiceAccount with the right RBAC, and an `IngressClass`.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.0/deploy/static/provider/baremetal/deploy.yaml
kubectl -n ingress-nginx get all
kubectl get ingressclass
```

### Ingress resource

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-wear-watch
  namespace: app-space
spec:
  ingressClassName: nginx
  rules:
  - http:
      paths:
      - path: /wear
        pathType: Prefix
        backend:
          service:
            name: wear-service
            port:
              number: 80
      - path: /watch
        pathType: Prefix
        backend:
          service:
            name: video-service
            port:
              number: 80
```

By host:

```yaml
rules:
- host: wear.my-online-store.com
  http:
    paths:
    - path: /
      pathType: Prefix
      backend: {service: {name: wear-service, port: {number: 80}}}
```

### Imperative

```bash
kubectl create ingress ingress-test --rule="wear.my-online-store.com/wear*=wear-service:80"
kubectl get ingress
kubectl describe ingress ingress-wear-watch
```

### Path types

`Exact`, `Prefix`, `ImplementationSpecific`.

### Default backend

Requests matching no rule go to the default backend (404 page unless configured).

### TLS

```yaml
spec:
  tls:
  - hosts: [shop.example.com]
    secretName: shop-tls
```

### Troubleshooting

- 404 from the controller: path, host or service name/port mismatch; check `describe ingress` for `<error: endpoints ... not found>`.
- 503: Service has no ready endpoints.
- Ingress ignores rules: wrong `ingressClassName`.
- Backend service must be in the same namespace as the Ingress.

### CKA exam tips

- Know `kubectl create ingress` and the YAML shape; `pathType` is required.

### Key takeaways

- Controller + resource; L7 routing by path/host.

@@ 09-Networking/23-Ingress-Annotations-and-rewrite-target
### Introduction

Annotations configure controller-specific behaviour. The most common is **rewrite-target**, which changes the URL path passed to the backend.

### The problem

A user visits `/watch`; the Ingress routes to the video Service, which serves content at `/`. Without rewriting, the backend receives `/watch` and returns 404.

### Rewrite

```yaml
metadata:
  name: rewrite
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - http:
      paths:
      - path: /pay
        pathType: Prefix
        backend:
          service:
            name: pay-service
            port: {number: 8282}
```

`rewrite-target: /` makes `http://host/pay` reach the backend as `/`.

### With a capture group

```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
  - http:
      paths:
      - path: /something(/|$)(.*)
        pathType: ImplementationSpecific
        backend: ...
```

`/something/foo` → `/foo`.

### Other useful annotations (NGINX)

| Annotation | Purpose |
|---|---|
| `nginx.ingress.kubernetes.io/ssl-redirect` | Force HTTPS |
| `nginx.ingress.kubernetes.io/proxy-body-size` | Upload limit |
| `nginx.ingress.kubernetes.io/whitelist-source-range` | Allowed IPs |

### Key takeaways

- Annotations are controller specific; rewrite-target fixes path mismatches.

@@ 09-Networking/24-Practice-Test-CKA-Ingress-Net-1
### How to approach this lab

Inspect and create Ingress resources for several Services in different namespaces.

### Commands

```bash
kubectl get pods -A
kubectl get ingress -A
kubectl describe ingress -n app-space
kubectl get svc -A | grep -i -E "wear|video|food"
kubectl edit ingress ingress-wear-watch -n app-space
kubectl create ingress ingress-pay -n critical-space --rule="/pay=pay-service:8282" \
  --annotation nginx.ingress.kubernetes.io/rewrite-target=/
```

### Approach for each task

1. Find the Service name and **port** (`kubectl get svc -n ns`).
2. Check the namespace the Service is in; the Ingress must be there too.
3. Build the Ingress (path, pathType, backend, annotation).
4. Test with `curl <node-ip>:<nodeport>/path`.

### Common errors

- Wrong port number.
- Missing rewrite annotation when the app serves at `/`.
- Using the wrong namespace.

@@ 09-Networking/25-Practice-Test-CKA-Ingress-Net-2
### How to approach this lab

A deeper Ingress lab: deploy the controller, then expose apps.

### Typical flow

```bash
kubectl create namespace ingress-nginx
kubectl apply -f ingress-controller.yaml       # configmap, SA, roles, deployment, service
kubectl get all -n ingress-nginx
kubectl get ingressclass
kubectl create ingress ... 
curl http://<node-ip>:30080/wear
```

### Tips

- The controller Service is NodePort (e.g. 30080); that is the external port.
- If the controller needs an `IngressClass` argument, check `--ingress-class` / `--controller-class` args.
- `kubectl describe ingress` shows backends and any errors.
- Use `kubectl logs -n ingress-nginx deploy/ingress-nginx-controller` to see requests and errors.
