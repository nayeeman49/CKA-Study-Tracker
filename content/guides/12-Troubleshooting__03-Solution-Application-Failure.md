### Introduction

A worked method to solve application failure labs.

### Steps and answers

1. `kubectl get all -n <ns>` for an overview.
2. Frontend not reachable: `kubectl describe svc webapp-service` → check selector and NodePort; compare with Pod labels. Fix a typo in the selector (`name: webapp-mysql` vs `name: webapp`).
3. Backend unreachable: `kubectl describe svc mysql-service` → targetPort; the Service name must match the DB host in the web app's env (`DB_Host`).
4. Credentials: `DB_User` / `DB_Password` in the web Deployment must match MySQL's `MYSQL_ROOT_PASSWORD`.
5. NodePort: confirm the expected `nodePort` in the Service spec.
6. Fix with `kubectl edit`, wait for the rollout, test again in the browser or with `curl`.

### Pattern to remember

```bash
kubectl edit svc web-service            # selector/ports
kubectl edit deploy webapp-mysql        # env/ports
kubectl rollout status deploy/webapp-mysql
```

### Tip

Change one thing at a time and re-test so you know which fix worked.
