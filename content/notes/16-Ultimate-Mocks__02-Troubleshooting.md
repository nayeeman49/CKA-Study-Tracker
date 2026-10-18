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
