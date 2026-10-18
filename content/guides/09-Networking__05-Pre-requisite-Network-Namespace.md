### Introduction

Linux **network namespaces** isolate network stacks: each has its own interfaces, routes and ARP table. Containers use them for isolation.

### Create and use

```bash
ip netns add red
ip netns add blue
ip netns list
ip netns exec red ip link          # run a command inside
ip -n red link                     # shorter
```

The namespace sees none of the host's interfaces.

### Connect two namespaces with a virtual cable

```bash
ip link add veth-red type veth peer name veth-blue
ip link set veth-red netns red
ip link set veth-blue netns blue
ip -n red addr add 192.168.15.1/24 dev veth-red
ip -n blue addr add 192.168.15.2/24 dev veth-blue
ip -n red link set veth-red up
ip -n blue link set veth-blue up
ip netns exec red ping 192.168.15.2
```

### Many namespaces: a virtual bridge

For more than two, create a bridge switch on the host:

```bash
ip link add v-net-0 type bridge
ip link set dev v-net-0 up
ip link add veth-red type veth peer name veth-red-br
ip link set veth-red netns red
ip link set veth-red-br master v-net-0
ip -n red addr add 192.168.15.1/24 dev veth-red
ip -n red link set veth-red up
ip link set veth-red-br up
```

Give the bridge an IP so the host can reach namespaces: `ip addr add 192.168.15.5/24 dev v-net-0`.

### Reaching the outside

```bash
ip netns exec blue ip route add default via 192.168.15.5
iptables -t nat -A POSTROUTING -s 192.168.15.0/24 -j MASQUERADE
```

### Reaching inwards (port forwarding)

```bash
iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 192.168.15.2:80
```

### Key takeaways

- Namespace = isolated network stack; veth pairs + bridge + NAT connect it. This is what container runtimes automate.
