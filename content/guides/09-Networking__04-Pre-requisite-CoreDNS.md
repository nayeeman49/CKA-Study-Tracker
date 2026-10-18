### Introduction

CoreDNS is a flexible DNS server written in Go, and it's the default DNS in Kubernetes.

### Running it

```bash
wget https://github.com/coredns/coredns/releases/...
./coredns
```

It listens on port 53 and is configured with a **Corefile** made of plugins:

```
.:53 {
    errors
    health
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
    }
    prometheus :9153
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
}
```

The `hosts` plugin can serve entries from a file, and `kubernetes` serves cluster records.

### Key takeaways

- CoreDNS = pluggable DNS configured by the Corefile.

### Worked example: a tiny local DNS server

```
# Corefile
. {
    hosts /tmp/hosts {
        fallthrough
    }
    forward . 8.8.8.8
    log
}
```

```
# /tmp/hosts
192.168.1.10   web.example.test
```

```bash
./coredns -conf Corefile
dig @127.0.0.1 web.example.test
```

Plugins run in the order defined by CoreDNS (not the file order), `fallthrough` passes unanswered queries on, and `forward` sends them upstream. In Kubernetes the same Corefile lives in the `coredns` ConfigMap.
