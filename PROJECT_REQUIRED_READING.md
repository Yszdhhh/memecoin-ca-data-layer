# Required reading

Read these files in order before any repository action:

1. `AGENTS.md`
2. `PROJECT_CONSTITUTION.md`
3. `PROJECT_ARCHITECTURE.md` (binding: four layers, trust tiers, drift-prevention rules)
4. `docs/architecture/OPERATOR_CONSOLE_ACCESS_LAYER_CLARIFICATION.md` (console is access layer only)
5. `docs/blueprints/GOAL_EXECUTION_BLUEPRINT_V1.md` (G0–G8 execution authority when running goal mode)
6. `PROJECT_OPERATING_PLAYBOOK.md`
7. `KNOWN_LIMITATIONS.md`
8. `OWNER_DECISIONS_NEEDED.md`
9. `harness/config/project.json`
10. Only the exact `harness/tasks/<task_id>.json` named in the dispatch

Interpretation rules:

- The constitution and explicit Owner decisions override a task description.
- A task does not authorize work outside its `write_set`.
- Missing input, conflicting paths, missing credentials, or an inactive-chain
  request must return `PARK`; never guess or silently substitute another source.
- Chat summaries are not evidence. Files, hashes, test output, slots, signatures,
  block numbers, and reproducible commands are evidence.
