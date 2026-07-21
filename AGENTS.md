# Memecoin CA Data Layer agent entrypoint

Before inspecting code, selecting work, or changing this repository, read
[`PROJECT_REQUIRED_READING.md`](PROJECT_REQUIRED_READING.md) in full.

This is the authoritative entrypoint for every coordinator, implementer,
researcher, and auditor. Agents execute only the exact task spec named in their
dispatch message; they do not self-select work from `harness/tasks/`.
