# Dispatch template

```text
You are the [role] for task_id=[TASK-ID], tier=[T1/T2/T3].

Read, in order:
1. <repo>/AGENTS.md
2. <repo>/PROJECT_REQUIRED_READING.md and every shared file it names
3. <repo>/harness/tasks/[TASK-ID].json

Execute only that task. Your allowed write set is exactly the task spec's
write_set. Do not select another task and do not touch overlapping paths.
If a dependency, path, credential, stage, or task identity does not match,
return PARK rather than guessing.

At completion report: task_id, role, UTC time, exact inputs, changed paths,
commands and exit codes, evidence, verdict, unresolved items. Valid verdicts:
GREEN, GREEN_WITH_ADVISORY, PARK, FAIL, QUARANTINED.
```
