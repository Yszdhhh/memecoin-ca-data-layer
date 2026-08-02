import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import type {
  CandidateUnionEntry,
  WalletMasterV01Record,
} from "./candidate-screening-v0-1.js";

export const HUD_V02_TASK_ID = "SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001";
export const HUD_V02_LABEL_VERSION = "wallet-hud-v0.2";
export const HUD_V02_EVALUATED_AT = "2026-08-01T00:00:00.000Z";
export const SCENE_IDS = [
  "MULTI_TOKEN_REPEATABILITY",
  "PAYOFF_ASYMMETRY",
  "ACTIVITY_PERSISTENCE",
  "HIGH_FREQUENCY_SIGNAL_VALUE",
  "TRANSFER_ACCOUNTING_RISK",
] as const;
export const REPRODUCTION_TOKEN_THRESHOLDS = {
  MULTI_TOKEN_REPEATABILITY: 3,
  PAYOFF_ASYMMETRY: 2,
} as const;
export type SceneId = (typeof SCENE_IDS)[number];
export type EvidenceTier = "BORROWED_PROVIDER" | "CHAIN_SAMPLED";
export type SceneScoreSource =
  "BORROWED_PROXY" | "HYBRID_PROXY" | "CHAIN_SAMPLED_PROXY";
export type Confidence = "LOW" | "MEDIUM";
export type FollowabilityStatus = "LOW" | "UNKNOWN" | "RESEARCHABLE";
export type RecentTrend = "ENHANCING" | "STABLE" | "DECAYING" | "UNKNOWN";

type LastEmittedGmgnBaseline = {
  name: string;
  primary_scene: SceneId | null;
  scene_percentile: number | null;
  sample_n: number | null;
  recent_trend: RecentTrend;
  primary_risk: string;
  followability_status: FollowabilityStatus;
};

export interface SceneScore {
  scene_id: SceneId;
  raw_score: number | null;
  scene_percentile: number | null;
  eligible_n: number;
  peer_n: number;
  sample_n: number | null;
  sample_unit: "tokens" | "events";
  score_source: SceneScoreSource;
  evidence_tier: EvidenceTier;
  confidence: Confidence;
  reason_codes: string[];
  computed_at: string;
}
export interface WalletHudV02State {
  record_type: "wallet_hud_state_v0_2";
  schema_version: "wallet-hud-v0.2";
  address: string;
  wallet_ref: string | null;
  fingerprint12: string;
  primary_scene: SceneId | null;
  secondary_scenes: SceneId[];
  scene_scores: Record<SceneId, SceneScore>;
  evidence_tier: EvidenceTier;
  evidence_confidence: Confidence;
  effective_event_count: number | null;
  effective_token_count: number | null;
  recent_trend: RecentTrend;
  followability_status: FollowabilityStatus;
  monitor_priority: "HIGH" | "MEDIUM" | "LOW";
  primary_risk: string;
  evaluated_at: string;
  label_version: typeof HUD_V02_LABEL_VERSION;
  gmgn_name: string;
  gmgn_emoji: string;
  reason_codes: string[];
  pending_primary_scene?: SceneId | null;
  pending_primary_scene_cycles?: number;
  source_snapshot_hash?: string;
  last_emitted_gmgn_baseline?: LastEmittedGmgnBaseline;
}
export interface HudRefreshOptions {
  privateRoot?: string;
  outputDir?: string;
  manifestPath?: string;
  evaluatedAt?: string;
}
export interface HudRefreshResult {
  outputDir: string;
  walletCount: number;
  sceneEligibleN: Record<SceneId, number>;
  scenePeerN: Record<SceneId, number>;
  scenePrimarySceneCount: Record<SceneId, number>;
  scenePercentileCount: Record<SceneId, number>;
  sceneUnratedCount: Record<SceneId, number>;
  fullImportCount: number;
  deltaImportCount: number;
  changedWalletCount: number;
  shadowEventCount: number;
  sourceSnapshotHashes: Record<string, string>;
  sourceSnapshotHash: string;
  outputHashes: Record<string, string>;
}

