### Introduction

A cluster has many certificates. Knowing which is which is key to troubleshooting.

### Certificate map

```
                 CA (ca.crt/ca.key)
        signs ───────┬──────────────────────┐
                     ▼                      ▼
 Server certificates              Client certificates
  apiserver.crt/key                admin.crt/key
  etcd server.crt/key              scheduler.crt/key
  kubelet server certs             controller-manager.crt/key
                                   kube-proxy.crt/key
                                   apiserver-etcd-client.crt/key
                                   apiserver-kubelet-client.crt/key
```

| Component | Role | Certificate |
|---|---|---|
| kube-apiserver | server | `apiserver.crt` |
| kube-apiserver | client of etcd | `apiserver-etcd-client.crt` |
| kube-apiserver | client of kubelets | `apiserver-kubelet-client.crt` |
| etcd | server | `etcd/server.crt` |
| etcd peers | server/client | `etcd/peer.crt` |
| kubelet | server | `kubelet.crt` |
| kubelet | client of API server | `kubelet-client-current.pem` |
| scheduler, controller manager, kube-proxy, admin | client | each own client cert |

### Multiple CAs

The cluster CA signs most; ETCD can use its own CA (`/etc/kubernetes/pki/etcd/ca.crt`). The front proxy has another.

### Locations (kubeadm)

```
/etc/kubernetes/pki/
   ca.crt  ca.key
   apiserver.crt  apiserver.key
   apiserver-etcd-client.crt/key
   apiserver-kubelet-client.crt/key
   front-proxy-ca.crt ...
   sa.key  sa.pub                  # service account signing
   etcd/ca.crt  server.crt  peer.crt ...
/etc/kubernetes/*.conf              # kubeconfigs for admin, scheduler, controller manager, kubelet
/var/lib/kubelet/pki/               # kubelet certs
```

### Key takeaways

- Every component needs a cert; servers and clients.
- Know the files and where they live.
