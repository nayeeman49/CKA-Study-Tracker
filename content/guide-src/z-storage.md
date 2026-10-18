@@ 08-Storage/02-Introduction-to-Docker-Storage
### Introduction

Before Kubernetes storage, understand how containers handle data. Containers are ephemeral; when they are removed their data goes with them unless it is stored outside.

### Two kinds of Docker storage

1. **Storage drivers / layered filesystem** - how image and container layers are stored.
2. **Volume drivers** - how persistent data is stored.

### Layered architecture

An image is a stack of read-only layers (one per Dockerfile instruction). A running container adds a thin writable layer on top.

```
 ┌───────────────────────┐
 │ container layer (R/W) │  deleted with the container
 ├───────────────────────┤
 │ image layer 4 (RO)    │
 │ image layer 3 (RO)    │
 │ image layer 2 (RO)    │
 │ image layer 1 (RO)    │
 └───────────────────────┘
```

Layers are cached and shared among images, which saves space and speeds builds.

**Copy-on-write**: modifying a file from an image layer copies it up into the writable layer first.

### Key takeaways

- Data in the writable layer is lost when the container is removed; use volumes.

@@ 08-Storage/03-Storage-in-Docker
### Introduction

How Docker keeps data beyond the life of a container.

### Volumes and bind mounts

```bash
docker volume create data_volume           # /var/lib/docker/volumes/data_volume
docker run -v data_volume:/var/lib/mysql mysql      # volume mount
docker run -v /data/mysql:/var/lib/mysql mysql      # bind mount (host path)
docker run --mount type=bind,source=/data/mysql,target=/var/lib/mysql mysql
```

| Type | Location | Managed by |
|---|---|---|
| Volume mount | `/var/lib/docker/volumes/...` | Docker |
| Bind mount | Any host path | You |
| tmpfs | Memory | Host (non-persistent) |

If you use a volume name that doesn't exist, Docker creates it.

### Storage drivers

Docker chooses one based on the OS: `overlay2` (common), `aufs`, `zfs`, `btrfs`, `device mapper`. They implement the layered filesystem.

### Key takeaways

- Use volumes for persistence; drivers handle layers.

@@ 08-Storage/04-Volume-Driver-Plugins-in-Docker
### Introduction

Volumes are handled by **volume driver plugins**. The default is `local`. Others can provide remote storage: Azure File Storage, GlusterFS, Portworx, NetApp, REX-Ray (AWS EBS, S3, Google Persistent Disk) and more.

```bash
docker run -it --name mysql --volume-driver rexray/ebs --mount src=ebs-vol,target=/var/lib/mysql mysql
```

This creates a volume on a cloud disk, persisting even if the host disappears.

### Key takeaways

- Plugins let containers use external storage backends.
- This is the precursor of the Kubernetes Container Storage Interface.

@@ 08-Storage/05-Container.Storage-Interface
### Introduction

Kubernetes originally had storage code built in for each backend. The **Container Storage Interface (CSI)** is a standard so any storage vendor can write a plugin without modifying Kubernetes.

### The three interfaces

| Interface | Standardises |
|---|---|
| CRI | Container runtimes (Docker, containerd, CRI-O) |
| CNI | Networking plugins |
| CSI | Storage plugins |

### What CSI defines

Remote procedure calls the orchestrator uses, such as `CreateVolume`, `DeleteVolume`, `ControllerPublishVolume`. The storage vendor implements them in a **CSI driver**, usually deployed as a controller Deployment plus a node DaemonSet.

```
 Kubernetes ──CSI RPC──► driver (Portworx, EBS, Ceph, NetApp...) ──► storage backend
```

### In practice

```bash
kubectl get csidrivers
kubectl get storageclass
kubectl -n kube-system get pods | grep csi
```

A StorageClass names the driver in `provisioner:`.

### Key takeaways

- CSI is the standard storage plugin API; it works with any container orchestrator.

