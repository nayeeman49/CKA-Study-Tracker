### Introduction

Before configuring commands in Kubernetes you need to know how Docker images define what runs: `ENTRYPOINT` and `CMD`.

### Containers run a process, not an OS

A container lives only as long as its main process. `docker run ubuntu` exits immediately because `ubuntu` has no long-running process (default CMD is `bash`, which exits without a terminal).

### CMD

Default command or arguments, replaced by anything given on the command line.

```dockerfile
FROM ubuntu
CMD ["sleep", "5"]
```

```bash
docker run ubuntu-sleeper            # sleep 5
docker run ubuntu-sleeper sleep 10   # replaces CMD entirely
```

### ENTRYPOINT

The fixed executable; arguments on the command line are **appended**.

```dockerfile
FROM ubuntu
ENTRYPOINT ["sleep"]
```

```bash
docker run ubuntu-sleeper 10         # sleep 10
docker run ubuntu-sleeper            # sleep  (error: missing operand)
```

### ENTRYPOINT + CMD together

CMD supplies the default argument:

```dockerfile
ENTRYPOINT ["sleep"]
CMD ["5"]
```

```bash
docker run ubuntu-sleeper            # sleep 5
docker run ubuntu-sleeper 10         # sleep 10
docker run --entrypoint sleep2.0 ubuntu-sleeper 10   # override entrypoint
```

### Shell form vs exec form

Use the JSON array form (`["sleep","5"]`). The shell form (`CMD sleep 5`) runs through `/bin/sh -c` and doesn't pass signals well.

### Summary

| Dockerfile | Overridden by |
|---|---|
| `ENTRYPOINT` | `docker run --entrypoint` |
| `CMD` | arguments after the image name |

### Key takeaways

- ENTRYPOINT = program, CMD = default arguments.
- This maps directly to Kubernetes `command` and `args`.
