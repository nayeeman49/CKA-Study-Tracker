### Introduction

Before Kubernetes storage, understand how containers handle data. Containers are ephemeral; when they are removed their data goes with them unless it is stored outside.

### Two kinds of Docker storage

1. **Storage drivers / layered filesystem** - how image and container layers are stored.
2. **Volume drivers** - how persistent data is stored.

### Layered architecture

An image is a stack of read-only layers (one per Dockerfile instruction). A running container adds a thin writable layer on top.

```
 ┌───────────────────────┐
 │ container layer (R/W) │  deleted with the container
 ├───────────────────────┤
 │ image layer 4 (RO)    │
 │ image layer 3 (RO)    │
 │ image layer 2 (RO)    │
 │ image layer 1 (RO)    │
 └───────────────────────┘
```

Layers are cached and shared among images, which saves space and speeds builds.

**Copy-on-write**: modifying a file from an image layer copies it up into the writable layer first.

### Key takeaways

- Data in the writable layer is lost when the container is removed; use volumes.
