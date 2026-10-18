### Introduction

DNS maps names to IP addresses.

### Local name resolution

`/etc/hosts` maps names to IPs on a single machine:

```
192.168.1.11   db
```

For many hosts, use a DNS server. Point hosts at it in `/etc/resolv.conf`:

```
nameserver 192.168.1.100
search mycompany.com prod.mycompany.com
```

Order of lookup is in `/etc/nsswitch.conf` (`hosts: files dns`: files first, then DNS).

### Domain hierarchy

```
 root (.) ─► com ─► google ─► www
 www.google.com  = host www in domain google.com
```

`search` domains let you type `web` and resolve `web.mycompany.com`.

### Record types

| Type | Maps |
|---|---|
| A | name → IPv4 |
| AAAA | name → IPv6 |
| CNAME | name → another name (alias) |
| MX, TXT, SRV, PTR | mail, text, service location, reverse |

### Tools

```bash
ping web
nslookup www.google.com        # ignores /etc/hosts
dig www.google.com
host web
```

### Key takeaways

- Files, then DNS; `resolv.conf` sets the server and search domains.
