import { createHash } from "node:crypto";
import type { RunManifest } from "./contracts.js";

const MAX_REFERENCES = 16;
const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const HEX_GIT_SHA = /^[a-f0-9]{40}$/i;
const SAFE_RUN_ID = /^[A-Za-z0-9_-]{4,100}$/;

/** A bounded, read-only handoff summary. The manifest remains the evidence source. */
export interface HandoffEnvelope {
  schema_version: "handoff-v1";
  handoff_id: string;
  task_id: string;
  run_id: string;
  from_agent: string;
  role: RunManifest["role"];
  status: RunManifest["status"];
  source_manifest: string;
  git: {
    start_commit: string;
    current_commit: string;
    changed_paths: string[];
    omitted_changed_paths: number;
  };
  outputs: Array<{ path: string; sha256: string }>;
  omitted_outputs: number;
  invalid_outputs: number;
  acceptance: { passed: number; failed: number; pending: number };
  unresolved_count: number;
  integrity_verified: boolean;
  ready_for_review: boolean;
}

/**
 * Produce a deterministic, compact envelope for a follow-on agent.
 * No prompt history, raw tool output, credential values, or free-text reasons.
 * A GREEN envelope is a review candidate, not a substitute for independent audit.
 */
export function buildHandoffEnvelope(manifest: RunManifest): HandoffEnvelope {
  if (
    manifest.schema_version !== "run-v1"
    || !SAFE_RUN_ID.test(manifest.run_id)
    || !manifest.task_id
    || !manifest.agent_id
    || !manifest.git
    || !HEX_GIT_SHA.test(manifest.git.start_commit)
    || !HEX_GIT_SHA.test(manifest.git.current_commit)
    || !Array.isArray(manifest.git.changed_paths)
    || !Array.isArray(manifest.outputs)
    || !Array.isArray(manifest.acceptance)
    || !Array.isArray(manifest.unresolved_items)
    || !manifest.integrity
  ) {
    throw new Error("invalid run manifest for handoff");
  }

  const validOutputs = manifest.outputs.filter(
    (item) => item.exists && typeof item.path === "string" && typeof item.sha256 === "string" && HEX_SHA256.test(item.sha256),
  );
  const invalidOutputs = manifest.outputs.length - validOutputs.length;
  const acceptance = {
    passed: manifest.acceptance.filter((item) => item.status === "PASSED" && item.exit_code === 0).length,
    failed: manifest.acceptance.filter((item) => item.status === "FAILED" || (item.status === "PASSED" && item.exit_code !== 0)).length,
    pending: manifest.acceptance.filter((item) => item.status === "PENDING").length,
  };
  const integrity = manifest.integrity;
  const integrityVerified = integrity.task_spec_valid === true
    && integrity.active_stage_allowed === true
    && integrity.write_scope_valid === true
    && integrity.secrets_absent === true;

  const changedPaths = manifest.git.changed_paths.slice(0, MAX_REFERENCES);
  const outputs = validOutputs.slice(0, MAX_REFERENCES).map((item) => ({ path: item.path, sha256: item.sha256! }));
  const payload = {
    schema_version: "handoff-v1" as const,
    task_id: manifest.task_id,
    run_id: manifest.run_id,
    from_agent: manifest.agent_id,
    role: manifest.role,
    status: manifest.status,
    source_manifest: "harness/runs/" + manifest.run_id + "/manifest.json",
    git: {
      start_commit: manifest.git.start_commit,
      current_commit: manifest.git.current_commit,
      changed_paths: changedPaths,
      omitted_changed_paths: manifest.git.changed_paths.length - changedPaths.length,
    },
    outputs,
    omitted_outputs: validOutputs.length - outputs.length,
    invalid_outputs: invalidOutputs,
    acceptance,
    unresolved_count: manifest.unresolved_items.length,
    integrity_verified: integrityVerified,
    ready_for_review: (manifest.status === "GREEN" || manifest.status === "GREEN_WITH_ADVISORY")
      && manifest.acceptance.length > 0
      && acceptance.passed === manifest.acceptance.length
      && integrityVerified
      && manifest.outputs.length > 0
      && invalidOutputs === 0
      && manifest.unresolved_items.length === 0,
  };
  const handoffId = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return { ...payload, handoff_id: handoffId };
}
