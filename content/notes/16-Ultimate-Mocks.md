## What this is
Scenario labs aimed at the 30% *Troubleshooting* domain: a broken PVC and a NetworkPolicy blocking a Pod. They train you to read evidence rather than guess.

## Approach
1. `kubectl get pods -A -o wide`, then `describe` the failing object; read Events.
2. For storage faults: PVC `Pending`? Compare `storageClassName`, `accessModes`, requested size, and look at the PV (`kubectl get pv`) and whether the StorageClass binds immediately.
3. For network faults: list policies (`kubectl get netpol -A`), read selectors (remember AND vs OR in `from`), and test with a temporary Pod (`kubectl run t --rm -it --image=busybox -- wget -qO- -T2 <svc>`).
4. Fix by editing the smallest thing; re-test.

## Official documentation
- [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)


## What this is
A storage scenario around PersistentVolumeClaims. Expect to create or repair a PV/PVC pair and mount it in a Pod or Deployment.

## Checklist
- PV: capacity, `accessModes`, `persistentVolumeReclaimPolicy`, `storageClassName`, backend (`hostPath`/CSI).
- PVC: same class and access mode, request ≤ PV capacity.
- Pod: `volumes[].persistentVolumeClaim.claimName` and a matching `volumeMounts[].mountPath`.
- Verify: `kubectl get pv,pvc` shows `Bound`; `kubectl exec` and write a file; recreate the Pod and confirm the data persists.

## Official documentation
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Configure a Pod to Use a PersistentVolume](https://kubernetes.io/docs/tasks/configure-pod-container/configure-persistent-volume-storage/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)


## What this is
A Services & Networking scenario (exposing an external web server). Practise creating Services and Endpoints, including Services without selectors that point at an external IP.

## Key ideas
- A Service **without a selector** gets no automatic Endpoints; you create an `Endpoints`/`EndpointSlice` object with the external IP and port yourself, or use `type: ExternalName`.
- `kubectl create service clusterip|nodeport` and `kubectl expose` generate Services quickly; verify with `kubectl get ep`.
- Test from inside the cluster with a throwaway Pod.

## Official documentation
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/) (see "Services without selectors")
- [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)


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


