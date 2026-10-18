@@ 08-Storage/02-Introduction-to-Docker-Storage
### What it covers
Container filesystems are **ephemeral**: data written inside disappears with the container. Docker has two storage ideas, and Kubernetes' volume model builds on them.
- **Storage drivers** (overlay2, aufs...) implement the layered image filesystem. Image layers are read-only; a container adds one thin writable layer (copy-on-write).
- **Volumes** persist data outside the container's layer.

### Try it
```
docker run -v data_volume:/var/lib/mysql mysql      # named volume under /var/lib/docker/volumes
docker volume create data_volume ; docker volume ls
```
### Why it matters
Kubernetes Pods lose container data on restart unless a volume is mounted, which is what the following lessons build on: Volumes → PersistentVolumes → PVCs → StorageClasses.

@@ 08-Storage/03-Storage-in-Docker
### Two ways to mount
- **Volume mount**: `docker run -v data_volume:/var/lib/mysql mysql` uses a managed volume (created automatically if missing) in `/var/lib/docker/volumes/data_volume`.
- **Bind mount**: `docker run -v /data/mysql:/var/lib/mysql mysql` uses a host path.
- Modern flag: `--mount type=bind,source=/data/mysql,target=/var/lib/mysql`.

### How to check
`docker volume ls`, `docker inspect <container>` (Mounts), `docker rm -v`.

### Mapping to Kubernetes
`hostPath` = bind mount; named/managed volumes = PersistentVolume backed by a driver. Kubernetes doesn't use the Docker CLI; the runtime (containerd) creates the mounts for you from the Pod spec.

@@ 08-Storage/04-Volume-Driver-Plugins-in-Docker
### What it is
Local volumes live on one host. **Volume drivers** (e.g. Rex-Ray, Portworx, Azure File Storage, vSphere, GlusterFS, Flocker) let a container use remote storage:
```
docker run -it --name mysql --volume-driver rexray/ebs -v ebs-vol:/var/lib/mysql mysql
```
### Why it matters
This is the origin of the **Container Storage Interface (CSI)**: a standard so storage vendors write one driver that works across Kubernetes and other orchestrators. In Kubernetes you consume it through **StorageClasses** and PVCs, never the Docker driver flags.

### Check
`kubectl get csidrivers`, `kubectl get storageclass` (PROVISIONER column shows the CSI driver).

@@ 08-Storage/05-Container.Storage-Interface
### What it is
Kubernetes defines extension interfaces: **CRI** (runtime), **CNI** (network), **CSI** (storage). With CSI, a vendor ships a driver (controller plugin + node plugin, running as Pods) exposing gRPC calls such as `CreateVolume`, `DeleteVolume`, `ControllerPublishVolume`, `NodeStageVolume`. Kubernetes (via sidecars like external-provisioner and external-attacher) calls them.

### How you use it
1. Install the vendor's CSI driver (Helm chart/manifests).
2. Create a **StorageClass** with `provisioner: <driver name>` and parameters.
3. Create a PVC that references the class: a volume is created dynamically and bound.
```
kubectl get csidrivers
kubectl -n kube-system get pods | grep csi
kubectl get sc
```
### Watch out
If PVCs stay Pending on a new class, check that the driver Pods are Running and the `provisioner` string matches the driver name exactly.

@@ 08-Storage/06-Volumes
### What they are
A volume is a directory made available to the containers of a Pod. Data survives container restarts (not necessarily Pod deletion, depending on type).
- `emptyDir`: scratch space created with the Pod, removed with it.
- `hostPath`: a path on the node (fine for labs, a security risk otherwise, tied to one node).
- `configMap`, `secret`, `projected`, `downwardAPI`.
- `persistentVolumeClaim`: durable storage (next lessons).
- Cloud/CSI types (EBS, NFS, ...).

### How to do it
```yaml
spec:
  containers:
  - name: app
    image: alpine
    command: ["sh","-c","echo hi >> /opt/number.out; sleep 3600"]
    volumeMounts:
    - mountPath: /opt          # path inside the container
      name: data-volume
  volumes:
  - name: data-volume          # name used by volumeMounts
    hostPath:
      path: /data
      type: DirectoryOrCreate
```
### Verify
`kubectl exec app -- cat /opt/number.out`; on the node `cat /data/number.out`.

### Watch out
`volumeMounts.name` must match `volumes.name`. With hostPath on a multi-node cluster the data exists only on the node the Pod ran on.

@@ 08-Storage/07-Persistent-Volumes
### What it is
A **PersistentVolume (PV)** is cluster-wide storage provisioned by an admin (or dynamically). Users claim it with PVCs. A PV is not namespaced.

### How to do it
```yaml
apiVersion: v1
kind: PersistentVolume
metadata: {name: pv-vol1}
spec:
  capacity: {storage: 1Gi}
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  hostPath: {path: /tmp/data}
```
`kubectl create -f pv.yaml; kubectl get pv`.
Access modes: `ReadWriteOnce` (one node), `ReadOnlyMany`, `ReadWriteMany`, `ReadWriteOncePod`. Reclaim policy: `Retain` (keep data, manual cleanup), `Delete` (delete the backend volume), `Recycle` (deprecated).

