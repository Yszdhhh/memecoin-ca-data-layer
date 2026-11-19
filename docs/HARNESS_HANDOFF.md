# Agent handoff envelope (read-only v1)

This is a small addition to the repository's **existing** task/run harness, not a
standalone computer-use runtime or a multi-agent router.

## Why

When work moves from one agent to another, passing a full prompt/transcript is
noisy and makes provenance hard to audit. The handoff-v1 envelope projects an
existing run-v1 manifest into a bounded JSON summary: run/task/agent identity,
Git baseline, changed paths, output hashes, acceptance counts and integrity flags.

## Usage

After a run has created a manifest at harness/runs/<run_id>/manifest.json:

~~~bash
npm run harness:run -- handoff <run_id>
# also accepts: harness/runs/<run_id>
~~~

The command does not call any model, open a browser, or mutate the run.
handoff_id is a SHA-256 digest of the summary payload, so repeated reads of an
unchanged manifest give the same ID. A changed manifest produces a different ID.

ready_for_review is **only** a local evidence-consistency gate. It requires a
finished passing verdict, a passing nonempty acceptance set, all integrity flags,
nonempty hashed outputs and no unresolved items. It does **not** approve the run,
verify the underlying files, authorize another task, or replace an independent
auditor. The next agent must open source_manifest, check referenced artifacts,
and run the normal acceptance commands.

Long path lists are bounded at 16 entries with omission counts. Raw prompts,
input paths, source watermarks, execution logs and free-text failure reasons are
not copied into the envelope. If details are needed, fetch the source manifest.

## Limits / next work

- No agent-to-agent transport or scheduling is wired here.
- No tool retries, session isolation or computer-use worker yet.
- No shared state store or end-to-end crash recovery guarantee.
- The CLI is read-only; it reads an existing manifest and returns JSON on stdout.
