### Introduction

Lightning labs are short, timed, mixed-topic practice sessions modelled on the speed of the exam. Each lab contains several tasks of varying difficulty.

### How to use them

1. Set a timer for the whole lab.
2. Configure aliases first:

```bash
alias k=kubectl
export do="--dry-run=client -o yaml"
source <(kubectl completion bash)
complete -F __start_kubectl k
```

3. Do the quick tasks first; flag long ones and return later.
4. Switch context when the task says so (`kubectl config use-context ...`).
5. After finishing, review solutions and redo anything missed.

### Time budget

The exam gives about 2 hours for roughly 15-20 questions, so ~6 minutes each on average; easy tasks should take 2-3.

### Skills trained

Imperative commands, YAML editing in vim, docs navigation, verifying results quickly.

### Tip

Use `kubectl explain` and search kubernetes.io rather than memorising YAML.

### Exam-style time plan

| Minutes | Activity |
|---|---|
| 0-5 | Aliases, completion, read all questions, note weights |
| 5-90 | Solve in order of (weight / difficulty) |
| 90-110 | Return to skipped questions |
| 110-120 | Verify results |

Flag any question you can't do in about 8 minutes and move on.
