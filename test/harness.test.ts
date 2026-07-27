import assert from "node:assert/strict";
import test from "node:test";
import type { FinishedRunEvidence, ProjectConfig, TaskLedger, TaskSpec } from "../harness/lib/contracts.js";
import { globMatches } from "../harness/lib/files.js";
import { applyReadinessUpdates, deriveLifecyclePlan, validateTask } from "../harness/lib/validation.js";

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

test("lifecycle plan marks dependency-complete READY tasks runnable and never auto-DONE", () => {
  const implementer = task({
    task_id: "SOL-IMPL-001",
    role: "implementer",
    tier: "T2",
    status: "DONE",
    dependencies: [],
    write_set: ["src/a/**"],
  });
  const audit = task({
    task_id: "SOL-IMPL-AUDIT-001",
    role: "auditor",
    tier: "T2",
    status: "READY",
    dependencies: ["SOL-IMPL-001"],
    write_set: ["docs/audits/SOL-IMPL-AUDIT-001.md"],
    deliverables: ["docs/audits/SOL-IMPL-AUDIT-001.md"],
  });
  const blocked = task({
    task_id: "SOL-NEXT-001",
    role: "implementer",
    status: "BLOCKED_DEPENDENCY",
    dependencies: ["SOL-IMPL-AUDIT-001"],
    write_set: ["src/b/**"],
  });
  const specs = new Map<string, TaskSpec>([
    [implementer.task_id, implementer],
    [audit.task_id, audit],
    [blocked.task_id, blocked],
  ]);
  const ledger: TaskLedger = {
    schema_version: "ledger-v1",
    updated_at_utc: "2026-07-26T00:00:00.000Z",
    tasks: [
      { task_id: implementer.task_id, spec: "harness/tasks/SOL-IMPL-001.json", status: "DONE" },
      { task_id: audit.task_id, spec: "harness/tasks/SOL-IMPL-AUDIT-001.json", status: "READY" },
      { task_id: blocked.task_id, spec: "harness/tasks/SOL-NEXT-001.json", status: "BLOCKED_DEPENDENCY" },
    ],
  };

  const plan = deriveLifecyclePlan(specs, ledger, []);
  assert.equal(plan.sync_errors.length, 0);
  assert.ok(plan.runnable.some((item) => item.task_id === "SOL-IMPL-AUDIT-001"));
  assert.ok(!plan.runnable.some((item) => item.task_id === "SOL-NEXT-001"));
  assert.ok(plan.audit_evidence_gaps.some((gap) => gap.includes("SOL-IMPL-001")));
  assert.ok(!plan.readiness_updates.some((item) => item.to === "DONE" as never));
});

// --- Audit-evidence gate repair (HARNESS-AO-AUTOMATION-REPAIR-001) ---

const auditEvidenceScenario = () => {
  const implementer = task({
    task_id: "SOL-IMPL-001",
    role: "implementer",
    tier: "T2",
    status: "DONE",
    dependencies: [],
    write_set: ["src/a/**"],
  });
  const audit = task({
    task_id: "SOL-IMPL-AUDIT-001",
    role: "auditor",
    tier: "T2",
    status: "READY",
    dependencies: ["SOL-IMPL-001"],
    write_set: ["docs/audits/SOL-IMPL-AUDIT-001.md"],
    deliverables: ["docs/audits/SOL-IMPL-AUDIT-001.md"],
  });
  const specs = new Map<string, TaskSpec>([
    [implementer.task_id, implementer],
    [audit.task_id, audit],
  ]);
  const ledger: TaskLedger = {
    schema_version: "ledger-v1",
    updated_at_utc: "2026-07-26T00:00:00.000Z",
    tasks: [
      { task_id: implementer.task_id, spec: "harness/tasks/SOL-IMPL-001.json", status: "DONE" },
      { task_id: audit.task_id, spec: "harness/tasks/SOL-IMPL-AUDIT-001.json", status: "READY" },
    ],
  };
  return { specs, ledger };
};

const run = (overrides: Partial<FinishedRunEvidence> = {}): FinishedRunEvidence => ({
  task_id: "SOL-IMPL-AUDIT-001",
  role: "auditor",
  status: "GREEN",
  agent_id: "auditor-x",
  evidence_valid: true,
  ...overrides,
});

test("a DONE auditor task without a valid run still leaves an audit-evidence gap", () => {
  const { specs, ledger } = auditEvidenceScenario();
  specs.get("SOL-IMPL-AUDIT-001")!.status = "DONE";
  ledger.tasks.find((entry) => entry.task_id === "SOL-IMPL-AUDIT-001")!.status = "DONE";
  const plan = deriveLifecyclePlan(specs, ledger, []);
  assert.ok(plan.audit_evidence_gaps.some((gap) => gap.includes("SOL-IMPL-001")));
});

test("a valid independent passing auditor run closes the audit-evidence gap", () => {
  const { specs, ledger } = auditEvidenceScenario();
  const plan = deriveLifecyclePlan(specs, ledger, [run()]);
  assert.equal(plan.audit_evidence_gaps.length, 0);
});

