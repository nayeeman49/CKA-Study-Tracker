### Introduction

The scheduler is a pipeline of plugins that you can enable, disable and weight through scheduler *profiles*. This lesson explains the internals so you can reason about scheduling behaviour.

### Scheduling cycle

```
 Scheduling Queue ─► Filter ─► Score ─► Bind
   (PreEnqueue,        (nodes     (rank     (assign
    QueueSort)          that fit)  nodes)    node)
```

#### Queue

Pods wait in a priority queue. **Priority Classes** decide the order: higher priority Pods go first.

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "critical workloads"
```

```yaml
spec:
  priorityClassName: high-priority
```

A high-priority Pod can **preempt** (evict) lower priority Pods when no node has room.

#### Filter plugins

Examples: `NodeResourcesFit`, `NodeName`, `NodeUnschedulable`, `TaintToleration`, `NodePorts`, `NodeAffinity`.

#### Score plugins

Examples: `NodeResourcesFit` (scoring strategies), `ImageLocality`, `TaintToleration`, `NodeAffinity`, `PodTopologySpread`.

#### Bind

`DefaultBinder` sets `nodeName`.

### Extension points

Plugins attach at points: `queueSort`, `preFilter`, `filter`, `postFilter`, `preScore`, `score`, `reserve`, `permit`, `preBind`, `bind`, `postBind`.

### Profiles: customising one scheduler

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
- schedulerName: default-scheduler
- schedulerName: no-scoring-scheduler
  plugins:
    preScore:
      disabled:
      - name: '*'
    score:
      disabled:
      - name: '*'
```

One scheduler process can host several profiles, each acting as a separate `schedulerName`. This is the modern alternative to running separate binaries.

### Related features

- **Pod topology spread constraints** to spread Pods across zones/nodes.
- **Pod affinity / anti-affinity** to co-locate or separate Pods.
- **Pod priority and preemption**.

### Troubleshooting

- Pods unexpectedly evicted: a higher-priority Pod preempted them.
- Config file error: scheduler crashes; check logs.

### CKA exam tips

- Know PriorityClass and `priorityClassName`.
- Know that the default scheduler is a plugin pipeline and profiles configure it.

### Key takeaways

- Queue → filter → score → bind.
- Profiles and plugins customise the scheduler.
