import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type {
  ArtifactRecord,
  FinishedRunEvidence,
  ProjectConfig,
  RunManifest,
  TaskLedger,
  TaskSpec,
  Verdict,
} from "./lib/contracts.js";
import {
  exists,
  globMatches,
  readJson,
  REPO_ROOT,
  resolveRepoPath,
  sha256,
  toRepoPath,
  writeJson,
} from "./lib/files.js";
import {
  gitChangedPaths,
  gitCommit,
  gitDirty,
  gitIsRepository,
  gitTrackedFiles,
} from "./lib/git.js";
import { applyReadinessUpdates, deriveLifecyclePlan, validateLedger, validateTask } from "./lib/validation.js";

const CONFIG_PATH = "harness/config/project.json";
const LEDGER_PATH = "harness/ledger/tasks.json";
const REQUIRED_FILES = [
  "AGENTS.md",
  "PROJECT_REQUIRED_READING.md",
  "PROJECT_CONSTITUTION.md",
  "PROJECT_OPERATING_PLAYBOOK.md",
  "KNOWN_LIMITATIONS.md",
  "OWNER_DECISIONS_NEEDED.md",
  CONFIG_PATH,
  LEDGER_PATH,
];

async function artifact(relativePath: string): Promise<ArtifactRecord> {
  const present = await exists(relativePath);
  return { path: relativePath, exists: present, sha256: present ? await sha256(relativePath) : null };
}

async function doctor(): Promise<number> {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const file of REQUIRED_FILES) {
    if (!(await exists(file))) errors.push(`missing required file: ${file}`);
  }

  if (!gitIsRepository()) {
    errors.push("repository is not initialized as Git");
  } else {
    if (gitCommit() === "UNBORN") errors.push("Git repository has no baseline commit");
    if (gitDirty()) warnings.push("working tree is dirty; new Harness runs require a clean baseline");
  }

  let config: ProjectConfig | null = null;
  try {
    config = await readJson<ProjectConfig>(CONFIG_PATH);
    if (config.schema_version !== "harness-v1") errors.push("unsupported harness config version");
    if (config.active_chains.join(",") !== "solana") errors.push("current stage must keep Solana as the only active chain");
    if (!config.blocked_chains.includes("bsc") || !config.blocked_chains.includes("robinhood")) {
      errors.push("BSC and Robinhood must remain stage-blocked");
    }
  } catch (error) {
    errors.push(`cannot load project config: ${String(error)}`);
  }

  if (config) {
    try {
      const ledger = await readJson<TaskLedger>(LEDGER_PATH);
      errors.push(...(await validateLedger(ledger, config)));
    } catch (error) {
      errors.push(`cannot validate ledger: ${String(error)}`);
    }
    const tracked = gitTrackedFiles();
    for (const pattern of config.forbidden_repository_patterns) {
      const matches = tracked.filter((file) =>
        globMatches(pattern, path.basename(file)) || globMatches(pattern, file));
      if (matches.length > 0) errors.push(`forbidden tracked files for ${pattern}: ${matches.join(", ")}`);
    }
  }

  const status = errors.length === 0 ? "GREEN" : "FAIL";
  console.log(JSON.stringify({ status, active_stage: config?.active_stage ?? null, errors, warnings }, null, 2));
  return errors.length === 0 ? 0 : 1;
}

async function validateTaskFile(taskPath: string): Promise<number> {
  const config = await readJson<ProjectConfig>(CONFIG_PATH);
  const spec = await readJson<TaskSpec>(taskPath);
  const errors = validateTask(spec, config);
  console.log(JSON.stringify({
    task_id: spec.task_id,
    status: errors.length === 0 ? "GREEN" : "FAIL",
    errors,
  }, null, 2));
  return errors.length === 0 ? 0 : 1;
}

