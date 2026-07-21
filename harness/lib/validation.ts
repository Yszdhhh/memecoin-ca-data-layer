import type { ProjectConfig, TaskLedger, TaskSpec } from "./contracts.js";
import { exists, readJson } from "./files.js";

const TASK_ID = /^[A-Z][A-Z0-9-]{2,63}$/;
const TIERS = new Set(["T1", "T2", "T3"]);
const ROLES = new Set(["coordinator", "implementer", "researcher", "auditor"]);
const STATUSES = new Set(["READY", "BLOCKED_DEPENDENCY", "BLOCKED_STAGE", "IN_PROGRESS", "DONE", "PARK"]);

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