type Row = Record<string, string>;
type Manifest = {
  task_id: string;
  inputs: Record<string, { local_path_hint: string; sha256: string }>;
};
type InputPaths = {
  candidate_union_v0_1: string;
  wallet_master_v0_1: string;
  wallet_hud_state: string;
  wallet_hud_history: string;
  wallet_verification_summary: string;
  profit_concentration_verified: string;
  followability_evidence: string;
  shadow_trade_monitoring_status: string;
};
type ChainEvidence = {
  verification: Row | null;
  concentration: Row | null;
  followability: Row | null;
  v01State: Record<string, unknown> | null;
};
type InternalWallet = {
  candidate: CandidateUnionEntry;
  master: WalletMasterV01Record;
  chain: ChainEvidence;
  evidenceTier: EvidenceTier;
  evidenceConfidence: Confidence;
  events: number | null;
  tokens: number | null;
  reproductionTokens: number | null;
  transferScore: number | null;
  transferLabel: string;
  trend: RecentTrend;
  scores: Record<SceneId, SceneScore>;
  eligible: Set<SceneId>;
  primary: SceneId | null;
  secondary: SceneId[];
  followability: FollowabilityStatus;
  risk: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  state: WalletHudV02State;
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
function readJsonl<T>(file: string): T[] {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function str(row: Row | null, key: string): string | null {
  const value = row?.[key];
  return value && value.trim() ? value : null;
}
function stateStr(
  row: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = row?.[key];
  return typeof value === "string" && value ? value : null;
}
function sha(file: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}
function readCsv(file: string): Row[] {
  const text = fs.readFileSync(file, "utf8");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = (rows[0] ?? []).map((value) => value.replace(/^\uFEFF/, ""));
  return rows
    .slice(1)
    .filter((values) => values.some(Boolean))
    .map((values) =>
      Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])),
    );
}
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
function writeCsv(
  file: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
): void {
  fs.writeFileSync(
    file,
    [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((header) => csvCell(row[header])).join(","),
      ),
    ].join("\n") + "\n",
    "utf8",
  );
}
function writeJsonl(file: string, rows: unknown[]): void {
  fs.writeFileSync(
    file,
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf8",
  );
}
function appendJsonl(file: string, rows: unknown[]): void {
  if (!rows.length) return;
  fs.appendFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
}
function hashObject(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function rowByFp(rows: Row[], fp: string): Row | null {
  return rows.find((row) => row.fingerprint12 === fp) ?? null;
}
function safeInput(root: string, hint: string): string {
  const base = path.resolve(root);
  const file = path.resolve(base, ...hint.split(/[\\/]/));
  if (!file.toLowerCase().startsWith((base + path.sep).toLowerCase()))
    throw new Error("input path escapes private root: " + hint);
  return file;
}
function checkInputs(root: string, manifest: Manifest): InputPaths {
  const paths: Record<string, string> = {};
  for (const [name, spec] of Object.entries(manifest.inputs)) {
    const file = safeInput(root, spec.local_path_hint);
    if (!fs.existsSync(file))
      throw new Error("missing private input " + name + ": " + file);
    const actual = sha(file);
    if (actual !== spec.sha256)
      throw new Error(
        "hash mismatch for " +
          name +
          ": expected " +
          spec.sha256 +
          ", got " +
          actual,
      );
    paths[name] = file;
  }
  return paths as InputPaths;
}
function privateRoot(options: HudRefreshOptions): string {
  return (
    options.privateRoot ??
    process.env.CHAINFM_OUT_DIR ??
    path.join(os.homedir(), "chainfm_out")
  );
}
function isChain(chain: ChainEvidence): boolean {
  return chain.verification !== null;
}
function confidence(chain: ChainEvidence): Confidence {
  if (!isChain(chain)) return "LOW";
  return str(chain.verification, "reconstructed_pnl_status") ===
    "PNL_RECONSTRUCTED" &&
    str(chain.verification, "transfer_artifact_risk") === "LOW"
    ? "MEDIUM"
    : "LOW";
}
function transferRisk(
  chain: ChainEvidence,
  master: WalletMasterV01Record,
): { score: number | null; label: string; reasons: string[] } {
  const direct = str(chain.verification, "transfer_artifact_risk");
  if (direct === "HIGH")
    return {
      score: 90,
      label: "HIGH",
      reasons: ["CHAIN_TRANSFER_ARTIFACT_HIGH"],
    };
  if (direct === "MEDIUM")
    return {
      score: 55,
      label: "MEDIUM",
      reasons: ["CHAIN_TRANSFER_ARTIFACT_MEDIUM"],
    };
  if (direct === "LOW")
    return {
      score: 10,
      label: "LOW",
      reasons: ["CHAIN_TRANSFER_ARTIFACT_LOW"],
    };
  const flags = master.anomaly_flags ?? [];
  if (
    flags.some(
      (flag) =>
        flag.includes("ACCOUNTING") ||
        flag.includes("PROVIDER_DATA_INCOMPLETE"),
    )
  )
    return {
      score: 35,
      label: "PROVIDER_UNKNOWN",
      reasons: ["PROVIDER_ACCOUNTING_COMPLETENESS_UNKNOWN"],
    };
  return {
    score: null,
    label: "UNKNOWN",
    reasons: ["TRANSFER_RISK_NOT_OBSERVED"],
  };
}
function getTrend(master: WalletMasterV01Record): RecentTrend {
  if (master.activity_tier === "INACTIVE") return "DECAYING";
  const c = master.seven_day_vs_thirty_day_consistency;
  if (c === null || c === undefined) return "UNKNOWN";
  if (c >= 1.15) return "ENHANCING";
  if (c <= 0.75) return "DECAYING";
  return "STABLE";
}
function counts(
  master: WalletMasterV01Record,
  chain: ChainEvidence,
): { events: number | null; tokens: number | null; reproductionTokens: number | null } {
  const events = num(master.trade_count_proxy);
  if (!isChain(chain)) {
    const tokens = num(master.token_count);
    const normalized = tokens !== null && tokens > 0 ? tokens : null;
    return { events, tokens: normalized, reproductionTokens: normalized };
  }
  const profitTokens = num(str(chain.verification, "verified_profit_token_count"));
  const lossTokens = num(str(chain.verification, "verified_loss_token_count"));
  const tokens = profitTokens !== null && lossTokens !== null ? profitTokens + lossTokens : profitTokens;
  return {
    events,
    tokens: tokens !== null && tokens > 0 ? tokens : null,
    reproductionTokens: profitTokens !== null && profitTokens > 0 ? profitTokens : null,
  };
}
function activityScore(master: WalletMasterV01Record): {
  value: number | null;
  reasons: string[];
} {
  if (master.activity_tier === "INACTIVE")
    return { value: null, reasons: ["NO_CURRENT_ACTIVITY_SIGNAL"] };
  const base = master.activity_tier === "ACTIVE_7D" ? 100 : 68;
  const c = master.seven_day_vs_thirty_day_consistency;
  const adj =
    c === null || c === undefined
      ? 0
      : Math.max(-20, Math.min(10, (c - 1) * 40));
  return {
    value: Math.round(Math.max(0, Math.min(100, base + adj))),
    reasons: [
      "GMGN_ACTIVITY_TIER_PROXY",
      ...(num(master.trade_count_proxy) === null ? ["ACTIVITY_EVENT_COUNT_UNKNOWN"] : []),
    ],
  };
}
function reproductionEvidenceReady(
  chain: ChainEvidence,
  tokenN: number | null,
  scene: keyof typeof REPRODUCTION_TOKEN_THRESHOLDS,
): boolean {
  if (tokenN === null || tokenN < REPRODUCTION_TOKEN_THRESHOLDS[scene]) return false;
  return true;
}
function multiScore(
  master: WalletMasterV01Record,
  chain: ChainEvidence,
  tokenN: number | null,
  transfer: number | null,
): { value: number | null; reasons: string[] } {
  const profit = num(master.profit_30d);
  if (tokenN === null || !reproductionEvidenceReady(chain, tokenN, "MULTI_TOKEN_REPEATABILITY") || profit === null || profit <= 0)
    return { value: null, reasons: ["INSUFFICIENT_MULTI_TOKEN_SAMPLE"] };
  const breadth = Math.min(100, tokenN * 10);
  const win = num(master.win_rate_30d);
  const positive = win === null ? 45 : Math.max(0, Math.min(100, win));
  const top1 = num(str(chain.concentration, "gmgn_top1_share"));
  const concentration =
    top1 === null ? 50 : Math.max(0, Math.min(100, 100 - top1 * 100));
  const discount = transfer === null ? 0 : -Math.min(25, transfer * 0.2);
  const value = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        breadth * 0.35 + positive * 0.3 + concentration * 0.35 + discount,
      ),
    ),
  );
  const reasons = ["MULTI_TOKEN_BREADTH", "POSITIVE_PROFIT_PROXY"];
  if (top1 === null) reasons.push("TOP1_CONCENTRATION_UNKNOWN");
  if (transfer !== null && transfer >= 55)
    reasons.push("TRANSFER_COST_BASIS_RISK_DISCOUNT");
  return { value, reasons };
}
function payoffScore(
  master: WalletMasterV01Record,
  chain: ChainEvidence,
  tokenN: number | null,
): { value: number | null; reasons: string[] } {
  const profit = num(master.profit_30d);
  const win = num(master.win_rate_30d);
  if (!reproductionEvidenceReady(chain, tokenN, "PAYOFF_ASYMMETRY")) return { value: null, reasons: ["INSUFFICIENT_PAYOFF_REPRODUCTION_SAMPLE"] };
  if (profit === null || profit <= 0 || win === null || win >= 70) return { value: null, reasons: ["LOW_WINRATE_HIGH_PAYOFF_PATTERN_NOT_PRESENT"] };
  const pp = num(master.profit_percentile_30d);
  const asym = Math.max(0, 100 - win);
  const sampleAdj = tokenN !== null && tokenN >= 2 ? 10 : -10;
  const value = Math.round(Math.max(0, Math.min(100, asym * 0.55 + (pp ?? 50) * 0.45 + sampleAdj)));
  return { value, reasons: ["LOW_WINRATE", "POSITIVE_PROFIT_PROXY", pp === null ? "PROFIT_PERCENTILE_UNKNOWN" : "PROFIT_PERCENTILE_BORROWED"] };
}
function hfScore(
  master: WalletMasterV01Record,
  eventN: number | null,
  threshold: number | null,
): { value: number | null; reasons: string[] } {
  if (
    eventN === null ||
    threshold === null ||
    eventN < threshold ||
    master.activity_tier === "INACTIVE"
  )
    return { value: null, reasons: ["HIGH_FREQUENCY_PATTERN_NOT_PRESENT"] };
  const intensity = Math.min(
    100,
    Math.round((eventN / Math.max(threshold, 1)) * 55),
  );
  const breadth = Math.min(35, Math.max(0, (num(master.token_count) ?? 0) * 2));
  const activity = master.activity_tier === "ACTIVE_7D" ? 10 : 5;
  return {
    value: Math.min(100, intensity + breadth + activity),
    reasons: [
      "TRADE_COUNT_PROXY",
      "MULTI_TOKEN_DENSITY_PROXY",
      "NOT_FOLLOWABILITY",
    ],
  };
}
function sceneEligible(
  scene: SceneId,
  master: WalletMasterV01Record,
  chain: ChainEvidence,
  c: { events: number | null; tokens: number | null; reproductionTokens: number | null },
  transfer: { score: number | null },
  threshold: number | null,
): boolean {
  const profit = num(master.profit_30d);
  const win = num(master.win_rate_30d);
  if (scene === "MULTI_TOKEN_REPEATABILITY") return reproductionEvidenceReady(chain, c.reproductionTokens, "MULTI_TOKEN_REPEATABILITY") && profit !== null && profit > 0 && win !== null && win >= 50;
  if (scene === "PAYOFF_ASYMMETRY") return reproductionEvidenceReady(chain, c.reproductionTokens, "PAYOFF_ASYMMETRY") && profit !== null && profit > 0 && win !== null && win < 50;
  if (scene === "HIGH_FREQUENCY_SIGNAL_VALUE") return hfScore(master, c.events, threshold).value !== null;
  if (scene === "ACTIVITY_PERSISTENCE") return activityScore(master).value !== null;
  return transfer.score !== null;
}
function sceneSource(scene: SceneId, chain: ChainEvidence): SceneScoreSource {
  if (!isChain(chain)) return "BORROWED_PROXY";
  if (
    scene === "ACTIVITY_PERSISTENCE" ||
    scene === "HIGH_FREQUENCY_SIGNAL_VALUE"
  )
    return "BORROWED_PROXY";
  if (scene === "TRANSFER_ACCOUNTING_RISK") return "CHAIN_SAMPLED_PROXY";
  if (scene === "MULTI_TOKEN_REPEATABILITY")
    return chain.concentration !== null &&
      str(chain.concentration, "verified_profit_token_count") !== null
      ? "CHAIN_SAMPLED_PROXY"
      : "HYBRID_PROXY";
  return str(chain.verification, "reconstructed_pnl_status") !== null &&
    str(chain.verification, "verified_profit_token_count") !== null
    ? "CHAIN_SAMPLED_PROXY"
    : "HYBRID_PROXY";
}
function score(
  scene: SceneId,
  master: WalletMasterV01Record,
  chain: ChainEvidence,
  c: { events: number | null; tokens: number | null; reproductionTokens: number | null },
  transfer: { score: number | null; reasons: string[] },
  threshold: number | null,
  evaluatedAt: string,
): SceneScore {
  let result: { value: number | null; reasons: string[] };
  if (scene === "MULTI_TOKEN_REPEATABILITY")
    result = multiScore(master, chain, c.reproductionTokens, transfer.score);
  else if (scene === "PAYOFF_ASYMMETRY") result = payoffScore(master, chain, c.reproductionTokens);
  else if (scene === "ACTIVITY_PERSISTENCE") result = activityScore(master);
  else if (scene === "HIGH_FREQUENCY_SIGNAL_VALUE")
    result = hfScore(master, c.events, threshold);
  else result = { value: transfer.score, reasons: transfer.reasons };
  const unit =
    scene === "ACTIVITY_PERSISTENCE" || scene === "HIGH_FREQUENCY_SIGNAL_VALUE"
      ? "events"
      : "tokens";
  const sample = unit === "events" ? c.events : c.reproductionTokens;
  const source = sceneSource(scene, chain);
  const lowReason = result.reasons.some(
    (reason) => reason.includes("UNKNOWN") || reason.includes("INSUFFICIENT"),
  );
  return {
    scene_id: scene,
    raw_score: result.value,
    scene_percentile: null,
    eligible_n: 0,
    peer_n: 0,
    sample_n: sample,
    sample_unit: unit,
    score_source: source,
    evidence_tier:
      source === "BORROWED_PROXY" ? "BORROWED_PROVIDER" : "CHAIN_SAMPLED",
    confidence:
      source === "CHAIN_SAMPLED_PROXY" && result.value !== null && !lowReason
        ? "MEDIUM"
        : "LOW",
    reason_codes: result.reasons,
    computed_at: evaluatedAt,
  };
}
function primary(
  scores: Record<SceneId, SceneScore>,
  eligible: Set<SceneId>,
): SceneId | null {
  const explicitOrder: SceneId[] = [
    "PAYOFF_ASYMMETRY",
    "HIGH_FREQUENCY_SIGNAL_VALUE",
    "MULTI_TOKEN_REPEATABILITY",
    "ACTIVITY_PERSISTENCE",
  ];
  return (
    explicitOrder.find(
      (scene) => eligible.has(scene) && scores[scene].raw_score !== null,
    ) ?? null
  );
}
function secondary(
  scores: Record<SceneId, SceneScore>,
  main: SceneId | null,
): SceneId[] {
  const behaviorOrder: SceneId[] = [
    "PAYOFF_ASYMMETRY",
    "HIGH_FREQUENCY_SIGNAL_VALUE",
    "MULTI_TOKEN_REPEATABILITY",
    "ACTIVITY_PERSISTENCE",
  ];
  const result = behaviorOrder
    .filter((scene) => scene !== main && scores[scene].raw_score !== null)
    .slice(0, 2);
  if (
    scores.TRANSFER_ACCOUNTING_RISK.raw_score !== null &&
    scores.TRANSFER_ACCOUNTING_RISK.raw_score >= 55
  )
    result.push("TRANSFER_ACCOUNTING_RISK");
  return result.slice(0, 2);
}
function percentile(value: number, values: number[]): number {
  return Math.max(
    1,
    Math.min(
      100,
      Math.round(
        (values.filter((v) => v <= value).length / values.length) * 100,
      ),
    ),
  );
}
function follow(chain: ChainEvidence): FollowabilityStatus {
  const value = str(chain.followability, "followability_status");
  if (value === "FOLLOWABILITY_LOW") return "LOW";
  if (value === "FOLLOWABILITY_RESEARCHABLE") return "RESEARCHABLE";
  return "UNKNOWN";
}
function displayScene(scene: SceneId | null, score: SceneScore | null): string {
  if (scene === "MULTI_TOKEN_REPEATABILITY")
    return score?.score_source === "CHAIN_SAMPLED_PROXY"
      ? "多币盈利复现"
      : "多币活跃线索";
  if (scene === "PAYOFF_ASYMMETRY")
    return score?.score_source === "CHAIN_SAMPLED_PROXY"
      ? "低胜高赔复现"
      : "低胜高赔线索";
  if (scene === "ACTIVITY_PERSISTENCE") return "持续活跃";
  if (scene === "HIGH_FREQUENCY_SIGNAL_VALUE") return "高频异动";
  return "证据待标";
}
function emoji(scene: SceneId | null): string {
  if (scene === "HIGH_FREQUENCY_SIGNAL_VALUE") return "🟡";
  if (scene === "MULTI_TOKEN_REPEATABILITY" || scene === "PAYOFF_ASYMMETRY")
    return "🟢";
  return "🔵";
}
function labelTail(
  trend: RecentTrend,
  transferLabel: string,
  followability: FollowabilityStatus,
): string {
  if (transferLabel === "HIGH") return "成本缺";
  if (followability === "LOW") return "难跟单";
  if (trend === "ENHANCING") return "增强";
  if (trend === "DECAYING") return "衰退";
  if (trend === "STABLE") return "趋势稳";
  return "待证";
}
function gmgnName(
  scene: SceneId | null,
  score: SceneScore | null,
  trend: RecentTrend,
  transferLabel: string,
  followability: FollowabilityStatus,
): string {
  const strength =
    score?.scene_percentile == null ? "强度待标" : "P" + score.scene_percentile;
  const prefix = score?.sample_unit === "events" ? "E" : "T";
  const sample = score?.sample_n == null ? "待标" : prefix + score.sample_n;
  return (
    displayScene(scene, score) +
    "｜" +
    strength +
    "｜" +
    sample +
    "｜" +
    labelTail(trend, transferLabel, followability)
  );
}
function buildInternal(
  candidate: CandidateUnionEntry,
  master: WalletMasterV01Record,
  chain: ChainEvidence,
  threshold: number | null,
  evaluatedAt: string,
): InternalWallet {
  const c = counts(master, chain);
  const transfer = transferRisk(chain, master);
  const eligible = new Set(
    SCENE_IDS.filter((scene) =>
      sceneEligible(scene, master, chain, c, transfer, threshold),
    ),
  );
  const scores = Object.fromEntries(
    SCENE_IDS.map((scene) => {
      const value = score(
        scene,
        master,
        chain,
        c,
        transfer,
        threshold,
        evaluatedAt,
      );
      if (!eligible.has(scene)) {
        value.raw_score = null;
        value.reason_codes = [
          ...value.reason_codes,
          "SCENE_MINIMUM_QUALIFICATION_NOT_MET",
        ];
      }
      return [scene, value];
    }),
  ) as Record<SceneId, SceneScore>;
  const main = primary(scores, eligible);
  const second = secondary(scores, main);
  const f = follow(chain);
  const trend = getTrend(master);
  const risk =
    transfer.label === "HIGH"
      ? "TRANSFER_COST_BASIS_MISSING"
      : main === "HIGH_FREQUENCY_SIGNAL_VALUE"
        ? "TIMING_AND_HIGH_FREQUENCY"
        : main === "PAYOFF_ASYMMETRY"
          ? "LOW_WINRATE_SAMPLE_DEPENDENCE"
          : str(chain.verification, "evidence_gaps")
            ? "CHAIN_SAMPLE_EVIDENCE_GAPS"
            : "PROVIDER_PERIOD_UNVERIFIED";
  const priority =
    transfer.label === "HIGH" || main === "HIGH_FREQUENCY_SIGNAL_VALUE"
      ? "HIGH"
      : main === "PAYOFF_ASYMMETRY" || f === "RESEARCHABLE"
        ? "MEDIUM"
        : "LOW";
  const tier = isChain(chain) ? "CHAIN_SAMPLED" : "BORROWED_PROVIDER";
  const conf = confidence(chain);
  const state: WalletHudV02State = {
    record_type: "wallet_hud_state_v0_2",
    schema_version: "wallet-hud-v0.2",
    address: master.address,
    wallet_ref: stateStr(chain.v01State, "wallet_ref"),
    fingerprint12: candidate.wallet_fingerprint.slice(0, 12),
    primary_scene: main,
    secondary_scenes: second,
    scene_scores: scores,
    evidence_tier: tier,
    evidence_confidence: conf,
    effective_event_count: c.events,
    effective_token_count: c.tokens,
    recent_trend: trend,
    followability_status: f,
    monitor_priority: priority,
    primary_risk: risk,
    evaluated_at: evaluatedAt,
    label_version: HUD_V02_LABEL_VERSION,
    gmgn_name: gmgnName(
      main,
      main ? scores[main] : null,
      trend,
      transfer.label,
      f,
    ),
    gmgn_emoji: emoji(main),
    reason_codes: [
      "SAME_SCENE_ONLY_COMPARISON",
      tier === "CHAIN_SAMPLED"
        ? "CHAIN_SAMPLED_NOT_FULL_WALLET"
        : "GMGN_BORROWED_PROXY",
      ...transfer.reasons,
      ...(main === null ? ["NO_PRIMARY_SCENE_WITH_VALID_SAMPLE"] : []),
    ],
  };
  return {
    candidate,
    master,
    chain,
    evidenceTier: tier,
    evidenceConfidence: conf,
    events: c.events,
    tokens: c.tokens,
    reproductionTokens: c.reproductionTokens,
    transferScore: transfer.score,
    transferLabel: transfer.label,
    trend,
    scores,
    eligible,
    primary: main,
    secondary: second,
    followability: f,
    risk,
    priority,
    state,
  };
}
function oldSceneScore(
  old: Record<string, unknown> | null,
  scene: SceneId,
): Record<string, unknown> | null {
  const scores = old?.scene_scores;
  if (!scores || typeof scores !== "object") return null;
  const value = (scores as Record<string, unknown>)[scene];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
function percentileBucket(value: number | null): number {
  if (value === null) return 0;
  if (value >= 90) return 3;
  if (value >= 75) return 2;
  if (value >= 50) return 1;
  return 0;
}
function isMajorRisk(value: string | null): boolean {
  return (
    value === "TRANSFER_COST_BASIS_MISSING" ||
    value === "TIMING_AND_HIGH_FREQUENCY" ||
    value === "LOW_WINRATE_SAMPLE_DEPENDENCE"
  );
}
function baselineFromState(old: Record<string, unknown> | null): LastEmittedGmgnBaseline | null {
  if (!old) return null;
  const raw = old.last_emitted_gmgn_baseline;
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    const sceneText = typeof value.primary_scene === "string" ? value.primary_scene : null;
    return {
      name: typeof value.name === "string" ? value.name : (stateStr(old, "gmgn_name") ?? ""),
      primary_scene: SCENE_IDS.includes(sceneText as SceneId) ? sceneText as SceneId : null,
      scene_percentile: num(value.scene_percentile),
      sample_n: num(value.sample_n),
      recent_trend: (value.recent_trend as RecentTrend) ?? "UNKNOWN",
      primary_risk: typeof value.primary_risk === "string" ? value.primary_risk : (stateStr(old, "primary_risk") ?? ""),
      followability_status: (value.followability_status as FollowabilityStatus) ?? "UNKNOWN",
    };
  }
  const sceneText = stateStr(old, "primary_scene");
  const scene = SCENE_IDS.includes(sceneText as SceneId) ? sceneText as SceneId : null;
  const score = scene ? oldSceneScore(old, scene) : null;
  return {
    name: stateStr(old, "gmgn_name") ?? "",
    primary_scene: scene,
    scene_percentile: num(score?.scene_percentile),
    sample_n: num(score?.sample_n),
    recent_trend: (stateStr(old, "recent_trend") as RecentTrend) ?? "UNKNOWN",
    primary_risk: stateStr(old, "primary_risk") ?? "",
    followability_status: (stateStr(old, "followability_status") as FollowabilityStatus) ?? "UNKNOWN",
  };
}
function currentBaseline(wallet: InternalWallet): LastEmittedGmgnBaseline {
  const score = wallet.primary ? wallet.state.scene_scores[wallet.primary] : null;
  return { name: wallet.state.gmgn_name, primary_scene: wallet.state.primary_scene, scene_percentile: score?.scene_percentile ?? null, sample_n: score?.sample_n ?? null, recent_trend: wallet.trend, primary_risk: wallet.risk, followability_status: wallet.followability };
}
function deltaReasons(
  wallet: InternalWallet,
  old: Record<string, unknown> | null,
  baseline: LastEmittedGmgnBaseline | null = baselineFromState(old),
): string[] {
  if (old === null) return ["INITIAL_V0_2_STATE"];
  if (stateStr(old, "label_version") !== HUD_V02_LABEL_VERSION) return ["SCENE_MODEL_MIGRATION_V0_2"];
  if (!baseline) return ["SCENE_MODEL_MIGRATION_V0_2"];
  const reasons: string[] = [];
  if (baseline.primary_scene !== wallet.state.primary_scene) reasons.push("PRIMARY_SCENE_CHANGED");
  const nextScore = wallet.primary === null ? null : wallet.state.scene_scores[wallet.primary];
  const oldPxx = baseline.scene_percentile;
  const newPxx = nextScore?.scene_percentile ?? null;
  if (percentileBucket(oldPxx) !== percentileBucket(newPxx)) reasons.push("PERCENTILE_BUCKET_CROSSED");
  if (oldPxx !== null && newPxx !== null && Math.abs(oldPxx - newPxx) >= 10) reasons.push("PERCENTILE_CHANGE_GE_10");
  const oldSample = baseline.sample_n;
  const newSample = nextScore?.sample_n ?? null;
  if (oldSample !== null && newSample !== null && newSample - oldSample >= 5) reasons.push("EFFECTIVE_SAMPLE_INCREASE_GE_5");
  const reverse = (baseline.recent_trend === "ENHANCING" && wallet.trend === "DECAYING") || (baseline.recent_trend === "DECAYING" && wallet.trend === "ENHANCING");
  if (reverse) reasons.push("TREND_REVERSED");
  if (!isMajorRisk(baseline.primary_risk) && isMajorRisk(wallet.risk)) reasons.push("NEW_MAJOR_RISK");
  if (baseline.followability_status !== wallet.followability) reasons.push("FOLLOWABILITY_CHANGED");
  return reasons;
}

