import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { deepEqual, exitFor, repoRootFromHere, type SuiteReport, writeSuiteReport } from "./shared.js";

interface Timeline {
  schema_version: string;
  token_ca: string;
  parser_version: string;
  rule_version: Record<string, string>;
  observations: Array<Record<string, unknown>>;
}

interface Expected {
  schema_version: string;
  real_top_n: Array<{ owner: string; balance_raw: string }>;
  excluded_owners: Array<{ owner: string; reason: string; rule_version: string }>;
  smart_money: string[];
  clusters: Array<{ cluster_id: string; shared_funder: string; members: string[] }>;
  security: Record<string, string>;
}

/** Pure derivation from a pinned timeline — no wall clock, no network. */
export function deriveReplayOutput(timeline: Timeline): Expected {
  const holders = timeline.observations.find((o) => o.kind === "holder_concentration") as {
    owners: Array<{ owner: string; balance_raw: string; excluded?: boolean; reason?: string; rule_version?: string }>;
  } | undefined;
  const wallet = timeline.observations.find((o) => o.kind === "wallet_signal") as {
    smart_money?: string[];
    clusters?: Array<{ cluster_id: string; shared_funder: string; members: string[] }>;
  } | undefined;
  const security = timeline.observations.find((o) => o.kind === "security") as Record<string, string> | undefined;

  const owners = holders?.owners ?? [];
  return {
    schema_version: "replay-expected@1",
    real_top_n: owners
      .filter((row) => !row.excluded)
      .map((row) => ({ owner: row.owner, balance_raw: row.balance_raw })),
    excluded_owners: owners
      .filter((row) => row.excluded)
      .map((row) => ({
        owner: row.owner,
        reason: row.reason ?? "unknown",
        rule_version: row.rule_version ?? "unknown",
      })),
    smart_money: [...(wallet?.smart_money ?? [])].sort(),
    clusters: (wallet?.clusters ?? []).map((cluster) => ({
      cluster_id: cluster.cluster_id,
      shared_funder: cluster.shared_funder,
      members: [...cluster.members].sort(),
    })),
    security: {
      mint_authority: String(security?.mint_authority ?? "unknown"),
      freeze_authority: String(security?.freeze_authority ?? "unknown"),
      lp_burned: String(security?.lp_burned ?? "unknown"),
    },
  };
}

export function fingerprintTimeline(timeline: Timeline): string {
  return createHash("sha256").update(JSON.stringify(timeline)).digest("hex");
}

export async function runReplaySuite(options: {
  fixturesDir?: string;
  runDir?: string;
} = {}): Promise<SuiteReport> {
  const root = repoRootFromHere();
  const fixturesDir = options.fixturesDir
    ?? path.join(root, "test", "fixtures", "harness", "replay");
  const failures: string[] = [];
  const cases: string[] = [];

  const names = await readdir(fixturesDir);
  for (const name of names.sort()) {
    const caseDir = path.join(fixturesDir, name);
    let timelineRaw: string;
    let expectedRaw: string;
    try {
      timelineRaw = await readFile(path.join(caseDir, "timeline.json"), "utf8");
      expectedRaw = await readFile(path.join(caseDir, "expected.json"), "utf8");
    } catch {
      continue;
    }
    cases.push(name);
    const timeline = JSON.parse(timelineRaw) as Timeline;
    const expected = JSON.parse(expectedRaw) as Expected;
    const once = deriveReplayOutput(timeline);
    const twice = deriveReplayOutput(timeline);
    if (!deepEqual(once, twice)) {
      failures.push(`${name}: nondeterministic derivation`);
    }
    // Field-by-field golden equality
    if (!deepEqual(once.real_top_n, expected.real_top_n)) {
      failures.push(`${name}: real_top_n mismatch`);
    }
    if (!deepEqual(once.excluded_owners, expected.excluded_owners)) {
      failures.push(`${name}: excluded_owners reason/rule_version mismatch`);
    }
    if (!deepEqual(once.smart_money, expected.smart_money)) {
      failures.push(`${name}: smart_money mismatch`);
    }
    if (!deepEqual(once.clusters, expected.clusters)) {
      failures.push(`${name}: clusters mismatch`);
    }
    if (!deepEqual(once.security, expected.security)) {
      failures.push(`${name}: security tri-state mismatch`);
    }
  }

  if (cases.length === 0) failures.push("no replay cases found");

  const report: SuiteReport = {
    suite: "replay",
    version: "replay@1",
    status: failures.length === 0 ? "PASS" : "FAIL",
    generated_at_utc: new Date().toISOString(),
    failures,
    metrics: { case_count: cases.length, cases },
  };
  await writeSuiteReport(options.runDir, report);
  return report;
}

async function main(): Promise<number> {
  const runDir = process.argv[2];
  const report = await runReplaySuite(runDir ? { runDir } : {});
  console.log(JSON.stringify(report, null, 2));
  return exitFor(report.status);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(`${path.sep}replay.ts`)) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
