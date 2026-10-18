### Introduction

TLS provides encryption in transit and authentication.

### Symmetric vs asymmetric encryption

| | Symmetric | Asymmetric |
|---|---|---|
| Keys | One shared key | Public + private key pair |
| Speed | Fast | Slow |
| Problem | Key distribution | Used to solve it |

A public key encrypts; only the matching private key decrypts. Public keys can be shared freely.

### The TLS handshake

```
 client                                   server
   │ ── hello ─────────────────────────►    │
   │ ◄── certificate (server public key) ── │
   │ verify cert is signed by trusted CA    │
   │ generate symmetric key, encrypt it     │
   │ ── with the server's public key ─────► │
   │      both now use the symmetric key    │
```

### Certificates and CAs

A **certificate** binds a public key to an identity (name), signed by a **Certificate Authority**. Browsers trust public CAs. Inside a cluster you run a **private CA**.

```
 file         role
 *.crt, *.pem public key / certificate
 *.key        private key
```

Generate a key and a signing request:

```bash
openssl genrsa -out my.key 2048
openssl req -new -key my.key -subj "/CN=my-server" -out my.csr
openssl x509 -req -in my.csr -CA ca.crt -CAkey ca.key -out my.crt -days 365
```

### Client certificates

Servers can also demand a client certificate (mutual TLS) to authenticate the client. Used heavily between Kubernetes components.

### PKI

Public Key Infrastructure: CAs, certificates, and the process of issuing and managing them.

### Key takeaways

- Asymmetric encryption exchanges a symmetric key.
- CA-signed certificates prove identity.
