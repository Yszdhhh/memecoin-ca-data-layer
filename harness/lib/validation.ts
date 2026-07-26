import type {
  LifecyclePlan,
  ProjectConfig,
  RunManifest,
  TaskLedger,
  TaskSpec,
  TaskStatus,
  Verdict,
} from "./contracts.js";
import { exists, readJson } from "./files.js";

const TASK_ID = /^[A-Z][A-Z0-9-]{2,63}$/;
const TIERS = new Set(["T1", "T2", "T3"]);
const ROLES = new Set(["coordinator", "implementer", "researcher", "auditor"]);
const STATUSES = new Set(["READY", "BLOCKED_DEPENDENCY", "BLOCKED_STAGE", "IN_PROGRESS", "DONE", "PARK"]);
const ACCEPTING_AUDIT_VERDICTS = new Set<Verdict>(["GREEN", "GREEN_WITH_ADVISORY", "FAIL"]);

export function validateTask(spec: TaskSpec, config: ProjectConfig): string[] {
  const errors: string[] = [];
  if (spec.schema_version !== "task-v1") errors.push("schema_version must be task-v1");
  if (!TASK_ID.test(spec.task_id)) errors.push("task_id has an invalid format");
  if (!TIERS.has(spec.tier)) errors.push("tier must be T1, T2 or T3");
  if (!ROLES.has(spec.role)) errors.push("role is invalid");
  if (!STATUSES.has(spec.status)) errors.push("status is invalid");
  if (!spec.title?.trim() || !spec.objective?.trim()) errors.push("title and objective are required");
  for (const key of ["dependencies", "inputs", "write_set", "forbidden_actions", "deliverables", "acceptance_commands"] as const) {
    if (!Array.isArray(spec[key])) errors.push(`${key} must be an array`);
  }
  if (spec.deliverables.length === 0) errors.push("at least one deliverable is required");
  if (spec.acceptance_commands.length === 0) errors.push("at least one acceptance command is required");
  if (spec.chain && config.blocked_chains.includes(spec.chain) && spec.status !== "BLOCKED_STAGE") {
    errors.push(`${spec.chain} is stage-blocked and task status must be BLOCKED_STAGE`);
  }
  if (spec.chain && !config.active_chains.includes(spec.chain) && !config.blocked_chains.includes(spec.chain)) {
    errors.push(`${spec.chain} is not declared active or blocked`);
  }
  if (spec.role === "auditor" && spec.write_set.some((item) => item.startsWith("src/") || item.startsWith("db/"))) {
    errors.push("auditors may not write src/ or db/");
  }
  if ((spec.role === "implementer" || spec.role === "coordinator") && spec.write_set.length === 0) {
    errors.push(`${spec.role} requires a non-empty write_set`);
  }
  for (const item of [...spec.inputs, ...spec.write_set, ...spec.deliverables]) {
    if (item.includes("..") || item.startsWith("/") || /^[A-Za-z]:/.test(item)) {
      errors.push(`path must be repo-relative: ${item}`);
    }
  }
  return errors;
}

