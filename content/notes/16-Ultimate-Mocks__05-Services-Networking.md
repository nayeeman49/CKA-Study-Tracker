## What this is
A Services & Networking scenario (exposing an external web server). Practise creating Services and Endpoints, including Services without selectors that point at an external IP.

## Key ideas
- A Service **without a selector** gets no automatic Endpoints; you create an `Endpoints`/`EndpointSlice` object with the external IP and port yourself, or use `type: ExternalName`.
- `kubectl create service clusterip|nodeport` and `kubectl expose` generate Services quickly; verify with `kubectl get ep`.
- Test from inside the cluster with a throwaway Pod.

## Official documentation
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/) (see "Services without selectors")
- [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