test("a FAIL auditor verdict does NOT close the audit-evidence gap", () => {
  const { specs, ledger } = auditEvidenceScenario();
  const plan = deriveLifecyclePlan(specs, ledger, [run({ status: "FAIL" })]);
  assert.ok(plan.audit_evidence_gaps.some((gap) => gap.includes("SOL-IMPL-001")));
});

test("an auditor run sharing the implementer's agent identity does NOT close the gap", () => {
  const { specs, ledger } = auditEvidenceScenario();
  const plan = deriveLifecyclePlan(specs, ledger, [
    run({ agent_id: "same-agent" }),
    { task_id: "SOL-IMPL-001", role: "implementer", status: "GREEN", agent_id: "same-agent", evidence_valid: true },
  ]);
  assert.ok(plan.audit_evidence_gaps.some((gap) => gap.includes("agent identity")));
});

test("an invalid (unverified) auditor manifest does NOT close the gap", () => {
  const { specs, ledger } = auditEvidenceScenario();
  const plan = deriveLifecyclePlan(specs, ledger, [run({ evidence_valid: false })]);
  assert.ok(plan.audit_evidence_gaps.some((gap) => gap.includes("SOL-IMPL-001")));
});

test("apply-readiness refuses a forged non-readiness source status", async () => {
  const ready = task({ task_id: "SOL-A-001", status: "READY", dependencies: [] });
  const specs = new Map<string, TaskSpec>([[ready.task_id, ready]]);
  const ledger: TaskLedger = {
    schema_version: "ledger-v1",
    updated_at_utc: "2026-07-26T00:00:00.000Z",
    tasks: [{ task_id: ready.task_id, spec: "harness/tasks/SOL-A-001.json", status: "READY" }],
  };
  const plan = deriveLifecyclePlan(specs, ledger, []);
  const forged = {
    ...plan,
    sync_errors: [],
    readiness_updates: [{
      task_id: ready.task_id,
      from: "PARK" as const,
      to: "READY" as const,
      reason: "forged non-readiness source",
    }],
  };
  const result = await applyReadinessUpdates(
    forged,
    specs,
    ledger,
    async () => undefined,
    async () => undefined,
  );
  assert.equal(result.applied.length, 0);
  assert.ok(result.rejected.some((r) => r.includes("non-readiness source")));
});

test("lifecycle plan fails closed on ledger/spec mismatch and apply refuses DONE", async () => {
  const ready = task({ task_id: "SOL-A-001", status: "READY", dependencies: [] });
  const specs = new Map<string, TaskSpec>([[ready.task_id, ready]]);
  const ledger: TaskLedger = {
    schema_version: "ledger-v1",
    updated_at_utc: "2026-07-26T00:00:00.000Z",
    tasks: [{ task_id: ready.task_id, spec: "harness/tasks/SOL-A-001.json", status: "DONE" }],
  };
  const plan = deriveLifecyclePlan(specs, ledger, []);
  assert.ok(plan.sync_errors.some((error) => error.includes("ledger status") || error.includes("!=")));

  const forged = {
    ...plan,
    sync_errors: [],
    readiness_updates: [{
      task_id: ready.task_id,
      from: "READY" as const,
      to: "DONE" as unknown as "READY",
      reason: "should reject",
    }],
  };
  const result = await applyReadinessUpdates(
    forged,
    specs,
    { ...ledger, tasks: [{ task_id: ready.task_id, spec: "x", status: "READY" }] },
    async () => undefined,
    async () => undefined,
  );
  assert.ok(result.rejected.length > 0 || result.applied.length === 0);
});

test("apply-readiness flips BLOCKED_DEPENDENCY to READY when deps are DONE", async () => {
  const dep = task({ task_id: "SOL-DEP-001", status: "DONE", dependencies: [], write_set: ["src/d/**"] });
  const next = task({
    task_id: "SOL-NEXT-002",
    status: "BLOCKED_DEPENDENCY",
    dependencies: ["SOL-DEP-001"],
    write_set: ["src/n/**"],
  });
  const specs = new Map<string, TaskSpec>([[dep.task_id, dep], [next.task_id, { ...next }]]);
  const ledger: TaskLedger = {
    schema_version: "ledger-v1",
    updated_at_utc: "2026-07-26T00:00:00.000Z",
    tasks: [
      { task_id: dep.task_id, spec: "harness/tasks/SOL-DEP-001.json", status: "DONE" },
      { task_id: next.task_id, spec: "harness/tasks/SOL-NEXT-002.json", status: "BLOCKED_DEPENDENCY" },
    ],
  };
  const plan = deriveLifecyclePlan(specs, ledger, []);
  assert.ok(plan.readiness_updates.some((item) => item.task_id === "SOL-NEXT-002" && item.to === "READY"));

  const written: string[] = [];
  const result = await applyReadinessUpdates(
    plan,
    specs,
    ledger,
    async (taskId, spec) => {
      written.push(`${taskId}:${spec.status}`);
    },
    async (nextLedger) => {
      written.push(`ledger:${nextLedger.tasks.find((t) => t.task_id === "SOL-NEXT-002")?.status}`);
    },
  );
  assert.deepEqual(result.rejected, []);
  assert.ok(result.applied.includes("SOL-NEXT-002:BLOCKED_DEPENDENCY->READY"));
  assert.ok(written.includes("SOL-NEXT-002:READY"));
  assert.ok(written.includes("ledger:READY"));
});
