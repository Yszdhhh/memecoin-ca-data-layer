import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  resolveGmgnPeriodStatus,
  runCandidateScreeningV01,
  CANDIDATE_SCREENING_TASK_ID,
} from "../../../src/application/wallet-intelligence/candidate-screening-v0-1.js";
import {
  calculateBorrowedCandidateScores,
  evaluateWalletDataQuality,
  type GmgnPeriodStatsInput,
} from "../../../src/domain/rules/wallet-data-quality.js";
import { computeFingerprint, computeSha256 } from "../../../src/application/wallet-intelligence/master-table-builder.js";

const period = (overrides: Partial<GmgnPeriodStatsInput> = {}): GmgnPeriodStatsInput => ({
  status: "PARTIAL",
  completeness: 0.8,
  realizedProfit: 5000,
  realizedProfitPnl: 0.2,
  winRate: 55,
  buyCount: 40,
  sellCount: 30,
  boughtCost: 10000,
  soldIncome: 15000,
  tokenNum: 20,
  lastActiveTimestamp: 1_700_000_000,
  warningCodes: ["gmgn_wallet_stats_partial_fields", "gmgn_wallet_stats_period_unverified"],
  ...overrides,
});

test("period_unverified retains gmgn lead scores with confidence cap effect via DQ", () => {
  const s7d = period();
  const s30d = period({ realizedProfit: 12000 });
  const dq = evaluateWalletDataQuality(s7d, s30d);
  const scores = calculateBorrowedCandidateScores(s7d, s30d, dq, 90);
  assert.notEqual(scores.borrowedCompositeLeadScore, null);
  assert.notEqual(scores.borrowedLeadTier, "UNQUALIFIED");
  assert.ok(["DQ-C", "DQ-D", "DQ-U"].includes(dq.dataQualityTier));
});

test("resolveGmgnPeriodStatus derives PARTIAL when provider omits status but has metrics", () => {
  const resolved = resolveGmgnPeriodStatus({
    period: "30d",
    completeness: 0.82,
    aggregates: { realizedProfit: 100, buyCount: 1, sellCount: 1 },
    warningCodes: ["gmgn_wallet_stats_partial_fields", "gmgn_wallet_stats_period_unverified"],
  });
  assert.equal(resolved.status, "PARTIAL");
  assert.equal(resolved.derived, true);
  assert.ok(resolved.warningCodes.some((c) => c.includes("status_derived_partial")));
});

test("resolveGmgnPeriodStatus derives UNAVAILABLE for expected metrics missing", () => {
  const resolved = resolveGmgnPeriodStatus({
    period: "30d",
    completeness: 0,
    aggregates: {},
    warningCodes: ["gmgn_expected_metrics_unavailable"],
  });
  assert.equal(resolved.status, "UNAVAILABLE");
});

test("null metrics stay null and are not coerced to zero in score inputs", () => {
  const s7d = period({ realizedProfit: null, winRate: null, buyCount: null, sellCount: null });
  const s30d = period({ realizedProfit: null, status: "UNAVAILABLE", completeness: 0 });
  const dq = evaluateWalletDataQuality(
    { ...s7d, status: "UNAVAILABLE", completeness: 0 },
    s30d
  );
  const scores = calculateBorrowedCandidateScores(
    { ...s7d, status: "UNAVAILABLE", completeness: 0 },
    s30d,
    dq,
    0
  );
  assert.equal(scores.borrowedCompositeLeadScore, null);
  assert.equal(scores.borrowedLeadTier, "UNQUALIFIED");
});

