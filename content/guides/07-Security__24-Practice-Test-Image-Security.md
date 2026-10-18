### How to approach this lab

Find image details of existing Pods and make a Pod pull from a private registry.

### Commands

```bash
kubectl describe pod web | grep Image
kubectl get deploy web -o yaml | grep image
kubectl create secret docker-registry private-reg-cred \
  --docker-username=dock_user --docker-password=dock_password \
  --docker-server=myprivateregistry.com:5000 --docker-email=dock_user@myprivateregistry.com
kubectl edit deploy web           # add imagePullSecrets
kubectl get pods -w
```

Under `spec.template.spec`:

```yaml
imagePullSecrets:
- name: private-reg-cred
```

### Notes

- Image `myprivateregistry.com:5000/nginx:alpine`: registry = `myprivateregistry.com:5000`.
- Check events for `ErrImagePull` after the change.

### Worked example

```bash
kubectl create secret docker-registry private-reg-cred \
  --docker-username=dock_user --docker-password=dock_password \
  --docker-server=myprivateregistry.com:5000 --docker-email=dock_user@myprivateregistry.com
kubectl edit deploy web
```

```yaml
    spec:
      imagePullSecrets:
      - name: private-reg-cred
      containers:
      - name: nginx
        image: myprivateregistry.com:5000/nginx:alpine
```

```bash
kubectl rollout status deploy/web
```

### Common mistakes

- Secret created in a different namespace.
- Putting `imagePullSecrets` under the container instead of the Pod spec.