### Verify
STATUS is `Available`, then `Bound` once claimed, `Released` after the claim is deleted with `Retain`.

### Watch out
A `Released` PV won't rebind until you remove its `claimRef` (`kubectl patch pv pv-vol1 -p '{"spec":{"claimRef":null}}'`). Use `storageClassName` consistently to control binding.

@@ 08-Storage/08-Persistent-Volume-Claims
### What it is
A **PVC** is a namespaced request for storage. Kubernetes binds it to a PV that satisfies: capacity ≥ request, matching access modes, same `storageClassName` and any selector. Binding is one-to-one; the whole PV is used even if the claim is smaller.

### How to do it
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: myclaim}
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests: {storage: 500Mi}
  # storageClassName: ""   # "" = static binding only, no dynamic provisioning
```
```
kubectl create -f pvc.yaml
kubectl get pvc,pv
kubectl describe pvc myclaim
kubectl delete pvc myclaim          # PV then follows its reclaimPolicy
```
### Verify
`kubectl get pvc` STATUS `Bound` and VOLUME shows the PV name. `Pending` → read `describe` events.

### Watch out
Pending causes: no PV big enough, access modes differ, class mismatch, `WaitForFirstConsumer` with no Pod yet. A PVC being used by a Pod can't be deleted until the Pod is (status `Terminating`).

@@ 08-Storage/09-Using-PVC-in-PODs
### How to do it
Reference the claim by name in `volumes` and mount it:
```yaml
spec:
  containers:
  - name: frontend
    image: nginx
    volumeMounts:
    - mountPath: /var/www/html
      name: web
  volumes:
  - name: web
    persistentVolumeClaim:
      claimName: myclaim
```
Same block works inside a Deployment's `spec.template.spec`. The PVC must be in the **same namespace** as the Pod.

### Verify
`kubectl describe pod` (Volumes, Mounts), `kubectl exec <pod> -- sh -c 'echo hi > /var/www/html/t && cat /var/www/html/t'`. Delete and recreate the Pod: the file remains.

### Watch out
Pod stuck `Pending`/`ContainerCreating` often means the PVC isn't Bound. Several replicas with a `ReadWriteOnce` claim can only run on one node.

@@ 08-Storage/10-Practice-Test-Persistent-Volume-Claims
### How to work through this lab
1. **Inspect the Pod and its volume:** `kubectl describe pod webapp` (hostPath volume `/log`), `kubectl exec webapp -- cat /log/app.log`.
2. **Create a PV** (`pv-log`, 100Mi, `ReadWriteMany`, `Retain`, hostPath `/pv/log`) and a **PVC** (`claim-log-1`, 50Mi, `ReadWriteOnce`): note that RWO vs RWX mismatch leaves the claim **Pending**; fix the access mode so they match.
3. **Use the claim in the Pod:** replace `hostPath` with `persistentVolumeClaim.claimName: claim-log-1` (recreate: `kubectl replace --force -f`).
4. **Delete the PVC:** it stays `Terminating` until the Pod using it is deleted; then PV becomes `Released` (Retain).
5. **Verify:** `kubectl get pv,pvc`.

@@ 08-Storage/12-Storage-Class
### What it is
A **StorageClass** enables **dynamic provisioning**: a PVC that names a class causes the provisioner to create the backing volume and PV automatically.

### How to do it
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {name: fast}
provisioner: kubernetes.io/no-provisioner   # or a CSI driver, e.g. ebs.csi.aws.com
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
parameters: {type: gp3}
```
A PVC uses it with `storageClassName: fast`. Make a default class: annotation `storageclass.kubernetes.io/is-default-class: "true"`.
```
kubectl get sc
kubectl patch sc fast -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```
### Verify
Creating the PVC produces a PV (`kubectl get pv`), possibly only after the first Pod using it is scheduled (`WaitForFirstConsumer`).

### Watch out
`no-provisioner` means *no* dynamic creation: PVs must be made manually (local volumes). `volumeBindingMode: Immediate` can pick the wrong zone for the Pod. Expansion needs `allowVolumeExpansion`; you can only grow.

@@ 08-Storage/13-Practice-Test-Storage-Class
### How to work through this lab
1. **List classes:** `kubectl get sc` (provisioner, reclaim policy, binding mode, default marker).
2. **Create a class** (`delayed-volume-sc`, `provisioner: kubernetes.io/no-provisioner`, `volumeBindingMode: WaitForFirstConsumer`): `kubectl apply -f sc.yaml`.
3. **Create a PVC** `local-pvc` with `storageClassName: local-storage`: it stays **Pending**; `kubectl describe pvc` says `waiting for first consumer to be created before binding`.
4. **Create a Pod using the PVC:** now the claim binds to the pre-created local PV and the Pod runs.
5. **Verify:** `kubectl get pvc,pv,pod`.

### Watch out
With `WaitForFirstConsumer` Pending is normal until a Pod uses the PVC.
