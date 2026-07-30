import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeSolanaAddress } from "../../domain/solana-address.js";

export const GMGN_CLI_VERSION = "1.5.4";
export const DAILY_CANDIDATE_MIN = 5;
export const DAILY_CANDIDATE_MAX = 10;
export const DAILY_MIN_MARKET_CAP_USD = 1_000_000;
export const DAILY_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

export type GmgnDiscoveryWarning =
  | "gmgn_runtime_credential_unavailable"
  | "gmgn_cli_unavailable"
  | "gmgn_response_malformed";

export class GmgnDiscoveryError extends Error {
  constructor(public readonly code: GmgnDiscoveryWarning) {
    super(code);
    this.name = "GmgnDiscoveryError";
  }
}

export interface GmgnDailyCandidate {
  tokenCa: string;
  symbol: string | null;
  marketCapUsd: number;
  createdAt: string;
  holderCount: number | null;
  creatorAddress: string | null;
  top10HolderRate: number | null;
  devTeamHoldRate: number | null;
  insiderVolumeRate: number | null;
  bundlerVolumeRate: number | null;
  sniperCount: number | null;
  source: "gmgn";
  trust: "unverified_provider_claim";
}

export interface GmgnDailySelection {
  status: "READY" | "INSUFFICIENT";
  criteria: {
    chain: "sol";
    interval: "24h";
    maxAgeHours: 24;
    marketCapUsdExclusiveMin: 1_000_000;
    sort: "market_cap_desc";
    minimumCandidates: 5;
    maximumCandidates: 10;
  };
  candidates: GmgnDailyCandidate[];
  warnings: string[];
}

export interface GmgnCliRunner {
  run(args: readonly string[]): Promise<string>;
}

const GMGN_TRENDING_ARGS = [
  "market", "trending",
  "--chain", "sol",
  "--interval", "24h",
  "--limit", "100",
  "--order-by", "marketcap",
  "--direction", "desc",
  "--min-marketcap", String(DAILY_MIN_MARKET_CAP_USD),
  "--max-created", "24h",
  "--raw",
] as const;

export async function discoverGmgnDailyCandidates(
  now = new Date(),
  runner: GmgnCliRunner = runtimeGmgnCliRunner(),
): Promise<GmgnDailySelection> {
  assertValidDate(now);
  let stdout: string;
  try {
    stdout = await runner.run(GMGN_TRENDING_ARGS);
  } catch (error) {
    if (error instanceof GmgnDiscoveryError) throw error;
    throw new GmgnDiscoveryError("gmgn_cli_unavailable");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new GmgnDiscoveryError("gmgn_response_malformed");
  }
  return selectGmgnDailyCandidates(payload, now);
}

export function selectGmgnDailyCandidates(payload: unknown, now: Date): GmgnDailySelection {
  assertValidDate(now);
  const root = record(payload);
  const data = record(root.data);
  if (!Array.isArray(data.rank)) throw new GmgnDiscoveryError("gmgn_response_malformed");

  const unique = new Map<string, GmgnDailyCandidate>();
  for (const value of data.rank) {
    const candidate = parseCandidate(value, now);
    if (candidate !== null) {
      const existing = unique.get(candidate.tokenCa);
      if (existing === undefined || candidate.marketCapUsd > existing.marketCapUsd) unique.set(candidate.tokenCa, candidate);
    }
  }
  const candidates = [...unique.values()]
    .sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.tokenCa.localeCompare(b.tokenCa))
    .slice(0, DAILY_CANDIDATE_MAX);
  const status = candidates.length >= DAILY_CANDIDATE_MIN ? "READY" : "INSUFFICIENT";

  return {
    status,
    criteria: {
      chain: "sol",
      interval: "24h",
      maxAgeHours: 24,
      marketCapUsdExclusiveMin: DAILY_MIN_MARKET_CAP_USD,
      sort: "market_cap_desc",
      minimumCandidates: DAILY_CANDIDATE_MIN,
      maximumCandidates: DAILY_CANDIDATE_MAX,
    },
    candidates,
    warnings: status === "READY" ? [] : ["gmgn_candidate_count_below_5"],
  };
}

function parseCandidate(value: unknown, now: Date): GmgnDailyCandidate | null {
  const row = optionalRecord(value);
  if (row === null) return null;
  const tokenCa = typeof row.address === "string" ? normalizeSolanaAddress(row.address) : null;
  const marketCapUsd = finiteNumber(row.market_cap);
  const creationTimestamp = finiteNumber(row.creation_timestamp);
  if (tokenCa === null || marketCapUsd === null || marketCapUsd <= DAILY_MIN_MARKET_CAP_USD || creationTimestamp === null) {
    return null;
  }
  const createdAtMs = creationTimestamp * 1_000;
  if (!Number.isSafeInteger(createdAtMs) || createdAtMs > now.getTime() || now.getTime() - createdAtMs > DAILY_MAX_AGE_MS) {
    return null;
  }

  return {
    tokenCa,
    symbol: safeSymbol(row.symbol),
    marketCapUsd,
    createdAt: new Date(createdAtMs).toISOString(),
    holderCount: nonNegativeInteger(row.holder_count),
    creatorAddress: typeof row.creator === "string" ? normalizeSolanaAddress(row.creator) : null,
    top10HolderRate: ratio(row.top_10_holder_rate),
    devTeamHoldRate: ratio(row.dev_team_hold_rate),
    insiderVolumeRate: ratio(row.rat_trader_amount_rate),
    bundlerVolumeRate: ratio(row.bundler_rate),
    sniperCount: nonNegativeInteger(row.sniper_count),
    source: "gmgn",
    trust: "unverified_provider_claim",
  };
}

function runtimeGmgnCliRunner(): GmgnCliRunner {
  return {
    async run(args) {
      const apiKey = process.env.GMGN_API_KEY?.trim();
      if (!apiKey) throw new GmgnDiscoveryError("gmgn_runtime_credential_unavailable");
      let cliEntry: string;
      try {
        cliEntry = fileURLToPath(import.meta.resolve("gmgn-cli"));
      } catch {
        throw new GmgnDiscoveryError("gmgn_cli_unavailable");
      }
      return new Promise<string>((resolve, reject) => {
        execFile(process.execPath, [cliEntry, ...args], {
          cwd: process.cwd(),
          env: { ...process.env, GMGN_API_KEY: apiKey },
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
          windowsHide: true,
        }, (error, stdout) => {
          if (error) reject(new GmgnDiscoveryError("gmgn_cli_unavailable"));
          else resolve(stdout);
        });
      });
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  const result = optionalRecord(value);
  if (result === null) throw new GmgnDiscoveryError("gmgn_response_malformed");
  return result;
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function ratio(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 && number <= 1 ? number : null;
}

function safeSymbol(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_$.-]{1,20}$/.test(value) ? value : null;
}

function assertValidDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error("now must be a valid date");
}