export async function validateLedger(ledger: TaskLedger, config: ProjectConfig): Promise<string[]> {
  const errors: string[] = [];
  const ids = new Set<string>();
  const specs = new Map<string, TaskSpec>();

  for (const entry of ledger.tasks) {
    if (ids.has(entry.task_id)) errors.push(`duplicate ledger task: ${entry.task_id}`);
    ids.add(entry.task_id);
    if (!(await exists(entry.spec))) {
      errors.push(`task spec does not exist: ${entry.spec}`);
      continue;
    }
    const spec = await readJson<TaskSpec>(entry.spec);
    specs.set(entry.task_id, spec);
    for (const error of validateTask(spec, config)) errors.push(`${entry.task_id}: ${error}`);
    if (spec.task_id !== entry.task_id) errors.push(`${entry.task_id}: spec task_id mismatch`);
    if (spec.status !== entry.status) errors.push(`${entry.task_id}: ledger/spec status mismatch`);
  }

  for (const [taskId, spec] of specs) {
    for (const dependency of spec.dependencies) {
      if (!ids.has(dependency)) errors.push(`${taskId}: unknown dependency ${dependency}`);
    }
  }

  const active = [...specs.values()].filter((spec) => spec.status === "READY" || spec.status === "IN_PROGRESS");
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const a = active[left]!;
      const b = active[right]!;
      for (const aPattern of a.write_set) {
        for (const bPattern of b.write_set) {
          const aBase = aPattern.replace(/\*.*$/, "");
          const bBase = bPattern.replace(/\*.*$/, "");
          if (aBase.startsWith(bBase) || bBase.startsWith(aBase)) {
            errors.push(`active write-set overlap: ${a.task_id}:${aPattern} <> ${b.task_id}:${bPattern}`);
          }
        }
      }
    }
  }
  return errors;
}

/**
 * Offline lifecycle planner: derives runnable work from dependency-complete tasks,
 * detects ledger/spec drift, and proposes READY/BLOCKED flips only.
 * Never marks DONE/GREEN and never treats an implementer run as an audit.
 */
