## What this section is about
At 30% this is the biggest domain. You are given a broken cluster or app and must find and fix the fault fast. Method beats memory: work from symptom to layer, read the evidence (events, logs, status), change one thing at a time.

## A general method
1. **What is the symptom?** (Pending, CrashLoopBackOff, ImagePullBackOff, NotReady node, 503, timeout)
2. `kubectl get` (wide, `-A`) → `kubectl describe` (read Events at the bottom) → `kubectl logs [--previous]`.
3. Decide the layer: Pod/container → Service/network → node → control plane.

## Application failures
| Status | Usual cause |
|---|---|
| `Pending` | No node fits: requests too big, taint, selector/affinity, unbound PVC |
| `ImagePullBackOff` / `ErrImagePull` | Typo in image/tag, private registry without `imagePullSecrets` |
| `CrashLoopBackOff` | App exits: bad command/args, missing config/secret, failing probe, OOMKilled (exit 137) |
| `CreateContainerConfigError` | Missing ConfigMap/Secret key |
| `Running` but not Ready | Readiness probe failing; Service has no endpoints |
For Service issues: selector labels match Pod labels → `kubectl get ep` not empty → `targetPort` matches the container port → NetworkPolicy → DNS.

## Control-plane failures
On kubeadm clusters components are static pods. Symptoms: `kubectl` times out, Pods never get created or scheduled.
- API server down: `crictl ps -a | grep apiserver`, `crictl logs`, check `/etc/kubernetes/manifests/kube-apiserver.yaml` for typos in flags or certificate paths, and `journalctl -u kubelet`.
- Scheduler broken: new Pods stay Pending with no events; check `kube-scheduler` logs and its manifest/kubeconfig path.
- Controller manager broken: Deployments don't create ReplicaSets/Pods, nodes don't get marked NotReady.
- etcd problems: API server errors about etcd; verify its data dir and certificates.
Editing a static-pod manifest makes the kubelet recreate it automatically.

## Worker-node failures
`kubectl get nodes` shows `NotReady`. On the node: `systemctl status kubelet containerd`, `journalctl -u kubelet`, `df -h`/`free -m` for disk and memory pressure, check kubelet config `/var/lib/kubelet/config.yaml`, kubeconfig `/etc/kubernetes/kubelet.conf`, and certificate expiry (`openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -noout -dates`). Wrong CA path or API server address in `kubelet.conf` is a classic injected bug. Restart with `systemctl daemon-reload && systemctl restart kubelet`.

## Networking failures
Test from a throwaway Pod (`busybox` / `nicolaka/netshoot`). DNS: `nslookup kubernetes.default`; CoreDNS Pods Running? CNI missing → node NotReady; kube-proxy crashing → Services not routing (check ConfigMap `kube-proxy` and its logs). Review NetworkPolicies with `kubectl get netpol -A`.

## Exam tips
- Read the Events first; they usually name the problem.
- `kubectl get pods -A | grep -v Running` finds the broken things.
- Use `kubectl debug node/<n> -it --image=busybox` or `crictl` when you can't SSH to run commands.
- If you change a manifest and nothing happens, check the kubelet logs for YAML errors.

## Official documentation
- [Troubleshooting Applications](https://kubernetes.io/docs/tasks/debug/debug-application/), [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/), [Debug Services](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
- [Troubleshooting Clusters](https://kubernetes.io/docs/tasks/debug/debug-cluster/), [Debugging nodes with crictl](https://kubernetes.io/docs/tasks/debug/debug-cluster/crictl/)
- [Determine the Reason for Pod Failure](https://kubernetes.io/docs/tasks/debug/debug-application/determine-reason-pod-failure/)
- [Debugging DNS Resolution](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/)
- [Logging Architecture](https://kubernetes.io/docs/concepts/cluster-administration/logging/)
