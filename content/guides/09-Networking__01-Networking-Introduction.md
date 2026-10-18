### Introduction

Kubernetes networking builds on ordinary Linux networking. This section first covers prerequisites (switching, routing, DNS, namespaces, Docker networking, CNI), then Kubernetes cluster networking, Pod networking, Services, DNS and Ingress.

### Roadmap

```
 prerequisites:  switching/routing ─ DNS ─ network namespaces ─ Docker networking ─ CNI
 cluster:        node ports, Pod network (CNI), Service network (kube-proxy)
 discovery:      CoreDNS
 exposure:       Services, Ingress
```

### Key takeaways

- If you know Linux networking basics, skip the prerequisites; otherwise they explain everything later.

### What you must be able to do by the end of this section

1. Explain how Pods get IP addresses and reach each other across nodes (CNI).
2. Explain what a ClusterIP is and how kube-proxy implements it.
3. Resolve Services by DNS and fix CoreDNS problems.
4. Expose applications with NodePort, Ingress or Gateway API.
5. Write NetworkPolicies (covered in Security).
6. Troubleshoot connectivity layer by layer.

### Connectivity debug ladder

```
 Pod → Pod IP        (CNI)
 Pod → Service IP    (kube-proxy, endpoints)
 Pod → Service name  (CoreDNS)
 outside → app       (NodePort / Ingress / Gateway)
```

Test from the bottom up and stop at the first layer that fails.
