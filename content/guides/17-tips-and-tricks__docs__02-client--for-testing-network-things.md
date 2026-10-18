### Introduction

A throwaway client Pod to test access to servers, DNS and ports.

### Create and use

```bash
kubectl run client --image=busybox:1.36 --labels=role=frontend --command -- sleep 3600
kubectl exec client -- wget -qO- -T2 http://server
kubectl exec client -- nslookup server
kubectl exec client -- nc -zv server 80
kubectl run tmp --rm -it --image=nicolaka/netshoot --restart=Never -- bash
```

### Tips

- Cross-namespace: `server.<ns>.svc.cluster.local`.
- Change labels to prove a policy: `kubectl label pod client role=other --overwrite`.
- Always test the baseline before applying a policy.
- Delete clients afterwards.

### Handy one-liners

```bash
kubectl exec client -- wget -qO- -T2 http://server.default.svc.cluster.local
kubectl exec client -- nc -zvw2 server 80
kubectl exec client -- cat /etc/resolv.conf
```
