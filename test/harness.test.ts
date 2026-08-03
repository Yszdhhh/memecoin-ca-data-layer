import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { FinishedRunEvidence, ProjectConfig, TaskLedger, TaskSpec } from "../harness/lib/contracts.js";
import { globMatches } from "../harness/lib/files.js";
import { gitTrackedFiles } from "../harness/lib/git.js";
import {
  classifyForbiddenTrackedFile,
  findForbiddenTrackedFiles,
  forbiddenTrackedFileMatches,
  isDocumentedScrubbedPublicWalletArtifact,
  secretContentRulesFor,
} from "../harness/cli.js";
import {
  applyReadinessUpdates,
  deriveLifecyclePlan,
  validateDeclaredInputArtifacts,
  validateTask,
} from "../harness/lib/validation.js";

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

test("DONE tasks require existing, Git-tracked repository input artifacts", async () => {
  const done = task({
    status: "DONE",
    inputs: ["harness/runs/missing/manifest.json", "external system record"],
  });
  assert.deepEqual(
    await validateDeclaredInputArtifacts(done, async () => false),
    ["declared input does not exist: harness/runs/missing/manifest.json"],
  );
  assert.deepEqual(
    await validateDeclaredInputArtifacts(done, async () => true, new Set()),
    ["declared input is not Git-tracked: harness/runs/missing/manifest.json"],
  );
  assert.deepEqual(
    await validateDeclaredInputArtifacts(
      done,
      async () => true,
      new Set(["harness/runs/missing/manifest.json"]),
    ),
    [],
  );
  assert.deepEqual(
    await validateDeclaredInputArtifacts({ ...done, status: "READY" }, async () => false),
    [],
  );
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

test("forbidden wallet rule is exact-path allowlisted and fail-closed on case variants", () => {
  const canonical = [
    "apps/operator-console/src/data/fixtures/wallets.json",
    "artifacts/wallet_intelligence_v0_1/wallet_data_quality_report_v0_1.json",
    "artifacts/wallet_intelligence_v0_1/wallet_replay_manifest_v0_1.json",
  ];
  const withSeparators = (files: string[]) =>
    files.flatMap((file) => [file, file.replaceAll("/", "\\")]);
  const allowCases = withSeparators(canonical);
  const denyCases = withSeparators([
    "apps/operator-console/src/data/fixtures/WALLETS.json",
    "apps/operator-console/src/data/fixtures/Wallets.json",
    "artifacts/wallet_intelligence_v0_1/wallet_data_quality_report_v0_1.JSON",
    "artifacts/wallet_intelligence_v0_1/wallet_replay_manifest_v0_1.Json",
    "Apps/operator-console/src/data/fixtures/wallets.json",
    "apps/Operator-console/src/data/fixtures/wallets.json",
    "artifacts/Wallet_intelligence_v0_1/wallet_data_quality_report_v0_1.json",
    "artifacts/wallet_Intelligence_v0_1/wallet_replay_manifest_v0_1.json",
    "./apps/operator-console/src/data/fixtures/wallets.json",
    "apps/operator-console/src/data/fixtures/../fixtures/wallets.json",
    "private/raw/wallets.json",
    "private/wallet.json",
    "chainfm_out/sol/wallet_export.json",
    "artifacts/wallet_intelligence_v0_1/wallet_master.json",
    "wallets.json",
    "other/wallet_backup.json",
  ]);

  for (const file of allowCases) {
    assert.equal(isDocumentedScrubbedPublicWalletArtifact(file), true, file);
    assert.equal(classifyForbiddenTrackedFile(["wallet*.json"], file), "public_wallet_artifact", file);
    assert.equal(forbiddenTrackedFileMatches("wallet*.json", file), false, file);
  }
  for (const file of denyCases) {
    assert.equal(isDocumentedScrubbedPublicWalletArtifact(file), false, file);
    assert.equal(forbiddenTrackedFileMatches("wallet*.json", file), true, file);
  }
});

test("repository forbidden classification shares one helper across doctor and run-verify", async () => {
  const source = await readFile("harness/cli.ts", "utf8");
  assert.match(source, /const forbiddenFiles = findForbiddenTrackedFiles\(config\.forbidden_repository_patterns, tracked\)/);
  assert.match(source, /const secretFileMatches = findForbiddenTrackedFiles\(config\.forbidden_repository_patterns, tracked\)/);
  assert.equal((source.match(/findForbiddenTrackedFiles\(/g) ?? []).length, 3);
  assert.doesNotMatch(source, /NON_WALLET_TASK_SPEC_PATHS\.has\(file\)/);
});

test("tracked repository classification excludes only exact governed Task Specs", () => {
  const patterns = ["wallet*.json"];
  const governedTaskSpecs = [
    "harness/tasks/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001.json",
    "harness/tasks/WALLET-SHADOW-LIVE-OBSERVATION-PILOT-001-AUDIT-001.json",
    "harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001.json",
    "harness/tasks/WALLET-SHADOW-REPLAY-ENGINE-V0-1-001-AUDIT-001.json",
    "harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001.json",
    "harness/tasks/WALLET-SHADOW-TRADE-CONTRACTS-V0-1-001-AUDIT-001.json",
  ];
  for (const file of governedTaskSpecs) {
    for (const candidate of [file, file.replaceAll("/", "\\")]) {
      assert.equal(classifyForbiddenTrackedFile(patterns, candidate), "governed_task_spec", candidate);
      assert.equal(forbiddenTrackedFileMatches("wallet*.json", candidate), false, candidate);
    }
  }

  const variants = governedTaskSpecs.flatMap((file) => {
    const filenameCase = file.replace("WALLET-SHADOW", "wallet-shadow");
    const directoryCase = file.replace("harness/tasks", "harness/TASKS");
    const dotRelative = `./${file}`;
    const traversal = `harness/tasks/../tasks/${file.slice("harness/tasks/".length)}`;
    return [filenameCase, directoryCase, dotRelative, traversal].flatMap((candidate) => [
      candidate,
      candidate.replaceAll("/", "\\"),
    ]);
  });
  for (const file of variants) {
    assert.equal(classifyForbiddenTrackedFile(patterns, file), "forbidden", file);
    assert.equal(forbiddenTrackedFileMatches("wallet*.json", file), true, file);
  }
});

test("current tracked repository has no forbidden files under the unified classifier", async () => {
  const project = JSON.parse(await readFile("harness/config/project.json", "utf8")) as ProjectConfig;
  const tracked = gitTrackedFiles();
  assert.deepEqual(findForbiddenTrackedFiles(project.forbidden_repository_patterns, tracked), []);
});
test("project config preserves the governed baseline fields", async () => {
  const project = JSON.parse(await readFile("harness/config/project.json", "utf8")) as ProjectConfig;
  assert.deepEqual(
    {
      schema_version: project.schema_version,
      project: project.project,
      active_stage: project.active_stage,
      active_chains: project.active_chains,
      blocked_chains: project.blocked_chains,
      verdicts: project.verdicts,
      rule_versions: project.rule_versions,
      quality_commands: project.quality_commands,
      future_stage_gate: project.future_stage_gate,
    },
    {
      schema_version: "harness-v1",
      project: "memecoin-ca-data-layer",
      active_stage: "solana-pumpfun-e2e",
      active_chains: ["solana"],
      blocked_chains: ["bsc", "robinhood"],
      verdicts: ["GREEN", "GREEN_WITH_ADVISORY", "PARK", "FAIL", "QUARANTINED"],
      rule_versions: {
        real_holders: "v1",
        funding_clusters: "v1",
        dev_behavior: "v1",
        wallet_quality: "v1",
      },
      quality_commands: ["npm run typecheck", "npm test", "npm run build"],
      future_stage_gate: "Solana fixture + authorized live CA E2E must be GREEN before activating BSC; Robinhood remains after BSC.",
    },
  );
});

test("content secret scan returns only rule identifiers", () => {
  const syntheticCredential = ["sample", "credential", "0123456789"].join("-");
  const rules = secretContentRulesFor(`API Key (\`${syntheticCredential}\`)`);
  assert.deepEqual(rules, ["INLINE_API_CREDENTIAL"]);
  assert.equal(rules.some((rule) => rule.includes(syntheticCredential)), false);
  assert.deepEqual(secretContentRulesFor("DUNE_API_KEY"), []);
  assert.deepEqual(secretContentRulesFor("DUNE_API_KEY=YOUR_DUNE_API_KEY"), []);
});
