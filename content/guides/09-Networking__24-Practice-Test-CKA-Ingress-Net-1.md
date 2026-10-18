### How to approach this lab

Inspect and create Ingress resources for several Services in different namespaces.

### Commands

```bash
kubectl get pods -A
kubectl get ingress -A
kubectl describe ingress -n app-space
kubectl get svc -A | grep -i -E "wear|video|food"
kubectl edit ingress ingress-wear-watch -n app-space
kubectl create ingress ingress-pay -n critical-space --rule="/pay=pay-service:8282" \
  --annotation nginx.ingress.kubernetes.io/rewrite-target=/
```

### Approach for each task

1. Find the Service name and **port** (`kubectl get svc -n ns`).
2. Check the namespace the Service is in; the Ingress must be there too.
3. Build the Ingress (path, pathType, backend, annotation).
4. Test with `curl <node-ip>:<nodeport>/path`.

### Common errors

- Wrong port number.
- Missing rewrite annotation when the app serves at `/`.
- Using the wrong namespace.

### Worked example

```bash
kubectl get svc -n app-space                     # wear-service:8080, video-service:8080
kubectl create ingress ingress-wear-watch -n app-space \
  --rule="/wear=wear-service:8080" --rule="/watch=video-service:8080" \
  --annotation nginx.ingress.kubernetes.io/rewrite-target=/ \
  --annotation nginx.ingress.kubernetes.io/ssl-redirect=false
kubectl describe ingress -n app-space
curl http://<node-ip>:<node-port>/wear
```

### Common mistakes

- Wrong Service port.
- Ingress in a namespace different from its Services.
- Missing `rewrite-target` when the app serves at `/`.
