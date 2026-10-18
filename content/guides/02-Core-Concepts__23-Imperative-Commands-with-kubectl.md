### Introduction

In the exam you have limited time, so you must create objects quickly. Kubernetes supports two styles:

| Style | Example | When |
|---|---|---|
| **Imperative** | `kubectl run`, `create`, `expose`, `scale`, `set image` | Fast one-off tasks |
| **Declarative** | `kubectl apply -f file.yaml` | Reusable, version-controlled, complex objects |

The best exam workflow mixes them: use imperative commands with `--dry-run=client -o yaml` to *generate* YAML, edit it, then apply.

### The two key flags

```bash
--dry-run=client      # don't create, just validate locally
-o yaml               # print the YAML
```

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
```

### Cheat sheet

#### Pods

```bash
kubectl run nginx --image=nginx
kubectl run nginx --image=nginx --port=80 --labels="app=web"
kubectl run busybox --image=busybox --command -- sleep 3600
kubectl run nginx --image=nginx --env="KEY=value"
```

#### Deployments

```bash
kubectl create deployment web --image=nginx --replicas=3
kubectl scale deployment web --replicas=5
kubectl set image deployment/web nginx=nginx:1.27
kubectl rollout undo deployment/web
```

#### Services

```bash
kubectl expose pod redis --port=6379 --name=redis-service
kubectl expose deployment web --port=80 --type=NodePort
kubectl create service clusterip my-svc --tcp=80:8080
```

#### Namespaces, ConfigMaps, Secrets

```bash
kubectl create ns dev
kubectl create configmap app --from-literal=color=blue
kubectl create secret generic db --from-literal=password=pass
```

#### Others you will use later

```bash
kubectl create job pi --image=perl -- perl -Mbignum=bpi -wle 'print bpi(100)'
kubectl create cronjob hello --image=busybox --schedule="*/1 * * * *" -- echo hi
kubectl create role / rolebinding / clusterrole / clusterrolebinding
kubectl create serviceaccount sa
```

### Updating existing objects

```bash
kubectl edit deployment web           # opens in vi
kubectl replace -f file.yaml
kubectl replace --force -f file.yaml  # delete and recreate
kubectl apply -f file.yaml
kubectl delete -f file.yaml
```

### Apply internals (why declarative matters)

`kubectl apply` stores the last applied configuration in an annotation `kubectl.kubernetes.io/last-applied-configuration`, and does a three-way merge between the live object, the file, and the last applied. Don't mix `create` and `apply` on the same object if you can avoid it.

### Useful exam shortcuts

```bash
alias k=kubectl
export do="--dry-run=client -o yaml"
k run x --image=nginx $do
source <(kubectl completion bash)
complete -F __start_kubectl k
```

(Often already set up in the exam environment; check first.)

### Imperative limits

You can't set many fields imperatively (volumes, resource limits, tolerations, probes, multi containers). Generate YAML, then edit it with `vi`.

### Key takeaways

- Imperative for speed, declarative for reproducibility.
- `--dry-run=client -o yaml` is the most useful exam trick.
- `kubectl explain` and `-h` help when you forget syntax.
