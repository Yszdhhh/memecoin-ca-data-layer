# Required reading

Read these files in order before any repository action:

1. `AGENTS.md`
2. `PROJECT_CONSTITUTION.md`
3. `PROJECT_OPERATING_PLAYBOOK.md`
4. `KNOWN_LIMITATIONS.md`
5. `OWNER_DECISIONS_NEEDED.md`
6. `harness/config/project.json`
7. Only the exact `harness/tasks/<task_id>.json` named in the dispatch

Interpretation rules:

- The constitution and explicit Owner decisions override a task description.
- A task does not authorize work outside its `write_set`.
- Missing input, conflicting paths, missing credentials, or an inactive-chain
  request must return `PARK`; never guess or silently substitute another source.
- Chat summaries are not evidence. Files, hashes, test output, slots, signatures,
  block numbers, and reproducible commands are evidence.
