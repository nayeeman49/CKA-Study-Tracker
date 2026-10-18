## What this section is about
Core Concepts is the mental model for everything else: what runs on the control plane, what runs on every node, and the first objects you create (Pods, ReplicaSets, Deployments, Namespaces, Services). Almost every exam task starts with "which object do I create and in which namespace?", so speed with `kubectl` here pays off in every domain.

## Cluster architecture
**Control plane** (usually on the master/control-plane nodes, as static pods under kubeadm):
- **kube-apiserver**: the only component that talks to etcd. Every `kubectl` call, every kubelet and every controller goes through it. It authenticates, authorizes (RBAC), runs admission controllers, then persists the object.
- **etcd**: the consistent key-value store holding all cluster state. Back it up with `etcdctl snapshot save`.
- **kube-scheduler**: watches for Pods with no `spec.nodeName` and picks a node (filtering, then scoring). It only *decides*; the kubelet starts the Pod.
- **kube-controller-manager**: a bundle of control loops (node, replication, endpoints, service-account, ...). Each loop compares desired and actual state and acts.
- **cloud-controller-manager** (cloud only): node, route and load-balancer integration.

**Node components**:
- **kubelet**: the node agent. Registers the node, watches the API for Pods bound to it, asks the container runtime to run them, runs probes, reports status. It also runs *static pods* from `/etc/kubernetes/manifests`.
- **kube-proxy**: programs iptables/IPVS rules so Service virtual IPs reach Pod endpoints.
- **Container runtime** (containerd, CRI-O) via the CRI. Docker Engine is no longer a supported runtime directly; use `crictl` to inspect containers on a node.

**Flow to remember:** `kubectl run` → API server validates and stores in etcd → scheduler binds Pod to a node → kubelet on that node pulls the image and starts containers → kube-proxy/CNI make it reachable.

## Pods, ReplicaSets, Deployments
- A **Pod** is the smallest deployable unit: one or more containers sharing network namespace (one IP, `localhost` between containers) and volumes.
- A **ReplicaSet** keeps N identical Pods running, matching on `selector.matchLabels`. The selector must match the template labels.
- A **Deployment** manages ReplicaSets to give rolling updates and rollbacks. You almost always create Deployments, not bare ReplicaSets.
- **Namespaces** partition names and policy (RBAC, quotas). Always check `-n`; `kubectl config set-context --current --namespace=NAME` saves typing.

## Services (first look)
A Service gives a stable virtual IP and DNS name to a changing set of Pods selected by label. Types: `ClusterIP` (default, in-cluster), `NodePort` (opens 30000-32767 on every node), `LoadBalancer` (cloud provisioned). `port` is the Service port, `targetPort` is the container port, `nodePort` is the node port.

## Imperative commands (exam speed)
```
kubectl run nginx --image=nginx --port=80 --dry-run=client -o yaml > pod.yaml
kubectl create deployment web --image=nginx --replicas=3 --dry-run=client -o yaml
kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort
kubectl scale deployment web --replicas=5
kubectl set image deployment/web nginx=nginx:1.27
kubectl create namespace dev
kubectl explain pod.spec.containers --recursive
```
Generate YAML with `--dry-run=client -o yaml`, edit, then `kubectl apply -f`. `kubectl explain` is your offline reference.

## Exam tips
- Set `alias k=kubectl` and `export do="--dry-run=client -o yaml"`; enable completion (`source <(kubectl completion bash)`).
- `kubectl get pods -o wide` shows node and IP; `kubectl describe` shows Events, usually the answer to "why is it Pending".
- On kubeadm clusters the control plane components are static pods named like `kube-apiserver-<node>` in `kube-system`.

## Official documentation
- [Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/) and [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/)
- [Pods](https://kubernetes.io/docs/concepts/workloads/pods/), [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/), [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/), [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/)
