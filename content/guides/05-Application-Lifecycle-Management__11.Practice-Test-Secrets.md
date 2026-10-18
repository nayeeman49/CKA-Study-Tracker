### How to approach this lab

Create a Secret and wire it into a Pod, often a web app talking to a DB.

### Commands

```bash
kubectl get secrets
kubectl describe secret dashboard-token
kubectl create secret generic db-secret --from-literal=DB_Host=sql01 --from-literal=DB_User=root --from-literal=DB_Password=password123
kubectl get pod webapp-pod -o yaml > w.yaml
vi w.yaml    # add envFrom: - secretRef: name: db-secret
kubectl replace --force -f w.yaml
kubectl exec webapp-pod -- env | grep DB_
```

### Notes

- Decode a value: `kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d`.
- A Pod referencing a missing Secret shows `CreateContainerConfigError`.

### Worked example

```bash
kubectl create secret generic db-secret --from-literal=DB_Host=sql01 --from-literal=DB_User=root --from-literal=DB_Password=password123
kubectl get pod webapp-pod -o yaml > w.yaml
```

```yaml
    envFrom:
    - secretRef:
        name: db-secret
```

```bash
kubectl replace --force -f w.yaml
kubectl exec webapp-pod -- printenv | grep DB_
kubectl get secret db-secret -o jsonpath='{.data.DB_Password}' | base64 -d
```

### Common mistakes

- Base64-encoding a value and then also using `--from-literal` (double encoding).
- Forgetting `echo -n` when encoding by hand.
