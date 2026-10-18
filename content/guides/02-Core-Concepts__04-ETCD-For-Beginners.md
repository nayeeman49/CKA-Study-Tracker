### Introduction

ETCD is a distributed, reliable key-value store. Kubernetes keeps all of its cluster state in it. Before you look at how Kubernetes uses ETCD, it helps to understand ETCD on its own: what a key-value store is, how it differs from a normal database, how several ETCD servers stay in agreement, and how to read and write data with `etcdctl`.

### What is a key-value store?

A traditional relational database stores data in tables with rows and columns. Adding a new attribute means changing the table for every row. A key-value store is simpler: every record is one key with one value, and records are independent.

```
Table style                    Key-value style
┌──────┬─────┬───────┐         name   = "Ana"
│ name │ age │ city  │         age    = "34"
├──────┼─────┼───────┤         city   = "Leeds"
│ Ana  │ 34  │ Leeds │
└──────┴─────┴───────┘
```

Each person can have different fields without touching anyone else's record. It is fast to look up by key and easy to replicate.

### What ETCD is

- Open source, started at CoreOS and now a CNCF project.
- Simple, secure (TLS client auth) and fast.
- Strongly **consistent**: every read returns the latest committed write.
- Distributed: several members form a cluster.
- Listens on **port 2379** for clients and **2380** for peer (member to member) traffic.

The name comes from the Unix `/etc` directory plus "d" for distributed.

### Installing and running ETCD (concept)

You download the binary, start it, and it listens on 2379.

```bash
./etcd                     # starts a server on localhost:2379
```

The command-line client is `etcdctl`. It has two API versions, and the version matters:

```bash
etcdctl version
export ETCDCTL_API=3        # use the v3 API (default in current releases)
```

Version 2 commands (`etcdctl set key value`) differ from version 3 (`etcdctl put key value`). The CKA uses **v3**.

### Basic operations

```bash
etcdctl put name "Ana"          # write
etcdctl get name                # read
etcdctl get name --print-value-only
etcdctl get / --prefix --keys-only   # list all keys
etcdctl del name                # delete
```

### How ETCD stays consistent: leader and followers

When you run several ETCD members, they need to agree on the order of writes, even if members fail. ETCD uses the **Raft** consensus algorithm.

```
              ┌───────────┐
   writes ──► │  LEADER   │
              └─────┬─────┘
          replicate │ log entries
        ┌───────────┴───────────┐
        ▼                       ▼
  ┌───────────┐           ┌───────────┐
  │ FOLLOWER  │           │ FOLLOWER  │
  └───────────┘           └───────────┘
```

How it works in plain terms:

1. One member is elected **leader**. The others are **followers**.
2. A client can talk to any member, but writes are forwarded to the leader.
3. The leader appends the write to its log and sends it to the followers.
4. The write is **committed** only when a **majority** (quorum) has stored it.
5. If the leader stops sending heartbeats, followers hold an election and a new leader takes over.

### Quorum - how many members you need

Quorum is the minimum number of members that must agree: `floor(N/2) + 1`.

| Members (N) | Quorum | Failures tolerated |
|---|---|---|
| 1 | 1 | 0 |
| 2 | 2 | 0 |
| 3 | 2 | 1 |
| 4 | 3 | 1 |
| 5 | 3 | 2 |
| 6 | 4 | 2 |
| 7 | 4 | 3 |

Two takeaways for exams and real life:

- **Use an odd number** of members. Four members tolerate no more failures than three, but need more machines.
- With **1 or 2** members you have no real fault tolerance. Three is the practical minimum for HA; five is common for larger clusters.

If quorum is lost (for example, two of three members die), the cluster becomes read-only or unavailable until quorum returns. It will not accept writes that it cannot safely agree on.

### Watching for changes

Kubernetes components do not poll constantly. ETCD supports **watches**: a client asks to be notified when a key changes.

```bash
etcdctl watch /registry/pods --prefix
```

The API Server uses this to react quickly when objects change.

### Snapshots and backup (preview)

ETCD can save a point-in-time copy of its whole database:

```bash
etcdctl snapshot save backup.db
etcdctl snapshot status backup.db
```

You will use this for real in the cluster maintenance section.

### Troubleshooting ideas

- **Cannot connect**: check the endpoint and port (`--endpoints=https://127.0.0.1:2379`).
- **Auth errors**: a secure ETCD needs `--cacert`, `--cert`, `--key` (covered in the next page).
- **"no leader" errors**: quorum has been lost; bring members back.
- **Wrong results or strange command syntax**: check `ETCDCTL_API`.

### CKA exam tips

- Know ports **2379** (client) and **2380** (peer).
- Know that ETCD uses **Raft** and needs a **majority**.
- `ETCDCTL_API=3` is the safe default when typing commands from memory.

### Key takeaways

- ETCD is a consistent, distributed key-value store.
- One leader handles writes; followers replicate them.
- A write succeeds only when a majority has it.
- Use an odd number of members; three or five for HA.
- `etcdctl put/get/del` are the basic operations.
