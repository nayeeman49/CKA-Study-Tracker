### Introduction

Volumes are handled by **volume driver plugins**. The default is `local`. Others can provide remote storage: Azure File Storage, GlusterFS, Portworx, NetApp, REX-Ray (AWS EBS, S3, Google Persistent Disk) and more.

```bash
docker run -it --name mysql --volume-driver rexray/ebs --mount src=ebs-vol,target=/var/lib/mysql mysql
```

This creates a volume on a cloud disk, persisting even if the host disappears.

### Key takeaways

- Plugins let containers use external storage backends.
- This is the precursor of the Kubernetes Container Storage Interface.

### Why this matters for Kubernetes

Docker's volume plugins hid storage details behind a driver. Kubernetes took the same idea further: instead of each runtime having plugins, the **CSI** standard lets any vendor ship a driver that works in any orchestrator. When you see `provisioner: ebs.csi.aws.com` in a StorageClass, that's the descendant of a Docker volume driver.

```
Docker:       container ─► volume driver (rexray/ebs) ─► cloud disk
Kubernetes:   Pod ─► PVC ─► StorageClass ─► CSI driver ─► cloud disk
```
