### How to approach this lab

Inspect the default kubeconfig, switch contexts, and repair a broken file.

### Commands

```bash
kubectl config view
kubectl config get-contexts
kubectl config use-context research --kubeconfig /root/my-kube-config
kubectl config current-context --kubeconfig /root/my-kube-config
export KUBECONFIG=/root/my-kube-config
vi /root/.kube/config          # fix path/typos
cp /root/my-kube-config /root/.kube/config
```

### Fixing a broken kubeconfig

Typical issue: the `certificate-authority` or client certificate path has a typo (`ca.crt` vs `ca.crt`), or wrong port. Compare to files in `/etc/kubernetes/pki/users/`.

### Notes

- Count entries: clusters, users, contexts via `kubectl config view`.
- `--kubeconfig` overrides the default location for that command.

### Worked example

```bash
kubectl config view --kubeconfig /root/my-kube-config
kubectl config get-contexts --kubeconfig /root/my-kube-config
kubectl config use-context research --kubeconfig /root/my-kube-config
kubectl config current-context --kubeconfig /root/my-kube-config
```

Make it the default:

```bash
cp /root/my-kube-config /root/.kube/config
```

Broken `kubectl get pods` ("unable to read certificate-authority ..."): compare the `certificate-authority:` path in `~/.kube/config` with `ls /etc/kubernetes/pki/` and fix the filename.

### Common mistakes

- Setting `KUBECONFIG` in one shell and testing in another.
- Using `use-context` without `--kubeconfig` when a non-default file is meant.