async function startRun(taskPath: string, requestedRunId?: string): Promise<number> {
  const config = await readJson<ProjectConfig>(CONFIG_PATH);
  const spec = await readJson<TaskSpec>(taskPath);
  const errors = validateTask(spec, config);
  if (errors.length > 0) throw new Error(`Invalid task spec: ${errors.join("; ")}`);
  if (spec.status !== "READY" && spec.status !== "IN_PROGRESS") {
    throw new Error(`Task is not runnable: ${spec.status}`);
  }
  if (spec.chain && !config.active_chains.includes(spec.chain)) {
    throw new Error(`Task chain is not active: ${spec.chain}`);
  }
  if (!gitIsRepository() || gitCommit() === "UNBORN") {
    throw new Error("A Git baseline commit is required before starting a run");
  }
  if (gitDirty()) throw new Error("Working tree must be clean before starting a run");

  const timestamp = new Date().toISOString();
  const runId = requestedRunId ?? `${timestamp.replace(/[-:.TZ]/g, "").slice(0, 14)}_${spec.task_id}`;
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(runId)) throw new Error("run_id contains invalid characters");
  const runDir = `harness/runs/${runId}`;
  if (await exists(`${runDir}/manifest.json`)) throw new Error(`Run already exists: ${runId}`);
  await mkdir(resolveRepoPath(runDir), { recursive: true });

  const startCommit = gitCommit();
  const manifest: RunManifest = {
    schema_version: "run-v1",
    run_id: runId,
    task_id: spec.task_id,
    task_spec_path: toRepoPath(path.resolve(REPO_ROOT, taskPath)),
    role: spec.role,
    agent_id: process.env.HARNESS_AGENT_ID ?? "codex",
    chain: spec.chain,
    status: "RUNNING",
    reason: null,
    created_at_utc: timestamp,
    updated_at_utc: timestamp,
    git: {
      start_commit: startCommit,
      current_commit: startCommit,
      dirty_at_start: false,
      changed_paths: [],
    },
    config_versions: {
      harness: config.schema_version,
      active_stage: config.active_stage,
      rules: config.rule_versions,
    },
    inputs: await Promise.all(spec.inputs.map(artifact)),
    source_watermarks: { status: "NOT_RECORDED" },
    outputs: await Promise.all(spec.deliverables.map(artifact)),
    acceptance: spec.acceptance_commands.map((command) => ({
      command,
      status: "PENDING",
      exit_code: null,
      log_path: null,
    })),
    integrity: {
      task_spec_valid: true,
      active_stage_allowed: true,
      write_scope_valid: null,
      secrets_absent: null,
    },
    unresolved_items: [],
  };
  await writeJson(`${runDir}/manifest.json`, manifest);
  console.log(JSON.stringify({ status: "RUNNING", run_id: runId, manifest: `${runDir}/manifest.json` }, null, 2));
  return 0;
}

async function verifyFinishedRun(manifest: RunManifest): Promise<number> {
  const acceptancePassed = manifest.acceptance.length > 0 && manifest.acceptance.every((item) =>
    item.status === "PASSED" && item.exit_code === 0 && item.log_path !== null);
  const logsPresent = await Promise.all(manifest.acceptance.map((item) =>
    item.log_path === null ? Promise.resolve(false) : exists(item.log_path)));
  const outputsMatch = await Promise.all(manifest.outputs.map(async (item) =>
    item.exists && item.sha256 !== null && await exists(item.path) && await sha256(item.path) === item.sha256));
  const integrityPassed = Object.values(manifest.integrity).every((value) => value === true);
  const passed = acceptancePassed
    && logsPresent.every(Boolean)
    && outputsMatch.every(Boolean)
    && integrityPassed
    && manifest.unresolved_items.length === 0;
  console.log(JSON.stringify({
    status: passed ? "GREEN" : "FAIL",
    run_id: manifest.run_id,
    historical: true,
    out_of_scope: manifest.unresolved_items
      .filter((item) => item.startsWith("OUT_OF_SCOPE:"))
      .map((item) => item.slice("OUT_OF_SCOPE:".length)),
    unresolved_items: manifest.unresolved_items,
    acceptance: manifest.acceptance,
  }, null, 2));
  return passed ? 0 : 1;
}