@@ 08-Storage/06-Volumes
### Introduction

A Pod's container filesystem is ephemeral. A **volume** attaches storage to a Pod that lives as long as the Pod (or longer, for external volumes) and is shared among its containers.

### Basic example

```yaml
spec:
  containers:
  - name: app
    image: alpine
    command: ["/bin/sh","-c","echo $(date) >> /opt/number.out; sleep 3600"]
    volumeMounts:
    - mountPath: /opt
      name: data-volume
  volumes:
  - name: data-volume
    hostPath:
      path: /data
      type: Directory
```

`volumes` defines the storage; `volumeMounts` places it in a container.

### Common volume types

| Type | Behaviour |
|---|---|
| `emptyDir` | Empty directory created when the Pod starts, deleted with the Pod; shared between containers; can be in memory (`medium: Memory`) |
| `hostPath` | Directory from the node's filesystem; data stays on that node; avoid on multi-node |
| `configMap`, `secret`, `downwardAPI`, `projected` | Inject configuration |
| `persistentVolumeClaim` | Use a PersistentVolume (next lessons) |
| `nfs`, `awsElasticBlockStore`, `csi`, ... | External storage |

### Why hostPath is limited

On a multi-node cluster, Pods may land on different nodes and see different data. Use real network or cloud storage via PVs.

### emptyDir sharing

```yaml
volumes:
- name: cache
  emptyDir: {}
```

Two containers in the Pod can mount it to exchange files.

### Key takeaways

- `volumes` + `volumeMounts`; volume types decide the backend.

@@ 08-Storage/07-Persistent-Volumes
### Introduction

Defining storage in every Pod is not scalable. A **PersistentVolume (PV)** is a cluster-wide pool of storage created by an admin. Users claim from it using PVCs.

```
 Admin ─► PV (10Gi)       User ─► PVC (5Gi) ─► binds ─► Pod uses PVC
```

### PV definition

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-vol1
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /tmp/data         # lab only
```

Production: replace `hostPath` with `nfs`, `csi`, cloud disk, etc.

### Access modes

| Mode | Short | Meaning |
|---|---|---|
| ReadWriteOnce | RWO | One node read/write |
| ReadOnlyMany | ROX | Many nodes read-only |
| ReadWriteMany | RWX | Many nodes read/write |
| ReadWriteOncePod | RWOP | One Pod only |

### Reclaim policy

What happens to the PV after its claim is deleted:

| Policy | Result |
|---|---|
| `Retain` (default for manual PVs) | PV stays, `Released`, data kept, needs manual cleanup |
| `Delete` | PV and backing storage are deleted (default for dynamic) |
| `Recycle` | Deprecated |

### Phases

`Available` → `Bound` → `Released` → (`Failed`).

```bash
kubectl get pv
kubectl describe pv pv-vol1
```

PVs are cluster-scoped (no namespace).

### Key takeaways

- PV = the storage resource; capacity, access mode, reclaim policy.

@@ 08-Storage/08-Persistent-Volume-Claims
### Introduction

A **PersistentVolumeClaim (PVC)** is a user's request for storage. Kubernetes binds each PVC to a suitable PV.

### PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myclaim
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
  storageClassName: manual
```

### Binding rules

The controller finds a PV where:

- `capacity` >= requested size
- access modes include the requested one
- `storageClassName` matches
- selectors/labels match if specified (`selector.matchLabels`)

Binding is **one to one**. A 1Gi PV bound by a 500Mi claim wastes the rest. If no PV matches, the PVC stays `Pending` (unless dynamic provisioning applies).

```bash
kubectl get pvc
kubectl get pv
kubectl describe pvc myclaim
```

### Deleting a PVC

Depends on the PV's reclaim policy (Retain/Delete). PVCs in use by a Pod are protected (`kubernetes.io/pvc-protection`) until the Pod is gone.

### Troubleshooting a Pending PVC

