### Introduction

ETCD must also be highly available. This lesson covers topology and quorum for ETCD in HA clusters.

### Topologies

| Topology | Description | Trade-offs |
|---|---|---|
| **Stacked** | ETCD on the same nodes as the control plane | Simple, fewer machines; losing a node loses both |
| **External** | ETCD on dedicated nodes | More resilience, more machines |

### Quorum and fault tolerance

`quorum = floor(N/2) + 1`.

| N | Quorum | Tolerates |
|---|---|---|
| 1 | 1 | 0 |
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

Use odd numbers; 3 or 5 is typical. An even number gives no extra tolerance (4 tolerates 1, like 3). In a network split, the side with the majority continues.

### Setting up

Each member is started with:

```
--name etcd-1
--initial-advertise-peer-urls https://10.0.0.1:2380
--listen-peer-urls https://10.0.0.1:2380
--listen-client-urls https://10.0.0.1:2379,https://127.0.0.1:2379
--advertise-client-urls https://10.0.0.1:2379
--initial-cluster-token etcd-cluster-1
--initial-cluster etcd-1=https://10.0.0.1:2380,etcd-2=https://10.0.0.2:2380,etcd-3=https://10.0.0.3:2380
--initial-cluster-state new
```

The API server lists all members: `--etcd-servers=https://10.0.0.1:2379,https://10.0.0.2:2379,https://10.0.0.3:2379`.

### Operations

```bash
etcdctl member list -w table
etcdctl endpoint status --cluster -w table
etcdctl endpoint health --cluster
```

### Key takeaways

- 3 or 5 members; losing quorum stops writes.
