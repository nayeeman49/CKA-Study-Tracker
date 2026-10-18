### Introduction

Kubernetes runs an internal DNS server so Pods find Services by name.

### Service records

For a Service `web-service` in namespace `apps`:

```
web-service                              (same namespace)
web-service.apps
web-service.apps.svc
web-service.apps.svc.cluster.local       (fully qualified)
```

Root domain `cluster.local`, then `svc`, then namespace.

### Pod records

Not created by default; if enabled, Pods get names such as `10-244-2-5.apps.pod.cluster.local` (dots replaced by dashes).

### How Pods use it

The kubelet writes `/etc/resolv.conf` in each Pod:

```
nameserver 10.96.0.10          # the kube-dns Service IP
search apps.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

The search list makes short names work. `ndots:5` means names with fewer than five dots try the search domains first.

### Test

```bash
kubectl run test --image=busybox:1.28 --rm -it --restart=Never -- nslookup web-service
kubectl exec -it pod -- cat /etc/resolv.conf
kubectl run test --image=busybox:1.28 --rm -it --restart=Never -- nslookup web-service.apps.svc.cluster.local
```

### Key takeaways

- `service.namespace.svc.cluster.local`; resolv.conf search domains make short names work.