- Size too large for any PV.
- Access mode mismatch.
- `storageClassName` mismatch (even empty vs set).
- No PV available, and no default StorageClass.

### Key takeaways

- PVC requests, PV supplies; match on size, access mode, class.

@@ 08-Storage/09-Using-PVC-in-PODs
### Introduction

Pods consume claims by referencing them in `volumes`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - mountPath: "/var/www/html"
      name: mypd
  volumes:
  - name: mypd
    persistentVolumeClaim:
      claimName: myclaim
```

The same works for ReplicaSets and Deployments (in the Pod template). The PVC must be in the same namespace as the Pod.

### Check

```bash
kubectl get pod mypod
kubectl describe pod mypod       # Volumes section, events
kubectl exec mypod -- df -h /var/www/html
kubectl exec mypod -- sh -c 'echo hi > /var/www/html/x'
```

### Troubleshooting

- Pod `Pending`: unbound PVC or no schedulable node for the volume.
- `ContainerCreating`: mount failure; see events.
- Data gone: you used `emptyDir` or the PV was `Delete`/hostPath on another node.

### Key takeaways

- Pod → PVC → PV → storage.

@@ 08-Storage/10-Practice-Test-Persistent-Volume-Claims
### How to approach this lab

Create a Pod with a hostPath volume, then a PV, a PVC, and use the claim.

### Commands

```bash
kubectl get pv,pvc
kubectl describe pvc claim-log-1
kubectl apply -f pv.yaml
kubectl apply -f pvc.yaml
kubectl get pvc          # STATUS Bound
kubectl delete pvc claim-log-1
kubectl get pv           # Released / Retain
```

### Notes

- A Pending PVC usually has a bigger request than the PV or a different access mode.
- Deleting a PVC used by a Pod: the PVC stays `Terminating` until the Pod is deleted.
- With `Retain`, the PV is `Released` and not reusable without cleanup.
- Remember `storageClassName` in both PV and PVC when set.

@@ 08-Storage/12-Storage-Class
### Introduction

Manual PV creation does not scale. A **StorageClass (SC)** enables **dynamic provisioning**: when a PVC requests the class, the provisioner creates the storage and PV automatically.

```
 PVC (storageClassName: fast) ─► StorageClass fast ─► provisioner ─► disk + PV created ─► bound
```

### Definition

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: google-storage
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: none
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

### Fields

| Field | Meaning |
|---|---|
| `provisioner` | Driver that creates volumes (CSI driver name) |
| `parameters` | Provisioner-specific settings (type, IOPS) |
| `reclaimPolicy` | `Delete` (default) or `Retain` for created PVs |
| `volumeBindingMode` | `Immediate` or `WaitForFirstConsumer` (wait for a Pod to be scheduled) |
| `allowVolumeExpansion` | Allow resizing PVCs |

### PVC using the class

```yaml
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: google-storage
  resources:
    requests:
      storage: 500Mi
```

### Default class

```bash
kubectl get sc                           # (default) marker
kubectl patch sc standard -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

A PVC without `storageClassName` uses the default class; `storageClassName: ""` means no class (static binding only).

### Local storage

`provisioner: kubernetes.io/no-provisioner` plus `WaitForFirstConsumer` for local PVs, where you create PVs yourself.

### Key takeaways

- StorageClass = automatic PV creation with chosen parameters.

@@ 08-Storage/13-Practice-Test-Storage-Class
### How to approach this lab

Inspect classes and create a PVC and Pod that use a local StorageClass with delayed binding.

### Commands

```bash
kubectl get sc
kubectl describe sc local-storage
kubectl get pvc
kubectl describe pvc local-pvc          # Pending: waiting for first consumer
kubectl apply -f pod.yaml               # PVC binds once the Pod is scheduled
kubectl get pv
```

### Notes

- `WaitForFirstConsumer` keeps the PVC `Pending` until a Pod uses it; that is expected.
- `no-provisioner` means PVs are created by hand.
- Check the provisioner column and reclaim policy.
