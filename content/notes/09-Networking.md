## What this section is about
How Pods, Services and external clients reach each other. Networking plus the troubleshooting that goes with it is half the exam, so understand the layers: Pod network (CNI), Service network (kube-proxy), DNS (CoreDNS) and edge routing (Ingress / Gateway API).

## The Kubernetes network model
1. Every Pod gets its own IP and can reach every other Pod **without NAT**.
2. Nodes can reach all Pods and vice versa.
3. A Pod sees its own IP as others see it.
A **CNI plugin** (Calico, Cilium, Flannel, Weave) implements this: it is invoked by the container runtime when a Pod sandbox is created, assigns an IP (IPAM) and wires routes/overlay. Config lives in `/etc/cni/net.d`, binaries in `/opt/cni/bin`. With no CNI installed, nodes stay `NotReady` and CoreDNS Pods stay Pending. Cluster ranges are fixed at install: `--pod-network-cidr` and the Service CIDR (`--service-cluster-ip-range` in the API server).

## Services
- **ClusterIP**: virtual IP only reachable inside the cluster. **NodePort**: also opens a port (default 30000-32767) on every node. **LoadBalancer**: asks the cloud for an external LB. **ExternalName**: DNS CNAME. **Headless** (`clusterIP: None`): no VIP; DNS returns Pod IPs (used by StatefulSets).
- A Service selects Pods by label; the control plane maintains **EndpointSlices** of ready Pod IPs. **No endpoints = selector mismatch or Pods not Ready.**
- **kube-proxy** (iptables or IPVS mode) translates Service IP:port to a Pod IP:port. Inspect with `kubectl get ep`, `iptables-save | grep <svc>`, and kube-proxy logs.
```
kubectl expose pod web --port=80 --target-port=8080 --name=web-svc
kubectl get endpoints web-svc
kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- web-svc:80
```

## DNS and CoreDNS
CoreDNS runs as a Deployment in `kube-system`, configured by the `coredns` ConfigMap (Corefile). Names: `<svc>.<ns>.svc.cluster.local`; Pods get `<ip-dashes>.<ns>.pod.cluster.local`. Pods' `/etc/resolv.conf` points at the `kube-dns` Service with search domains, so `web` works within the same namespace and `web.other` across namespaces. Debug with `nslookup`/`dig` from a test Pod and check CoreDNS logs and the `kube-dns` endpoints.

## Ingress
An **Ingress** is an L7 HTTP(S) routing rule (host and path → Service). It does nothing without an **Ingress controller** (NGINX, Traefik, HAProxy...) running in the cluster and an `ingressClassName`. Path types: `Exact`, `Prefix`. TLS terminates using a `kubernetes.io/tls` Secret. Rewrites and other behaviour are controller-specific annotations (e.g. NGINX `nginx.ingress.kubernetes.io/rewrite-target`).
```
kubectl create ingress shop --class=nginx --rule="shop.example.com/pay*=pay-svc:80"
```

## Gateway API
The successor to Ingress: `GatewayClass` (infrastructure provider), `Gateway` (listeners/ports), and `HTTPRoute` (rules attached to a Gateway via `parentRefs`). It separates cluster-operator and app-developer roles and supports header matching, weighted traffic splitting and more. It is in the current exam curriculum; see the "Beyond the course" notes.

## Network policies
See the Security section: they are enforced by the CNI and decide which Pod traffic is allowed.

## Exam tips
- Service unreachable? Work outward in: Pod running and Ready → endpoints exist → `targetPort` right → NetworkPolicy → kube-proxy → DNS.
- `kubectl get svc,ep,ingress -A` and `kubectl describe ingress` show backends.
- Remember CNI config directory and `--pod-network-cidr` when installing a CNI during a kubeadm task.

## Official documentation
- [Cluster Networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/), [Connecting Applications with Services](https://kubernetes.io/docs/tutorials/services/connect-applications-service/)
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/), [Debugging DNS Resolution](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/), [Ingress Controllers](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/)
- [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Network Plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
