import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { RunManifest } from "../harness/lib/contracts.js";

const runRoot = path.join("harness", "runs");
let sequence = 0;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function createFinishedRun(outputContent: string): Promise<{
  manifestPath: string;
  runDir: string;
  outputPath: string;
}> {
  const runId = `HISTORICAL_VERIFY_TEST_${process.pid}_${Date.now()}_${sequence++}`;
  const runDir = path.join(runRoot, runId);
  const manifestPath = path.join(runDir, "manifest.json");
  const outputPath = path.join(runDir, "output.txt").replaceAll("\\\\", "/");
  const logPath = path.join(runDir, "acceptance-1.log").replaceAll("\\\\", "/");
  await mkdir(runDir, { recursive: true });
  await writeFile(outputPath, outputContent, "utf8");
  await writeFile(logPath, "recorded acceptance output\n", "utf8");

  const manifest: RunManifest = {
    schema_version: "run-v1",
    run_id: runId,
    task_id: "WAVE-B-C-OFFLINE-REAUDIT-002",
    task_spec_path: "harness/tasks/WAVE-B-C-OFFLINE-REAUDIT-002.json",
    role: "auditor",
    agent_id: "independent-auditor",
    chain: "solana",
    status: "GREEN",
    reason: "recorded final evidence",
    created_at_utc: "2026-07-27T00:00:00.000Z",
    updated_at_utc: "2026-07-27T00:00:00.000Z",
    git: {
      start_commit: "recorded-baseline",
      current_commit: "recorded-baseline",
      dirty_at_start: false,
      changed_paths: [outputPath],
    },
    config_versions: {
      harness: "harness-v1",
      active_stage: "solana-pumpfun-e2e",
      rules: {},
    },
    inputs: [],
    source_watermarks: { status: "NOT_RECORDED" },
    outputs: [{ path: outputPath, exists: true, sha256: digest(outputContent) }],
    acceptance: [{
      command: "this-command-must-not-run",
      status: "PASSED",
      exit_code: 0,
      log_path: logPath,
    }],
    integrity: {
      task_spec_valid: true,
      active_stage_allowed: true,
      write_scope_valid: true,
      secrets_absent: true,
    },
    unresolved_items: [],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifestPath, runDir, outputPath };
}

function verify(runDir: string) {
  return spawnSync(process.execPath, [
    path.resolve("node_modules/tsx/dist/cli.mjs"),
    "harness/cli.ts",
    "run",
    "verify",
    runDir,
  ], { cwd: process.cwd(), encoding: "utf8" });
}

test("finished run verification is read-only after later commits", async () => {
  const fixture = await createFinishedRun("recorded output\n");
  try {
    const before = await readFile(fixture.manifestPath, "utf8");
    const result = verify(fixture.runDir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      status: "GREEN",
      run_id: path.basename(fixture.runDir),
      historical: true,
      out_of_scope: [],
      unresolved_items: [],
      acceptance: [{
        command: "this-command-must-not-run",
        status: "PASSED",
        exit_code: 0,
        log_path: path.join(fixture.runDir, "acceptance-1.log").replaceAll("\\\\", "/"),
      }],
    });
    assert.equal(await readFile(fixture.manifestPath, "utf8"), before);
  } finally {
    await rm(fixture.runDir, { recursive: true, force: true });
  }
});

test("finished run verification rejects a changed recorded output without rewriting evidence", async () => {
  const fixture = await createFinishedRun("recorded output\n");
  try {
    await writeFile(fixture.outputPath, "tampered output\n", "utf8");
    const before = await readFile(fixture.manifestPath, "utf8");
    const result = verify(fixture.runDir);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "FAIL");
    assert.equal(await readFile(fixture.manifestPath, "utf8"), before);
  } finally {
    await rm(fixture.runDir, { recursive: true, force: true });
  }
});
