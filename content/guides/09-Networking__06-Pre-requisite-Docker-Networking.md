### Introduction

How Docker uses namespaces, bridges and NAT to network containers. Kubernetes uses similar ideas.

### Network modes

| Mode | Behaviour |
|---|---|
| `none` | No network |
| `host` | Shares the host's network (no isolation; port conflicts) |
| `bridge` (default) | Private internal network `172.17.0.0/16` via `docker0` bridge |

```bash
docker run --network none nginx
docker run --network host nginx
docker network ls
ip addr show docker0
```

### How bridge mode works

For each container Docker creates a namespace and a veth pair attached to the bridge. Containers on the bridge reach each other by IP.

### Port mapping

Containers are not reachable from outside by default. Publish ports:

```bash
docker run -p 8080:80 nginx
```

Docker adds an iptables NAT rule:

```
iptables -t nat -A DOCKER -j DNAT --dport 8080 --to-destination 172.17.0.3:80
```

```bash
iptables -nvL -t nat
```

### Key takeaways

- Bridge + veth + iptables NAT = Docker networking.
- Kubernetes needs a different model (every Pod reachable without NAT), supplied by CNI plugins.