async function verifyRun(runDirArg: string): Promise<number> {
  const runDir = normalizeRunDir(runDirArg);
  const manifestPath = `${runDir}/manifest.json`;
  const manifest = await readJson<RunManifest>(manifestPath);
  if (manifest.status !== "RUNNING") return verifyFinishedRun(manifest);

  const config = await readJson<ProjectConfig>(CONFIG_PATH);
  const spec = await readJson<TaskSpec>(manifest.task_spec_path);
  const changedPaths = gitChangedPaths(manifest.git.start_commit)
    .filter((item) => !item.startsWith("harness/runs/"));
  const outOfScope = changedPaths.filter((changed) =>
    !spec.write_set.some((pattern) => globMatches(pattern, changed)));
  const secretMatches = gitTrackedFiles().filter((file) =>
    config.forbidden_repository_patterns.some((pattern) =>
      globMatches(pattern, path.basename(file)) || globMatches(pattern, file)));

  const acceptance: RunManifest["acceptance"] = [];
  for (let index = 0; index < manifest.acceptance.length; index += 1) {
    const check = manifest.acceptance[index]!;
    const result = spawnSync(check.command, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      shell: true,
      timeout: 120_000,
    });
    const logPath = `${runDir}/acceptance-${index + 1}.log`;
    await writeFile(
      resolveRepoPath(logPath),
      `${result.stdout ?? ""}${result.stderr ?? ""}`,
      "utf8",
    );
    acceptance.push({
      command: check.command,
      status: result.status === 0 ? "PASSED" : "FAILED",
      exit_code: result.status,
      log_path: logPath,
    });
  }

  manifest.updated_at_utc = new Date().toISOString();
  manifest.git.current_commit = gitCommit();
  manifest.git.changed_paths = changedPaths;
  manifest.outputs = await Promise.all(spec.deliverables.map(artifact));
  manifest.acceptance = acceptance;
  manifest.integrity.task_spec_valid = validateTask(spec, config).length === 0;
  manifest.integrity.active_stage_allowed = spec.chain === null || config.active_chains.includes(spec.chain);
  manifest.integrity.write_scope_valid = outOfScope.length === 0;
  manifest.integrity.secrets_absent = secretMatches.length === 0;
  manifest.unresolved_items = [
    ...outOfScope.map((item) => `OUT_OF_SCOPE:${item}`),
    ...secretMatches.map((item) => `FORBIDDEN_TRACKED_FILE:${item}`),
    ...manifest.outputs.filter((item) => !item.exists).map((item) => `MISSING_DELIVERABLE:${item.path}`),
  ];
  await writeJson(manifestPath, manifest);

  const passed = acceptance.every((item) => item.status === "PASSED")
    && Object.values(manifest.integrity).every((value) => value === true)
    && manifest.outputs.every((item) => item.exists);
  console.log(JSON.stringify({
    status: passed ? "GREEN" : "FAIL",
    run_id: manifest.run_id,
    out_of_scope: outOfScope,
    unresolved_items: manifest.unresolved_items,
    acceptance,
  }, null, 2));
  return passed ? 0 : 1;
}

