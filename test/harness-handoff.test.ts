import assert from "node:assert/strict";
import test from "node:test";
import type { RunManifest } from "../harness/lib/contracts.js";
import { buildHandoffEnvelope } from "../harness/lib/handoff.js";

function fixture(overrides: Partial<RunManifest> = {}): RunManifest {
  return {
    schema_version: "run-v1",
    run_id: "20261119_HANDOFF_TEST",
    task_id: "HARNESS-HANDOFF-001",
    task_spec_path: "harness/tasks/HARNESS-HANDOFF-001.json",
    role: "implementer",
    agent_id: "codex",
    chain: null,
    status: "GREEN",
    reason: "private explanation that must not be transmitted",
    created_at_utc: "2026-11-19T00:00:00Z",
    updated_at_utc: "2026-11-19T00:00:01Z",
    git: {
      start_commit: "a".repeat(40),
      current_commit: "b".repeat(40),
      dirty_at_start: false,
      changed_paths: ["harness/lib/handoff.ts"],
    },
    config_versions: { harness: "harness-v1", active_stage: "solana", rules: {} },
    inputs: [{ path: "secrets/not-for-handoff.env", exists: true, sha256: "c".repeat(64) }],
    source_watermarks: { private_prompt: "do not include" },
    outputs: [{ path: "docs/handoff.json", exists: true, sha256: "d".repeat(64) }],
    acceptance: [{ command: "npm test", status: "PASSED", exit_code: 0, log_path: "logs/test.log" }],
    integrity: { task_spec_valid: true, active_stage_allowed: true, write_scope_valid: true, secrets_absent: true },
    unresolved_items: [],
    ...overrides,
  };
}

test("handoff is deterministic, compact, and excludes raw context", () => {
  const one = buildHandoffEnvelope(fixture());
  assert.deepEqual(one, buildHandoffEnvelope(fixture()));
  assert.equal(one.ready_for_review, true);
  assert.equal(one.source_manifest, "harness/runs/20261119_HANDOFF_TEST/manifest.json");
  assert.equal(one.handoff_id.length, 64);
  assert.equal(one.outputs[0]?.sha256, "d".repeat(64));
  const serialized = JSON.stringify(one);
  assert.doesNotMatch(serialized, /not-for-handoff|private explanation|private_prompt|logs\/test/);
});

test("failed or incomplete evidence must not claim review readiness", () => {
  assert.equal(buildHandoffEnvelope(fixture({ status: "RUNNING" })).ready_for_review, false);
  assert.equal(buildHandoffEnvelope(fixture({ status: "FAIL" })).ready_for_review, false);
  assert.equal(buildHandoffEnvelope(fixture({ unresolved_items: ["some blocker"] })).ready_for_review, false);
  assert.equal(buildHandoffEnvelope(fixture({ acceptance: [{ command: "test", status: "FAILED", exit_code: 1, log_path: null }] })).ready_for_review, false);
  assert.equal(buildHandoffEnvelope(fixture({ integrity: { task_spec_valid: true, active_stage_allowed: true, write_scope_valid: null, secrets_absent: true } })).ready_for_review, false);
  const invalid = buildHandoffEnvelope(fixture({ outputs: [{ path: "missing", exists: false, sha256: null }] }));
  assert.equal(invalid.invalid_outputs, 1);
  assert.equal(invalid.ready_for_review, false);
});

test("handoff references are bounded, with omissions visible", () => {
  const many = fixture({
    outputs: Array.from({ length: 25 }, (_, index) => ({ path: "out/" + index, exists: true, sha256: "f".repeat(64) })),
    git: {
      start_commit: "a".repeat(40), current_commit: "b".repeat(40), dirty_at_start: false,
      changed_paths: Array.from({ length: 25 }, (_, index) => "src/" + index + ".ts"),
    },
  });
  const handoff = buildHandoffEnvelope(many);
  assert.equal(handoff.outputs.length, 16);
  assert.equal(handoff.omitted_outputs, 9);
  assert.equal(handoff.git.changed_paths.length, 16);
  assert.equal(handoff.git.omitted_changed_paths, 9);
});

test("invalid run ID and malformed git evidence fail closed", () => {
  assert.throws(() => buildHandoffEnvelope(fixture({ run_id: "../escape" })), /invalid run manifest/);
  assert.throws(() => buildHandoffEnvelope(fixture({ git: { start_commit: "not-sha", current_commit: "b".repeat(40), dirty_at_start: false, changed_paths: [] } })), /invalid run manifest/);
});
