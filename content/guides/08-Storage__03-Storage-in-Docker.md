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