async function finishRun(runDirArg: string, verdict: Verdict, reason: string): Promise<number> {
  const runDir = normalizeRunDir(runDirArg);
  const manifestPath = `${runDir}/manifest.json`;
  const manifest = await readJson<RunManifest>(manifestPath);
  const validVerdicts = new Set<Verdict>([
    "GREEN", "GREEN_WITH_ADVISORY", "PARK", "FAIL", "QUARANTINED",
  ]);
  if (!validVerdicts.has(verdict)) throw new Error(`Invalid verdict: ${verdict}`);
  if (!reason.trim()) throw new Error("A finish reason is required");

  if (verdict === "GREEN") {
    const acceptancePassed = manifest.acceptance.length > 0
      && manifest.acceptance.every((item) => item.status === "PASSED");
    const integrityPassed = Object.values(manifest.integrity).every((value) => value === true);
    if (!acceptancePassed || !integrityPassed || manifest.outputs.some((item) => !item.exists)) {
      throw new Error("GREEN is fail-closed: verify, integrity and deliverable gates must all pass");
    }
  }

  manifest.status = verdict;
  manifest.reason = reason;
  manifest.updated_at_utc = new Date().toISOString();
  await writeJson(manifestPath, manifest);
  console.log(JSON.stringify({ status: verdict, run_id: manifest.run_id, reason }, null, 2));
  return verdict === "FAIL" ? 1 : 0;
}

async function status(): Promise<number> {
  const config = await readJson<ProjectConfig>(CONFIG_PATH);
  const ledger = await readJson<TaskLedger>(LEDGER_PATH);
  const tasksWithStatus = (taskStatus: TaskSpec["status"]): string[] =>
    ledger.tasks.filter((task) => task.status === taskStatus).map((task) => task.task_id);
  console.log(JSON.stringify({
    active_stage: config.active_stage,
    active_chains: config.active_chains,
    blocked_chains: config.blocked_chains,
    ready: tasksWithStatus("READY"),
    blocked_dependency: tasksWithStatus("BLOCKED_DEPENDENCY"),
    blocked_stage: tasksWithStatus("BLOCKED_STAGE"),
    done: tasksWithStatus("DONE"),
  }, null, 2));
  return 0;
}

async function loadSpecs(ledger: TaskLedger): Promise<Map<string, TaskSpec>> {
  const specs = new Map<string, TaskSpec>();
  for (const entry of ledger.tasks) {
    specs.set(entry.task_id, await readJson<TaskSpec>(entry.spec));
  }
  return specs;
}

/**
 * A run manifest may only count as audit evidence if it is structurally a run-v1
 * manifest, every acceptance command PASSED, and every integrity flag is exactly
 * true. This is what stops a hand-forged or half-finished manifest from closing
 * an audit-evidence gap.
 */
function manifestIsValidEvidence(manifest: RunManifest): boolean {
  if (manifest.schema_version !== "run-v1") return false;
  if (typeof manifest.task_id !== "string" || !manifest.task_id) return false;
  if (typeof manifest.agent_id !== "string" || !manifest.agent_id) return false;
  if (typeof manifest.role !== "string") return false;
  if (!Array.isArray(manifest.acceptance) || manifest.acceptance.length === 0) return false;
  if (!manifest.acceptance.every((record) => record.status === "PASSED")) return false;
  const integrity = manifest.integrity;
  if (!integrity || typeof integrity !== "object") return false;
  return integrity.task_spec_valid === true
    && integrity.active_stage_allowed === true
    && integrity.write_scope_valid === true
    && integrity.secrets_absent === true;
}

async function loadFinishedRuns(): Promise<FinishedRunEvidence[]> {
  const runsRoot = resolveRepoPath("harness/runs");
  let names: string[] = [];
  try {
    names = await readdir(runsRoot);
  } catch {
    return [];
  }
  const finished: FinishedRunEvidence[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const manifestPath = `harness/runs/${name}/manifest.json`;
    if (!(await exists(manifestPath))) continue;
    try {
      const manifest = await readJson<RunManifest>(manifestPath);
      if (manifest.status === "RUNNING") continue;
      finished.push({
        task_id: manifest.task_id,
        role: manifest.role,
        status: manifest.status,
        agent_id: manifest.agent_id,
        evidence_valid: manifestIsValidEvidence(manifest),
      });
    } catch {
      // skip corrupt run dirs
    }
  }
  return finished;
}

