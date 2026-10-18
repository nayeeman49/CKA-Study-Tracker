### Introduction

Security in Kubernetes is layered. Everything starts at the API Server, because every action goes through it. This page maps the questions you must answer: who can access the cluster, and what can they do?

### Layers

```
 Client ─► [Authentication] ─► [Authorization] ─► [Admission] ─► API action
            who are you?        what may you do?    policy checks
```

### Hosts and components

- Secure the nodes: disable password SSH, use key-based login, disable root login.
- Keep the control plane reachable only by necessary networks.

### Authentication (who)

Mechanisms for the API Server:

- Static password / token files (basic, **not for production**, removed in modern versions).
- Client certificates (X509).
- External identity providers: LDAP, OIDC, Kerberos.
- Service accounts for machines.

### Authorization (what)

- **RBAC** (role based) - standard.
- **ABAC** (attribute based) - old, file-based.
- **Node authorizer** - for kubelets.
- **Webhook** - external service decides.
- `AlwaysAllow` / `AlwaysDeny` - testing.

### Other protections

| Area | Mechanism |
|---|---|
| Communication | TLS between all components |
| Pod-to-Pod | NetworkPolicies (default: all allowed) |
| Workload | SecurityContext, Pod Security Standards |
| Images | Private registries, image pull secrets |
| Secrets | RBAC, encryption at rest |
| Admission | Admission controllers, ValidatingAdmissionPolicy |

### Key takeaways

- Authentication → authorization → admission, all at the API Server.
- Every lesson in this section implements one layer.
