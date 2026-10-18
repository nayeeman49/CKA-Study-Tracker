### Introduction

How machines talk on a network.

### Switching

A **switch** connects hosts on one network (e.g. 192.168.1.0/24). Each host has an interface (`eth0`).

```bash
ip link                         # list interfaces
ip addr add 192.168.1.10/24 dev eth0
ip addr show
```

Hosts on the same network communicate through the switch without a router.

### Routing

A **router** connects different networks (192.168.1.0/24 and 192.168.2.0/24). It has an IP on each. Hosts need a route to tell them where to send traffic for other networks.

```bash
ip route                        # or route
ip route add 192.168.2.0/24 via 192.168.1.1
ip route add default via 192.168.1.1
```

### Gateway

The gateway is the router address a host uses to leave its network. The **default gateway** (`0.0.0.0/0`) handles anything with no specific route.

### Linux as a router

By default Linux does not forward packets between interfaces.

```bash
cat /proc/sys/net/ipv4/ip_forward        # 0 = off
echo 1 > /proc/sys/net/ipv4/ip_forward
# permanent: /etc/sysctl.conf  net.ipv4.ip_forward = 1
```

### Diagnostics

```bash
ping 192.168.2.5
traceroute 192.168.2.5
ip route get 192.168.2.5
```

### Key takeaways

- Switch = same network; router = between networks; route entries + gateways.
- IP forwarding must be enabled for a Linux router (and Kubernetes nodes need it).
