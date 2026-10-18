### Introduction

People say "Kubernetes runs Docker containers", but that has not been accurate for years. Kubernetes does not run containers itself. It asks a **container runtime** on each node to do it. Understanding the difference between Docker and containerd, and why Kubernetes moved on from Docker, explains a lot of commands you will meet in the exam (`crictl`, `ctr`, `nerdctl`) and why `docker ps` often shows nothing on a Kubernetes node.

### The layers of a container platform

A container is not one thing. Several layers cooperate:

```
┌─────────────────────────────────────────┐
│  Docker CLI / kubectl     (user tools)  │
├─────────────────────────────────────────┤
│  Docker Engine (dockerd)  or  kubelet   │
├─────────────────────────────────────────┤
│  containerd  /  CRI-O     (high-level   │
│                            runtime)     │
├─────────────────────────────────────────┤
│  runc                     (low-level    │
│                            runtime)     │
├─────────────────────────────────────────┤
│  Linux kernel: namespaces + cgroups     │
└─────────────────────────────────────────┘
```

- **runc** talks to the kernel and actually starts the isolated process (namespaces for isolation, cgroups for resource limits).
- **containerd** manages the container lifecycle: pulling images, storing them, creating containers and snapshots, calling runc.
- **Docker Engine** is a full developer platform on top of containerd. It adds building images, a CLI, networking, volumes and a friendly UX.

Kubernetes only needs the middle layer (pull images, run containers). Docker's extra features are not needed on a cluster node.

### Why standards matter: OCI and CRI

#### OCI - Open Container Initiative

OCI defines two specifications so tools are interchangeable:

- **Image spec** - how a container image is packaged.
- **Runtime spec** - how a runtime starts a container from that image.

An image built with Docker runs on containerd, CRI-O or Podman because they all follow OCI.

#### CRI - Container Runtime Interface

In the early days Kubernetes was hard-wired to Docker. To support other runtimes, Kubernetes introduced the **CRI**, a gRPC API the kubelet uses to talk to any compatible runtime.

```
kubelet ──CRI──► containerd ──► runc ──► container
kubelet ──CRI──► CRI-O      ──► runc ──► container
```

Any runtime that implements CRI works. containerd and CRI-O do. Docker Engine did not, so Kubernetes included a small adapter called **dockershim** to translate.

### What happened to dockershim

Maintaining dockershim inside Kubernetes was a burden. It was **deprecated in v1.20 and removed in v1.24**. Important points:

- **Images built with Docker still work.** They are OCI images.
- You can still build with Docker on your laptop and push to a registry.
- Nodes now normally use **containerd** (or CRI-O). Docker Engine is not installed on them.
- If you really want Docker Engine as the runtime you need the external `cri-dockerd` adapter.

Docker itself was already using containerd internally. Kubernetes simply started talking to containerd directly and skipped Docker.

### Command-line tools - which one to use

| Tool | Made for | Understands Kubernetes? | Typical use |
|---|---|---|---|
| `docker` | Developers | No | Build, run, push images on a workstation |
| `ctr` | containerd debugging | No | Low level, not user friendly |
| `nerdctl` | Docker-like CLI for containerd | Partly (namespaces) | Docker-style commands on containerd nodes |
| `crictl` | Any CRI runtime | **Yes** | Inspect and debug containers on a Kubernetes node |

`crictl` is the one to know for the CKA. It talks CRI, so it sees the containers the kubelet created.

```bash
crictl ps                      # running containers
crictl ps -a                   # include stopped ones
crictl pods                    # Pod sandboxes
crictl images                  # images on this node
crictl logs <container-id>     # logs of a container
crictl inspect <container-id>  # full detail
crictl pull nginx              # pull an image
```

If `crictl` complains about endpoints, point it at the runtime socket:

```bash
export CONTAINER_RUNTIME_ENDPOINT=unix:///run/containerd/containerd.sock
# or put it in /etc/crictl.yaml
# runtime-endpoint: unix:///run/containerd/containerd.sock
```

Do not use `docker ps` on a modern node. It will show nothing because there is no Docker daemon.

### Why `crictl` instead of `kubectl` here

`kubectl` talks to the API Server and shows Kubernetes objects. If the API Server is down (a common troubleshooting scenario), `kubectl` is useless. `crictl` works directly on the node, so it is how you check whether the `kube-apiserver` or `etcd` containers are actually running.

```bash
crictl ps -a | grep kube-apiserver
crictl logs <id>
```

### Image lifecycle on a node

```
Pod scheduled to node
        │
        ▼
kubelet asks runtime (via CRI) to create the Pod sandbox
        │
        ▼
runtime pulls image from the registry (if not present)
        │
        ▼
runtime unpacks image layers, creates the container
        │
        ▼
runc starts the container process
```

The `imagePullPolicy` setting decides whether the image is pulled again (`Always`, `IfNotPresent`, `Never`).

### Where things live on a containerd node

| Item | Location |
|---|---|
| containerd config | `/etc/containerd/config.toml` |
| containerd socket | `/run/containerd/containerd.sock` |
| Kubelet config | `/var/lib/kubelet/config.yaml` |
| Container logs | `/var/log/pods/` and `/var/log/containers/` |

Check the service:

```bash
systemctl status containerd
journalctl -u containerd --no-pager | tail -50
```

### Troubleshooting

- **Pod stuck in `ContainerCreating` or `ImagePullBackOff`**: `kubectl describe pod` shows the pull error. On the node, `crictl pull <image>` reproduces it.
- **Node `NotReady` and kubelet logs say it cannot reach the runtime**: `systemctl status containerd`; restart it with `systemctl restart containerd`.
- **`crictl` errors about the endpoint**: set `CONTAINER_RUNTIME_ENDPOINT` or `/etc/crictl.yaml`.
- **"docker: command not found" on a node**: expected. Use `crictl`.

### CKA exam tips

- `crictl ps -a` is the go-to when the control plane is down.
- Know the chain: `kubelet -> CRI -> containerd -> runc`.
- Docker-built images are fine on containerd because of the OCI standard.
- Dockershim was removed in Kubernetes **1.24**.

### Key takeaways

- Kubernetes talks to runtimes through the CRI, not directly to Docker.
- containerd is the usual runtime; CRI-O is the other common one.
- OCI makes images portable between tools.
- Use `crictl` to inspect containers on a node, `docker` on your laptop.
