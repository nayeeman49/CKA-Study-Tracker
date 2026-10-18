### How to approach this lab

A deeper Ingress lab: deploy the controller, then expose apps.

### Typical flow

```bash
kubectl create namespace ingress-nginx
kubectl apply -f ingress-controller.yaml       # configmap, SA, roles, deployment, service
kubectl get all -n ingress-nginx
kubectl get ingressclass
kubectl create ingress ... 
curl http://<node-ip>:30080/wear
```

### Tips

- The controller Service is NodePort (e.g. 30080); that is the external port.
- If the controller needs an `IngressClass` argument, check `--ingress-class` / `--controller-class` args.
- `kubectl describe ingress` shows backends and any errors.
- Use `kubectl logs -n ingress-nginx deploy/ingress-nginx-controller` to see requests and errors.

### Worked example

```bash
kubectl create ns ingress-nginx
kubectl apply -f ingress-controller.yaml
kubectl -n ingress-nginx get deploy,svc          # NodePort 30080
kubectl get ingressclass
kubectl create ingress shop -n app-space --class=nginx --rule="/pay=pay-service:8282"
curl -I http://<node-ip>:30080/pay
```

If `curl` returns 404 from nginx, check the path; 503 means the Service has no ready endpoints; connection refused means the controller Service isn't exposed.
