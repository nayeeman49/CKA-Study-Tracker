## What this is
Helper setups for testing: a server and client Pod you can use to check NetworkPolicies and connectivity.

## Useful patterns
- A throwaway test client: `kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh` (or `nicolaka/netshoot` for `dig`, `curl`, `tcpdump`).
- Test a policy: from a labelled client Pod, `wget -qO- -T2 http://server`; a timeout means blocked, "connection refused" means reachable but nothing listening.
- Label Pods (`kubectl label pod client role=frontend`) to match `podSelector` rules, and use `kubectl get pods --show-labels`.
- Before/after: test **before** applying the policy so you know the baseline.

## Official documentation
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Debug Services](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
- [Get a Shell to a Running Container](https://kubernetes.io/docs/tasks/debug/debug-application/get-shell-running-container/)
