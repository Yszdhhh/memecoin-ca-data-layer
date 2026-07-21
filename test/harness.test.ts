import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectConfig, TaskSpec } from "../harness/lib/contracts.js";
import { globMatches } from "../harness/lib/files.js";
import { validateTask } from "../harness/lib/validation.js";

const config: ProjectConfig = {
  schema_version: "harness-v1",
  project: "test",
  active_stage: "solana",
  active_chains: ["solana"],
  blocked_chains: ["bsc", "robinhood"],
  verdicts: ["GREEN", "GREEN_WITH_ADVISORY", "PARK", "FAIL", "QUARANTINED"],
  rule_versions: {},
  quality_commands: ["npm test"],
  forbidden_repository_patterns: [".env"],
  future_stage_gate: "solana first",
};

const task = (overrides: Partial<TaskSpec> = {}): TaskSpec => ({
  schema_version: "task-v1",
  task_id: "SOL-TEST-001",
  title: "test task",
  tier: "T1",
  role: "implementer",
  chain: "solana",
  status: "READY",
  objective: "test the contract",
  dependencies: [],
  inputs: ["src/index.ts"],
  write_set: ["src/infrastructure/solana/test/**"],
  forbidden_actions: ["no secrets"],
  deliverables: ["src/infrastructure/solana/test/index.ts"],
  acceptance_commands: ["npm test"],
  ...overrides,
});

test("stage lock rejects an active BSC task", () => {
  const errors = validateTask(task({ chain: "bsc", status: "READY" }), config);
  assert.ok(errors.some((error) => error.includes("stage-blocked")));
});

test("stage activation task remains valid only while blocked", () => {
  assert.deepEqual(validateTask(task({ chain: "bsc", status: "BLOCKED_STAGE" }), config), []);
});

test("auditor cannot write production source", () => {
  const errors = validateTask(task({ role: "auditor", write_set: ["src/**"] }), config);
  assert.ok(errors.some((error) => error.includes("auditors may not write")));
});

test("write-set glob matches only its bounded subtree", () => {
  assert.equal(globMatches("src/infrastructure/solana/pump/**", "src/infrastructure/solana/pump/decoder.ts"), true);
  assert.equal(globMatches("src/infrastructure/solana/pump/**", "src/infrastructure/solana/helius/client.ts"), false);
});
