export type Chain = "solana" | "bsc" | "robinhood";
export type Tier = "T1" | "T2" | "T3";
export type Role = "coordinator" | "implementer" | "researcher" | "auditor";
export type TaskStatus = "READY" | "BLOCKED_DEPENDENCY" | "BLOCKED_STAGE" | "IN_PROGRESS" | "DONE" | "PARK";
export type Verdict = "GREEN" | "GREEN_WITH_ADVISORY" | "PARK" | "FAIL" | "QUARANTINED";

export interface ProjectConfig {
  schema_version: "harness-v1";
  project: string;
  active_stage: string;
  active_chains: Chain[];
  blocked_chains: Chain[];
  verdicts: Verdict[];
  rule_versions: Record<string, string>;
  quality_commands: string[];
  forbidden_repository_patterns: string[];
  future_stage_gate: string;
}

export interface TaskSpec {
  schema_version: "task-v1";
  task_id: string;
  title: string;
  tier: Tier;
  role: Role;
  chain: Chain | null;
  status: TaskStatus;
  objective: string;
  dependencies: string[];
  inputs: string[];
  write_set: string[];
  forbidden_actions: string[];
  deliverables: string[];
  acceptance_commands: string[];
}

export interface TaskLedger {
  schema_version: "ledger-v1";
  updated_at_utc: string;
  tasks: Array<{ task_id: string; spec: string; status: TaskStatus }>;
}

export interface ArtifactRecord {
  path: string;
  exists: boolean;
  sha256: string | null;
}

export interface AcceptanceRecord {
  command: string;
  status: "PENDING" | "PASSED" | "FAILED";
  exit_code: number | null;
  log_path: string | null;
}

export interface RunManifest {
  schema_version: "run-v1";
  run_id: string;
  task_id: string;
  task_spec_path: string;
  role: Role;
  agent_id: string;
  chain: Chain | null;
  status: "RUNNING" | Verdict;
  reason: string | null;
  created_at_utc: string;
  updated_at_utc: string;
  git: {
    start_commit: string;
    current_commit: string;
    dirty_at_start: boolean;
    changed_paths: string[];
  };
  config_versions: {
    harness: string;
    active_stage: string;
    rules: Record<string, string>;
  };
  inputs: ArtifactRecord[];
  source_watermarks: Record<string, unknown>;
  outputs: ArtifactRecord[];
  acceptance: AcceptanceRecord[];
  integrity: {
    task_spec_valid: boolean;
    active_stage_allowed: boolean;
    write_scope_valid: boolean | null;
    secrets_absent: boolean | null;
  };
  unresolved_items: string[];
}

/** Offline planner output — never invokes agents or providers. */
export interface LifecyclePlan {
  schema_version: "lifecycle-plan-v1";
  generated_at_utc: string;
  runnable: Array<{
    task_id: string;
    role: Role;
    tier: Tier;
    chain: Chain | null;
  }>;
  not_runnable: Array<{
    task_id: string;
    status: TaskStatus;
    blockers: string[];
  }>;
  sync_errors: string[];
  /** T2 implementer work marked DONE without a finished auditor run for a declared *-AUDIT-* task. */
  audit_evidence_gaps: string[];
  /** Proposed READY/BLOCKED_DEPENDENCY flips only (never DONE/GREEN). */
  readiness_updates: Array<{
    task_id: string;
    from: TaskStatus;
    to: "READY" | "BLOCKED_DEPENDENCY";
    reason: string;
  }>;
}
