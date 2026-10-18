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