/** Build a 1433-address synthetic fixture directory for offline pipeline smoke. */
function buildSyntheticFixture(): {
  inputDir: string;
  gmgnDir: string;
  outputDir: string;
  cleanup: () => void;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wallet-screen-v01-"));
  const inputDir = path.join(root, "sol");
  const gmgnDir = path.join(root, "gmgn");
  const outputDir = path.join(root, "out");
  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(gmgnDir, { recursive: true });

  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const encodeBase58 = (bytes: Uint8Array): string => {
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    let n = 0n;
    for (const b of bytes) n = (n << 8n) + BigInt(b);
    let s = "";
    while (n > 0n) {
      const rem = Number(n % 58n);
      n = n / 58n;
      s = alphabet[rem] + s;
    }
    return "1".repeat(zeros) + (s || "1");
  };
  const addresses: string[] = [];
  for (let i = 0; i < 1433; i++) {
    const bytes = crypto.createHash("sha256").update(`wallet-screen-seed-${i}`).digest();
    addresses.push(encodeBase58(bytes));
  }

  fs.writeFileSync(path.join(inputDir, "sol_addresses.txt"), addresses.join("\n") + "\n", "utf8");
  const labels = addresses.map((address, i) => ({
    address,
    labels: i % 50 === 0 ? ["聪明钱候选", "KOL样例"] : i % 17 === 0 ? ["疑似机器"] : [`tag${i % 9}`],
    label_primary: i % 50 === 0 ? "聪明钱候选" : `tag${i % 9}`,
    labels_joined: "",
    label_count: 1,
  }));
  for (const l of labels) l.labels_joined = l.labels.join(" | ");
  fs.writeFileSync(path.join(inputDir, "sol_address_labels.json"), JSON.stringify(labels), "utf8");

  const profiles: any[] = [];
  const fetchedAt = "2026-07-29T20:22:55.568Z";
  for (let i = 0; i < addresses.length; i++) {
    const fp = computeFingerprint(addresses[i]!);
    const active = i % 3 === 0;
    const highProfit = i % 11 === 0;
    const highWin = i % 13 === 0;
    const lowWinHighProfit = i % 19 === 0;
    const extreme = i % 29 === 0;
    const missing = i % 31 === 0;

    for (const periodKey of ["7d", "30d"] as const) {
      if (missing) {
        profiles.push({
          period: periodKey,
          source: "gmgn",
          verificationStatus: "unverified",
          completeness: 0,
          aggregates: {},
          warningCodes: ["gmgn_expected_metrics_unavailable"],
          requestBudgetUsed: 1,
          sourceInputFingerprint: fp,
          fetchedAt,
        });
        continue;
      }
      const mult = periodKey === "7d" ? 0.3 : 1;
      const profit = highProfit ? 50000 * mult : lowWinHighProfit ? 20000 * mult : active ? 500 * mult : 0;
      const win = highWin ? 70 : lowWinHighProfit ? 20 : active ? 40 : 0;
      const buys = extreme ? 3000 : active ? 40 : 0;
      const sells = extreme ? 0 : active ? 30 : 0;
      profiles.push({
        period: periodKey,
        source: "gmgn",
        verificationStatus: "unverified",
        completeness: 0.82,
        aggregates: {
          periodPnl: null,
          realizedProfit: profit,
          realizedProfitPnl: 0.1,
          winRate: win,
          tradeCount: null,
          buyCount: buys,
          sellCount: sells,
          boughtCost: 1000,
          soldIncome: 1000 + profit,
          lastActiveTimestamp: active ? 1_785_000_000 : null,
          tokenNum: active ? 25 : 0,
        },
        warningCodes: ["gmgn_wallet_stats_partial_fields", "gmgn_wallet_stats_period_unverified"],
        requestBudgetUsed: 1,
        sourceInputFingerprint: fp,
        fetchedAt,
      });
    }
  }
  fs.writeFileSync(path.join(gmgnDir, "normalized_wallet_profiles.json"), JSON.stringify(profiles), "utf8");
  fs.writeFileSync(
    path.join(gmgnDir, "summary.json"),
    JSON.stringify({
      completeness: 0.74,
      warningCodes: ["gmgn_wallet_stats_period_unverified"],
      verificationStatus: "unverified",
      source: "gmgn",
    }),
    "utf8"
  );

  return {
    inputDir,
    gmgnDir,
    outputDir,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test("synthetic 1433 pipeline produces master, 30-50 candidates, research packs", async () => {
  const fx = buildSyntheticFixture();
  try {
    const addrHash = computeSha256(fs.readFileSync(path.join(fx.inputDir, "sol_addresses.txt")));
    const labelHash = computeSha256(fs.readFileSync(path.join(fx.inputDir, "sol_address_labels.json")));
    const result = await runCandidateScreeningV01({
      inputDir: fx.inputDir,
      gmgnOutputDir: fx.gmgnDir,
      outputDir: fx.outputDir,
      expectedHashes: {
        solAddressesTxtHash: addrHash,
        solAddressLabelsJsonHash: labelHash,
      },
      targetCandidateMin: 30,
      targetCandidateMax: 50,
      researchPackCount: 15,
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.metrics.totalAddresses, 1433);
    assert.ok(result.metrics.uniqueCandidateCount >= 30);
    assert.ok(result.metrics.uniqueCandidateCount <= 50);
    assert.equal(result.metrics.researchPackCount, 15);
    const represented = Object.values(result.metrics.categoryCounts).filter((n) => n > 0).length;
    assert.ok(represented >= 6, `expected >=6 categories, got ${represented}`);

    const masterLines = fs.readFileSync(path.join(fx.outputDir, "wallet_master_v0_1.jsonl"), "utf8").trim().split("\n");
    assert.equal(masterLines.length, 1433);
    const sample = JSON.parse(masterLines[0]!);
    assert.equal(sample.alpha_score, null);
    assert.equal(sample.final_wallet_score, null);
    assert.equal(sample.final_wallet_grade, null);
    assert.equal(sample.confirmed_label, null);
    assert.equal(sample.confirmed_behavior_labels, null);
    assert.equal(sample.source_type, "borrowed");
    assert.equal(sample.verification_status, "unverified");
    assert.ok(sample.provider_attested_period["7d"] === null);
    assert.ok(fs.existsSync(path.join(fx.outputDir, "wallet_replay_manifest_v0_1.json")));
    assert.ok(fs.existsSync(path.join(fx.outputDir, "wallet_data_quality_report_v0_1.json")));
    assert.ok(fs.existsSync(path.join(fx.outputDir, "candidate_union_v0_1.json")));
    const packs = fs.readdirSync(path.join(fx.outputDir, "research_packs"));
    assert.ok(packs.filter((p) => p.endsWith(".json")).length === 15);
    assert.ok(packs.filter((p) => p.endsWith(".md")).length === 15);
    assert.equal(CANDIDATE_SCREENING_TASK_ID, "SOL-WALLET-CANDIDATE-SCREENING-V0-1-001");
  } finally {
    fx.cleanup();
  }
});
