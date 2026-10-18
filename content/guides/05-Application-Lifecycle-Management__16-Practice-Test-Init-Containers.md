### How to approach this lab

Read Pods with init containers and fix ones that are stuck.

### Commands

```bash
kubectl get pods                         # Init:0/1 or Init:Error
kubectl describe pod blue                # init container section
kubectl logs red -c init-myservice
kubectl get pod orange -o yaml > o.yaml
vi o.yaml                                # fix typo in command (e.g. sleeeep)
kubectl replace --force -f o.yaml
```

### Typical findings

- The init command has a typo, so the Pod is in `Init:Error`/`CrashLoopBackOff`.
- An init container sleeps for N seconds, so the Pod stays `Init:0/1` until it finishes.
- Init container is waiting for a Service that doesn't exist yet; create the Service.

### Worked example

```bash
kubectl get pod red
#  NAME  READY  STATUS     RESTARTS
#  red   0/1    Init:0/1   0
kubectl describe pod red | sed -n '/Init Containers/,/Containers:/p'
kubectl logs red -c init-myservice
```

If the init container waits for a Service, create it so DNS resolves; if the command has a typo (`sleeeep`), fix and recreate:

```bash
kubectl get pod orange -o yaml > o.yaml ; vi o.yaml
kubectl replace --force -f o.yaml
```

### Common mistakes

- Looking at `kubectl logs red` (main container) rather than `-c <init container>`.
- Expecting the Pod to be Running while init containers are still working.