export function deriveLifecyclePlan(
  specs: Map<string, TaskSpec>,
  ledger: TaskLedger,
  finishedRuns: ReadonlyArray<Pick<RunManifest, "task_id" | "role" | "status">>,
): LifecyclePlan {
  const sync_errors: string[] = [];
  const ledgerById = new Map(ledger.tasks.map((entry) => [entry.task_id, entry]));

  for (const [taskId, spec] of specs) {
    const entry = ledgerById.get(taskId);
    if (!entry) {
      sync_errors.push(`${taskId}: present in specs map but missing from ledger`);
      continue;
    }
    if (entry.status !== spec.status) {
      sync_errors.push(`${taskId}: ledger status ${entry.status} != spec status ${spec.status}`);
    }
  }
  for (const entry of ledger.tasks) {
    if (!specs.has(entry.task_id)) {
      sync_errors.push(`${entry.task_id}: ledger entry has no loaded spec`);
    }
  }

  const statusOf = (taskId: string): TaskStatus | null => {
    const spec = specs.get(taskId);
    const entry = ledgerById.get(taskId);
    if (!spec || !entry) return null;
    if (spec.status !== entry.status) return null;
    return spec.status;
  };

  const depsComplete = (spec: TaskSpec): string[] => {
    const blockers: string[] = [];
    for (const dep of spec.dependencies) {
      const st = statusOf(dep);
      if (st === null) blockers.push(`dependency ${dep}: missing or ledger/spec mismatch`);
      else if (st !== "DONE") blockers.push(`dependency ${dep}: status ${st}`);
    }
    return blockers;
  };

  const audit_evidence_gaps: string[] = [];
  for (const [taskId, spec] of specs) {
    if (spec.role !== "auditor" || statusOf(taskId) === "DONE") continue;
    for (const dep of spec.dependencies) {
      const depSpec = specs.get(dep);
      if (!depSpec || depSpec.role !== "implementer") continue;
      if (statusOf(dep) !== "DONE") continue;
      const hasFinishedAuditRun = finishedRuns.some(
        (run) =>
          run.task_id === taskId
          && run.role === "auditor"
          && ACCEPTING_AUDIT_VERDICTS.has(run.status as Verdict),
      );
      if (!hasFinishedAuditRun) {
        audit_evidence_gaps.push(
          `${dep}: implementer DONE but auditor task ${taskId} is ${statusOf(taskId) ?? "unknown"} without a finished auditor run`,
        );
      }
    }
  }

  const runnable: LifecyclePlan["runnable"] = [];
  const not_runnable: LifecyclePlan["not_runnable"] = [];
  const readiness_updates: LifecyclePlan["readiness_updates"] = [];

  for (const [taskId, spec] of [...specs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const entry = ledgerById.get(taskId);
    if (!entry) continue;
    if (entry.status !== spec.status) {
      not_runnable.push({
        task_id: taskId,
        status: spec.status,
        blockers: [`ledger/spec mismatch (${entry.status} vs ${spec.status})`],
      });
      continue;
    }

    const depBlockers = depsComplete(spec);
    const effective: TaskStatus = depBlockers.length === 0
      ? (spec.status === "BLOCKED_DEPENDENCY" ? "READY" : spec.status)
      : (spec.status === "READY" || spec.status === "IN_PROGRESS" || spec.status === "BLOCKED_DEPENDENCY"
        ? "BLOCKED_DEPENDENCY"
        : spec.status);

    if (
      (spec.status === "BLOCKED_DEPENDENCY" || spec.status === "READY")
      && effective !== spec.status
      && (effective === "READY" || effective === "BLOCKED_DEPENDENCY")
    ) {
      readiness_updates.push({
        task_id: taskId,
        from: spec.status,
        to: effective,
        reason: effective === "READY"
          ? "all declared dependencies are DONE"
          : depBlockers.join("; "),
      });
    }

    if (spec.status === "READY" && depBlockers.length === 0) {
      runnable.push({
        task_id: taskId,
        role: spec.role,
        tier: spec.tier,
        chain: spec.chain,
      });
    } else if (spec.status !== "DONE") {
      const blockers = [
        ...(spec.status !== "READY" && spec.status !== "IN_PROGRESS" ? [`status ${spec.status}`] : []),
        ...depBlockers,
      ];
      if (blockers.length === 0 && spec.status === "IN_PROGRESS") blockers.push("already IN_PROGRESS");
      not_runnable.push({ task_id: taskId, status: spec.status, blockers });
    }
  }

  return {
    schema_version: "lifecycle-plan-v1",
    generated_at_utc: new Date().toISOString(),
    runnable,
    not_runnable,
    sync_errors,
    audit_evidence_gaps,
    readiness_updates,
  };
}

/** Apply only READY ↔ BLOCKED_DEPENDENCY flips to both ledger and specs. Never writes DONE. */
export async function applyReadinessUpdates(
  plan: LifecyclePlan,
  specs: Map<string, TaskSpec>,
  ledger: TaskLedger,
  writeSpec: (taskId: string, spec: TaskSpec) => Promise<void>,
  writeLedger: (ledger: TaskLedger) => Promise<void>,
): Promise<{ applied: string[]; rejected: string[] }> {
  const applied: string[] = [];
  const rejected: string[] = [];
  if (plan.sync_errors.length > 0) {
    return { applied, rejected: plan.sync_errors.map((error) => `sync_error:${error}`) };
  }

  const nextLedger: TaskLedger = {
    ...ledger,
    updated_at_utc: new Date().toISOString(),
    tasks: ledger.tasks.map((entry) => ({ ...entry })),
  };

  for (const update of plan.readiness_updates) {
    if (update.to !== "READY" && update.to !== "BLOCKED_DEPENDENCY") {
      rejected.push(`${update.task_id}: refusing non-readiness target ${update.to}`);
      continue;
    }
    const spec = specs.get(update.task_id);
    const entry = nextLedger.tasks.find((item) => item.task_id === update.task_id);
    if (!spec || !entry) {
      rejected.push(`${update.task_id}: missing spec or ledger entry`);
      continue;
    }
    if (spec.status !== update.from || entry.status !== update.from) {
      rejected.push(`${update.task_id}: status changed since plan`);
      continue;
    }
    spec.status = update.to;
    entry.status = update.to;
    await writeSpec(update.task_id, spec);
    applied.push(`${update.task_id}:${update.from}->${update.to}`);
  }

  if (applied.length > 0) await writeLedger(nextLedger);
  return { applied, rejected };
}
