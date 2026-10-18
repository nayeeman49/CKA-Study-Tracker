### Introduction

Solutions for typical control plane failures.

### Examples

1. **Pods stuck Pending**: scheduler Pod in `CrashLoopBackOff`. Logs say the config path is wrong. Edit the manifest to the real path and let the kubelet recreate the Pod.
2. **Scaling does nothing**: `kube-controller-manager` crashing; logs reveal missing certificate file; the hostPath in the manifest points to a non-existent directory. Correct the `path:` under `volumes` to `/etc/kubernetes/pki`.
3. **Both fixed**: verify `kubectl get pods -n kube-system` all `Running`.

### Checklist

- Compare each flag path with files in the actual directory (`ls /etc/kubernetes/pki`).
- Check that `volumeMounts.mountPath` and `volumes.hostPath.path` pair up.
- Wait about a minute after saving.

### Order of checks

1. `kubectl get pods -n kube-system` (which Pod is not Running?).
2. `kubectl logs` / `crictl logs` (what exactly is wrong?).
3. Compare the manifest against reality: `ls` every path it names.
4. Edit, save, wait, verify with a functional test (scale a Deployment, create a Pod).

A functional test matters: a Pod can be `Running` while still misconfigured.