async function lifecyclePlanCommand(): Promise<number> {
  const ledger = await readJson<TaskLedger>(LEDGER_PATH);
  const specs = await loadSpecs(ledger);
  const plan = deriveLifecyclePlan(specs, ledger, await loadFinishedRuns());
  console.log(JSON.stringify(plan, null, 2));
  return plan.sync_errors.length === 0 ? 0 : 1;
}

async function lifecycleVerifyCommand(): Promise<number> {
  const config = await readJson<ProjectConfig>(CONFIG_PATH);
  const ledger = await readJson<TaskLedger>(LEDGER_PATH);
  const specs = await loadSpecs(ledger);
  const ledgerErrors = await validateLedger(ledger, config);
  const plan = deriveLifecyclePlan(specs, ledger, await loadFinishedRuns());
  // Fail closed: an outstanding audit-evidence gap means a DONE implementer
  // milestone lacks an independent, valid, passing auditor run. Verify must not
  // report GREEN while that is true.
  const status = ledgerErrors.length === 0
    && plan.sync_errors.length === 0
    && plan.audit_evidence_gaps.length === 0
    ? "GREEN"
    : "FAIL";
  console.log(JSON.stringify({
    status,
    ledger_errors: ledgerErrors,
    sync_errors: plan.sync_errors,
    audit_evidence_gaps: plan.audit_evidence_gaps,
    readiness_updates: plan.readiness_updates,
    runnable_count: plan.runnable.length,
  }, null, 2));
  return status === "GREEN" ? 0 : 1;
}

async function lifecycleApplyReadinessCommand(): Promise<number> {
  const ledger = await readJson<TaskLedger>(LEDGER_PATH);
  const specs = await loadSpecs(ledger);
  const plan = deriveLifecyclePlan(specs, ledger, await loadFinishedRuns());
  const result = await applyReadinessUpdates(
    plan,
    specs,
    ledger,
    async (taskId, spec) => {
      const entry = ledger.tasks.find((item) => item.task_id === taskId);
      if (!entry) throw new Error(`missing ledger entry for ${taskId}`);
      await writeJson(entry.spec, spec);
    },
    async (next) => writeJson(LEDGER_PATH, next),
  );
  console.log(JSON.stringify({
    status: result.rejected.length === 0 ? "GREEN" : "FAIL",
    applied: result.applied,
    rejected: result.rejected,
    proposed: plan.readiness_updates,
  }, null, 2));
  return result.rejected.length === 0 ? 0 : 1;
}

function normalizeRunDir(input: string): string {
  const normalized = input.replaceAll("\\", "/").replace(/\/$/, "");
  return normalized.startsWith("harness/runs/")
    ? normalized
    : `harness/runs/${path.basename(normalized)}`;
}

async function main(): Promise<number> {
  const [command, subcommand, arg1, arg2, ...rest] = process.argv.slice(2);
  if (command === "doctor") return doctor();
  if (command === "status") return status();
  if (command === "task" && subcommand === "validate" && arg1) return validateTaskFile(arg1);
  if (command === "run" && subcommand === "start" && arg1) return startRun(arg1, arg2);
  if (command === "run" && subcommand === "verify" && arg1) return verifyRun(arg1);
  if (command === "run" && subcommand === "finish" && arg1 && arg2) {
    return finishRun(arg1, arg2 as Verdict, rest.join(" "));
  }
  if (command === "lifecycle" && subcommand === "plan") return lifecyclePlanCommand();
  if (command === "lifecycle" && subcommand === "verify") return lifecycleVerifyCommand();
  if (command === "lifecycle" && subcommand === "apply-readiness") return lifecycleApplyReadinessCommand();
  console.error(
    "Usage: doctor | status | task validate <spec> | run start <spec> [run_id] | "
    + "run verify <run_dir> | run finish <run_dir> <verdict> <reason> | "
    + "lifecycle plan | lifecycle verify | lifecycle apply-readiness",
  );
  return 2;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
