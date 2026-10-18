### How to approach this lab

Answer questions about CoreDNS and fix DNS-related application problems.

### Commands

```bash
kubectl get pods -n kube-system | grep dns
kubectl get svc -n kube-system
kubectl -n kube-system describe deploy coredns | grep -i -E "args|config"
kubectl get cm -n kube-system coredns -o yaml
kubectl exec -it hr -- nslookup mysql.payroll > /root/nslookup.out
kubectl describe pod webapp | grep -i mysql        # DB_Host env
kubectl edit deploy webapp                         # fix DB_Host to mysql.payroll
```

### Typical answers

| Question | Where |
|---|---|
| Root domain | Corefile `kubernetes cluster.local` |
| Config file location in Pod | `/etc/coredns/Corefile` |
| How configured | ConfigMap `coredns` mounted into Pods |
| Service name for reaching DNS | `kube-dns` |
| Cross-namespace reachability | `service.namespace` |

### Worked example

```bash
kubectl -n kube-system get deploy coredns
kubectl -n kube-system get cm coredns -o jsonpath='{.data.Corefile}'
kubectl exec -it hr -- nslookup mysql.payroll > /root/CKA/nslookup.out
kubectl get pod webapp -o yaml | grep -A2 DB_Host
kubectl set env deploy/webapp DB_Host=mysql.payroll
```

The `hr` Pod in a different namespace needs `mysql.payroll` (or the full `mysql.payroll.svc.cluster.local`); plain `mysql` only works in the same namespace.