export function computeHudV02(
  candidates: CandidateUnionEntry[],
  masters: WalletMasterV01Record[],
  evidence: Map<string, ChainEvidence>,
  previous: Map<string, Record<string, unknown>>,
  evaluatedAt = HUD_V02_EVALUATED_AT,
  sourceSnapshotHash = "UNAVAILABLE",
): {
  wallets: InternalWallet[];
  history: Array<Record<string, unknown>>;
  previews: Array<Record<string, unknown>>;
} {
  const masterMap = new Map(masters.map((m) => [m.address, m]));
  const pairs = candidates.map((candidate) => {
    const master = masterMap.get(candidate.address);
    if (!master)
      throw new Error(
        "candidate missing from master: " +
          candidate.wallet_fingerprint.slice(0, 12),
      );
    return { candidate, master };
  });
  const trades = pairs
    .map((p) => num(p.master.trade_count_proxy))
    .filter((n): n is number => n !== null && n > 0)
    .sort((a, b) => a - b);
  const threshold =
    trades.length >= 4
      ? (trades[Math.floor(trades.length * 0.75)] ?? null)
      : null;
  const wallets = pairs.map((p) =>
    buildInternal(
      p.candidate,
      p.master,
      evidence.get(p.master.address) ?? {
        verification: null,
        concentration: null,
        followability: null,
        v01State: null,
      },
      threshold,
      evaluatedAt,
    ),
  );
  for (const wallet of wallets)
    applyPrimaryDebounce(wallet, previous.get(wallet.master.address) ?? null);
  const peers = new Map<SceneId, InternalWallet[]>();
  for (const scene of SCENE_IDS)
    peers.set(
      scene,
      wallets.filter(
        (w) => w.eligible.has(scene) && w.scores[scene].raw_score !== null,
      ),
    );
  for (const wallet of wallets) {
    for (const scene of SCENE_IDS) {
      const s = wallet.scores[scene];
      const eligibleN = wallets.filter((w) => w.eligible.has(scene)).length;
      const group = peers.get(scene) ?? [];
      s.eligible_n = eligibleN;
      s.peer_n = group.length;
      const values = group
        .map((w) => w.scores[scene].raw_score)
        .filter((v): v is number => v !== null);
      s.scene_percentile =
        s.raw_score === null || group.length < 10 || values.length === 0
          ? null
          : percentile(s.raw_score, values);
    }
    const mainScore =
      wallet.primary === null ? null : wallet.scores[wallet.primary];
    wallet.state.gmgn_name = gmgnName(
      wallet.primary,
      mainScore,
      wallet.trend,
      wallet.transferLabel,
      wallet.followability,
    );
  }
  const history: Array<Record<string, unknown>> = [];
  const previews: Array<Record<string, unknown>> = [];
  for (const wallet of wallets) {
    const old = previous.get(wallet.master.address) ?? null;
    const priorBaseline = baselineFromState(old);
    const oldName = priorBaseline?.name ?? stateStr(old, "gmgn_name") ?? "";
    const reasons = deltaReasons(wallet, old, priorBaseline);
    const changed = reasons.length > 0;
    const reason = reasons[0] ?? "NO_DELTA_THRESHOLD";
    const baseline = changed ? currentBaseline(wallet) : (priorBaseline ?? currentBaseline(wallet));
    if (!changed && oldName && wallet.state.gmgn_name !== oldName) {
      wallet.state.reason_codes = [...wallet.state.reason_codes, "GMGN_NAME_HELD_FOR_CUMULATIVE_DEBOUNCE"];
      wallet.state.gmgn_name = oldName;
    }
    if (sourceSnapshotHash !== "UNAVAILABLE") {
      wallet.state.source_snapshot_hash = sourceSnapshotHash;
      wallet.state.last_emitted_gmgn_baseline = baseline;
    }
    history.push({ record_type: "wallet_hud_history_v0_2", schema_version: "wallet-hud-v0.2", address: wallet.master.address, fingerprint12: wallet.state.fingerprint12, evaluated_at: evaluatedAt, previous_state: old, new_state: wallet.state, reason_codes: [reason, ...reasons.slice(1), ...wallet.state.reason_codes], source_snapshot_hash: sourceSnapshotHash, delta_emitted: changed, last_emitted_gmgn_baseline: baseline, label_version: HUD_V02_LABEL_VERSION });
    const primaryScore = wallet.primary === null ? null : wallet.state.scene_scores[wallet.primary];
    previews.push({ address: wallet.master.address, fingerprint12: wallet.state.fingerprint12, old_name: oldName, new_name: wallet.state.gmgn_name, changed, change_reason: reason, primary_scene: wallet.state.primary_scene ?? "", scene_percentile: primaryScore?.scene_percentile ?? null, peer_n: primaryScore?.peer_n ?? null, sample_n: primaryScore?.sample_n ?? null, sample_unit: primaryScore?.sample_unit ?? null, score_source: primaryScore?.score_source ?? "BORROWED_PROXY", evidence_tier: primaryScore?.evidence_tier ?? wallet.state.evidence_tier, confidence: primaryScore?.confidence ?? wallet.state.evidence_confidence });
  }
  return { wallets, history, previews };
}
function csvMaps(paths: InputPaths): {
  map: Map<string, ChainEvidence>;
  rows: Row[];
} {
  const rows = readCsv(paths.wallet_verification_summary);
  const concentrations = readCsv(paths.profit_concentration_verified);
  const follows = readCsv(paths.followability_evidence);
  const states = readJsonl<Record<string, unknown>>(paths.wallet_hud_state);
  const map = new Map<string, ChainEvidence>();
  for (const row of rows)
    if (row.address)
      map.set(row.address, {
        verification: row,
        concentration: rowByFp(concentrations, row.fingerprint12 ?? ""),
        followability: rowByFp(follows, row.fingerprint12 ?? ""),
        v01State: states.find((state) => state.address === row.address) ?? null,
      });
  return { map, rows };
}
function applyPrimaryDebounce(
  wallet: InternalWallet,
  old: Record<string, unknown> | null,
): void {
  const oldLabel = stateStr(old, "label_version");
  const oldPrimaryText = stateStr(old, "primary_scene");
  const oldPrimary = SCENE_IDS.includes(oldPrimaryText as SceneId)
    ? (oldPrimaryText as SceneId)
    : null;
  if (oldLabel !== HUD_V02_LABEL_VERSION || oldPrimary === wallet.primary) {
    wallet.state.pending_primary_scene = null;
    wallet.state.pending_primary_scene_cycles = 0;
    return;
  }
  const pendingText = stateStr(old, "pending_primary_scene");
  const pending = SCENE_IDS.includes(pendingText as SceneId)
    ? (pendingText as SceneId)
    : null;
  const cycles = num(old?.pending_primary_scene_cycles) ?? 0;
  if (pending === wallet.primary && cycles >= 1) {
    wallet.state.pending_primary_scene = null;
    wallet.state.pending_primary_scene_cycles = 0;
    return;
  }
  const proposed = wallet.primary;
  wallet.primary = oldPrimary;
  wallet.state.primary_scene = oldPrimary;
  wallet.secondary = secondary(wallet.scores, oldPrimary);
  wallet.state.secondary_scenes = wallet.secondary;
  const mainScore = oldPrimary === null ? null : wallet.scores[oldPrimary];
  wallet.state.gmgn_name = gmgnName(
    oldPrimary,
    mainScore,
    wallet.trend,
    wallet.transferLabel,
    wallet.followability,
  );
  wallet.state.pending_primary_scene = proposed;
  wallet.state.pending_primary_scene_cycles =
    pending === proposed ? cycles + 1 : 1;
}
function importRow(state: WalletHudV02State): {
  address: string;
  name: string;
  emoji: string;
} {
  return {
    address: state.address,
    name: state.gmgn_name,
    emoji: state.gmgn_emoji,
  };
}
function methodology(result: HudRefreshResult, at: string): string {
  return [
    "# Wallet HUD v0.2 methodology",
    "",
    "- Task: " + HUD_V02_TASK_ID,
    "- Evaluation time: " + at,
    "- Population: exactly 32 candidate addresses; no global wallet score or rank.",
    "- Primary scene uses explicit qualification rules and a fixed behavior order; no cross-scene raw-score ranking.",
    "- TRANSFER_ACCOUNTING_RISK is an overlay only; ACTIVITY_PERSISTENCE is a state dimension or fallback.",
    "- Cohorts: eligible_n is minimum-qualified, peer_n is the same-scene ranking cohort, and primary_scene_count is separate.",
    "- Percentiles compare only within the same scene_id; scene_percentile is null when peer_n < 10.",
    "- Scene provenance is BORROWED_PROXY, HYBRID_PROXY, or CHAIN_SAMPLED_PROXY; a chain row does not upgrade unrelated scenes.",
    "- GMGN/provider aggregates remain proxies; null is never converted to zero.",
    "- Five pilot wallets can retain CHAIN_SAMPLED evidence, but all scores remain sample-bounded proxies.",
    "- Shadow events: " +
      result.shadowEventCount +
      "; shadow statistics are intentionally absent.",
    "- Refresh is deterministic, offline, and network-free.",
    "",
    "## Scenes",
    "",
    "- MULTI_TOKEN_REPEATABILITY: breadth, positive proxy, concentration and transfer discount.",
    "- PAYOFF_ASYMMETRY: low win-rate plus positive profit proxy; not a direct strength claim.",
    "- ACTIVITY_PERSISTENCE: 7d/30d activity and consistency proxy.",
    "- HIGH_FREQUENCY_SIGNAL_VALUE: observation value only; not followability.",
    "- TRANSFER_ACCOUNTING_RISK: accounting risk; higher is more risk, not ability.",
    "",
    "## Counts",
    "",
    "- Wallet states: " + result.walletCount,
    "- Full import rows: " + result.fullImportCount,
    "- Delta import rows: " + result.deltaImportCount,
    "- Changed rows: " + result.changedWalletCount,
    "",
  ].join("\n");
}
export async function runWalletHudV02(
  options: HudRefreshOptions = {},
): Promise<HudRefreshResult> {
  const root = privateRoot(options);
  const manifestFile =
    options.manifestPath ??
    process.env.WALLET_HUD_MANIFEST_PATH ??
    path.resolve(
      process.cwd(),
      "harness/inputs/SOL-WALLET-HUD-V0-2-SCENE-STRENGTH-001/manifest.json",
    );
  const manifest = readJson<Manifest>(manifestFile);
  if (manifest.task_id !== HUD_V02_TASK_ID)
    throw new Error("wrong manifest task: " + manifest.task_id);
  const files = checkInputs(root, manifest);
  const candidatePayload = readJson<{ candidates: CandidateUnionEntry[] }>(
    files.candidate_union_v0_1,
  );
  const candidates = candidatePayload.candidates;
  const masters = readJsonl<WalletMasterV01Record>(files.wallet_master_v0_1);
  if (
    candidates.length !== 32 ||
    new Set(candidates.map((c) => c.address)).size !== 32
  )
    throw new Error("candidate set must be exactly 32 unique addresses");
  if (
    masters.length !== 1433 ||
    new Set(masters.map((m) => m.address)).size !== 1433
  )
    throw new Error("wallet master must be exactly 1433 unique addresses");
  const maps = csvMaps(files);
  if (maps.rows.length !== 5)
    throw new Error("chain verification summary must contain exactly 5 rows");
  const shadow = readJson<{ event_count: number }>(
    files.shadow_trade_monitoring_status,
  );
  if (shadow.event_count !== 0) throw new Error("shadow events must be zero");
  const out =
    options.outputDir ?? path.join(root, "sol", "derived", "wallet_hud_v0_2");
  const sourceSnapshotHashes = Object.fromEntries(Object.entries(manifest.inputs).sort(([a], [b]) => a.localeCompare(b)).map(([name, spec]) => [name, spec.sha256]));
  const sourceSnapshotHash = hashObject(sourceSnapshotHashes);
  const previous = new Map<string, Record<string, unknown>>();
  const previousFile = path.join(out, "wallet_hud_state_v0_2.jsonl");
  const priorRows = fs.existsSync(previousFile)
    ? readJsonl<Record<string, unknown>>(previousFile)
    : [];
  const priorSceneScores = priorRows[0]?.scene_scores;
  const currentSchema =
    priorSceneScores &&
    typeof priorSceneScores === "object" &&
    Object.values(priorSceneScores as Record<string, unknown>)[0] &&
    typeof Object.values(priorSceneScores as Record<string, unknown>)[0] ===
      "object" &&
    "eligible_n" in
      (Object.values(priorSceneScores as Record<string, unknown>)[0] as Record<
        string,
        unknown
      >);
  const previousSource = currentSchema ? previousFile : files.wallet_hud_state;
  for (const state of readJsonl<Record<string, unknown>>(previousSource))
    if (typeof state.address === "string") previous.set(state.address, state);
  const at = options.evaluatedAt ?? HUD_V02_EVALUATED_AT;
  const computed = computeHudV02(candidates, masters, maps.map, previous, at, sourceSnapshotHash);
  fs.mkdirSync(out, { recursive: true });
  const stateFile = path.join(out, "wallet_hud_state_v0_2.jsonl");
  const historyFile = path.join(out, "wallet_hud_history_v0_2.jsonl");
  const cohortFile = path.join(out, "scene_peer_cohorts.json");
  const scoreFile = path.join(out, "scene_score_report.csv");
  const previewFile = path.join(out, "gmgn_name_preview_v0_2.csv");
  const fullFile = path.join(out, "gmgn_import_full_v0_2.json");
  const deltaFile = path.join(out, "gmgn_import_delta_v0_2.json");
  const reviewFile = path.join(out, "label_change_review_v0_2.csv");
  const methodFile = path.join(out, "wallet_hud_v0_2_methodology.md");
  const replayFile = path.join(out, "replay_manifest.json");
  const sourceHashesFile = path.join(out, "source_hashes.json");
  const states = computed.wallets.map((w) => w.state);
  writeJsonl(stateFile, states);
  appendJsonl(historyFile, computed.history);
  fs.writeFileSync(sourceHashesFile, JSON.stringify({ schema_version: "wallet-hud-v0.2-source-hashes", task_id: HUD_V02_TASK_ID, source_snapshot_hash: sourceSnapshotHash, input_hashes: sourceSnapshotHashes, contains_addresses: false }, null, 2) + "\n", "utf8");
  const eligibleN = Object.fromEntries(
    SCENE_IDS.map((scene) => [
      scene,
      computed.wallets.filter((w) => w.eligible.has(scene)).length,
    ]),
  ) as Record<SceneId, number>;
  const peerN = Object.fromEntries(
    SCENE_IDS.map((scene) => [
      scene,
      computed.wallets[0]?.scores[scene].peer_n ?? 0,
    ]),
  ) as Record<SceneId, number>;
  const primarySceneCount = Object.fromEntries(
    SCENE_IDS.map((scene) => [
      scene,
      computed.wallets.filter((w) => w.primary === scene).length,
    ]),
  ) as Record<SceneId, number>;
  const pxx = Object.fromEntries(
    SCENE_IDS.map((scene) => [
      scene,
      computed.wallets.filter((w) => w.scores[scene].scene_percentile !== null)
        .length,
    ]),
  ) as Record<SceneId, number>;
  const unrated = Object.fromEntries(
    SCENE_IDS.map((scene) => [
      scene,
      computed.wallets.filter(
        (w) =>
          w.eligible.has(scene) &&
          w.scores[scene].raw_score !== null &&
          w.scores[scene].scene_percentile === null,
      ).length,
    ]),
  ) as Record<SceneId, number>;
  fs.writeFileSync(
    cohortFile,
    JSON.stringify(
      {
        schema_version: "wallet-hud-v0.2",
        evaluated_at: at,
        wallet_count: states.length,
        scene_eligible_n: eligibleN,
        scene_peer_n: peerN,
        primary_scene_count: primarySceneCount,
        scene_percentile_count: pxx,
        scene_unrated_count: unrated,
        percentile_rule: "null_when_peer_n_lt_10",
        contains_addresses: false,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  const scoreRows: Array<Record<string, unknown>> = [];
  for (const wallet of computed.wallets)
    for (const scene of SCENE_IDS) {
      const s = wallet.scores[scene];
      scoreRows.push({
        fingerprint12: wallet.state.fingerprint12,
        primary_scene: wallet.state.primary_scene ?? "",
        scene_id: scene,
        raw_score: s.raw_score,
        scene_percentile: s.scene_percentile,
        eligible_n: s.eligible_n,
        peer_n: s.peer_n,
        sample_n: s.sample_n,
        sample_unit: s.sample_unit,
        score_source: s.score_source,
        evidence_tier: s.evidence_tier,
        confidence: s.confidence,
        reason_codes: s.reason_codes.join("|"),
      });
    }
  writeCsv(
    scoreFile,
    [
      "fingerprint12",
      "primary_scene",
      "scene_id",
      "raw_score",
      "scene_percentile",
      "eligible_n",
      "peer_n",
      "sample_n",
      "sample_unit",
      "score_source",
      "evidence_tier",
      "confidence",
      "reason_codes",
    ],
    scoreRows,
  );
  writeCsv(
    previewFile,
    [
      "fingerprint12",
      "old_name",
      "new_name",
      "changed",
      "change_reason",
      "primary_scene",
      "scene_percentile",
      "peer_n",
      "sample_n",
      "sample_unit",
      "score_source",
      "evidence_tier",
      "confidence",
    ],
    computed.previews,
  );
  const imports = states.map(importRow);
  const changed = computed.previews.filter((row) => row.changed === true);
  fs.writeFileSync(fullFile, JSON.stringify(imports, null, 2) + "\n", "utf8");
  fs.writeFileSync(
    deltaFile,
    JSON.stringify(
      changed.map((row) => {
        const state = states.find((item) => item.address === row.address);
        if (!state) throw new Error("state/preview mismatch");
        return importRow(state);
      }),
      null,
      2,
    ) + "\n",
    "utf8",
  );
  writeCsv(
    reviewFile,
    [
      "fingerprint12",
      "old_name",
      "new_name",
      "changed",
      "change_reason",
      "primary_scene",
      "scene_percentile",
      "peer_n",
      "sample_n",
      "sample_unit",
      "score_source",
      "evidence_tier",
      "confidence",
    ],
    computed.previews,
  );
  const result: HudRefreshResult = {
    outputDir: out,
    walletCount: states.length,
    sceneEligibleN: eligibleN,
    scenePeerN: peerN,
    scenePrimarySceneCount: primarySceneCount,
    scenePercentileCount: pxx,
    sceneUnratedCount: unrated,
    fullImportCount: imports.length,
    deltaImportCount: changed.length,
    changedWalletCount: changed.length,
    shadowEventCount: shadow.event_count,
    sourceSnapshotHashes,
    sourceSnapshotHash,
    outputHashes: {},
  };
  fs.writeFileSync(methodFile, methodology(result, at), "utf8");
  const outputFiles = [
    stateFile,
    historyFile,
    cohortFile,
    scoreFile,
    previewFile,
    fullFile,
    deltaFile,
    reviewFile,
    methodFile,
    sourceHashesFile,
  ];
  result.outputHashes = Object.fromEntries(
    outputFiles.map((file) => [path.basename(file), sha(file)]),
  );
  fs.writeFileSync(
    replayFile,
    JSON.stringify(
      {
        schema_version: "wallet-hud-v0.2-replay-manifest",
        task_id: HUD_V02_TASK_ID,
        evaluated_at: at,
        source_snapshot_hash: sourceSnapshotHash,
        input_hashes: sourceSnapshotHashes,
        history_append_only: true,
        output_hashes: result.outputHashes,
        counts: {
          candidate_addresses: candidates.length,
          wallet_master_rows_loaded: masters.length,
          wallet_states: states.length,
          chain_sampled_wallets: states.filter(
            (s) => s.evidence_tier === "CHAIN_SAMPLED",
          ).length,
          shadow_events: shadow.event_count,
        },
        deterministic: true,
        network_requests: 0,
        contains_addresses: false,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  return result;
}
