## What this is
Cluster-state questions: quickly gather facts such as versions, CIDRs, runtimes, certificate expiry and counts of resources. These are free marks if you know where each fact lives.

## Where to find things
| Question | Command |
|---|---|
| Kubernetes / kubelet version | `kubectl version`, `kubectl get nodes` |
| Container runtime and OS | `kubectl get nodes -o wide` |
| Pod CIDR | `kubectl cluster-info dump \| grep -m1 cluster-cidr`, or the controller-manager manifest |
| Service CIDR | `grep service-cluster-ip-range /etc/kubernetes/manifests/kube-apiserver.yaml` |
| CNI in use | `ls /etc/cni/net.d`, `kubectl get pods -n kube-system` |
| etcd endpoints/certs | `kubectl -n kube-system describe pod etcd-<node>` |
| Certificate expiry | `kubeadm certs check-expiration` |
| Static pod path | `staticPodPath` in `/var/lib/kubelet/config.yaml` |
| Resource counts | `kubectl get <res> -A --no-headers \| wc -l` |

## Official documentation
- [kubectl reference](https://kubernetes.io/docs/reference/kubectl/)
- [Certificate Management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [Cluster Architecture](https://kubernetes.io/docs/concepts/architecture/)
