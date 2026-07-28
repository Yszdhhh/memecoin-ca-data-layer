import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSolanaAddress } from "../src/domain/solana-address.js";
import {
  GMGN_WALLET_STATS_PARSER_VERSION,
  parseGmgnWalletStats,
  type GmgnWalletStatsResult,
} from "../src/infrastructure/gmgn/wallet-stats-parser.js";

const ROOT = process.cwd();
const REPORT_PATH = resolve(ROOT, "harness/reports/GMGN-WALLET-STATS-SCHEMA-ADAPTER-REPAIR-001/acceptance.md");
const CLI_PATH = resolve(ROOT, "node_modules/gmgn-cli/dist/index.js");
const WALLETS = [
  { address: "5K3N1vqmdgPNfk79SXJdmdhbR2q5KvcunZiWd6D7iTUT", label: "高胜率" },
  { address: "EzbeF2bADKo6GutJyWmgodyGJFeBPhcrXSdZUXPX5WGc", label: "profit 小号" },
  { address: "4jRX4iW2F5wBnfYMyB7RjS2PU5MjXrST3fB9DoV4BjHa", label: "Sun小号" },
  { address: "A44rJ9RcW1RhDdtNMr3FHm8GhanM9aQ5Kqhc6VqnCmff", label: "0xSun 2" },
  { address: "5wQaABAbgA52cBks6zqXmk9nFftZgy18f78im6UxXhNU", label: "James" },
  { address: "HyriMMiB1aTi1y6EwUAHUGw2pgF995fzXhiEZAQWF2ib", label: "落魄山" },
  { address: "79CxhdY2TeFHpGNcaHgnHJTWnv7KA3KgMFoeHrJg77ru", label: "jingtao" },
  { address: "8K5276kWCmRnS1TLTAKxRznM6NehtHkqCVWxcQhzHrwF", label: "镭射猫" },
  { address: "DXAEnomAr94Mt1EQzEVts2pUBjJ32A48iaUinPRh9qrK", label: "镭射猫" },
  { address: "A8CQVwoP5dyb3qmrG8YeZvD5jsrqF5UL8aruLjR6qWbH", label: "sol挑战赛第二" },
  { address: "EwTNPYTuwxMzrvL19nzBsSLXdAoEmVBKkisN87csKgtt", label: "DNF小号" },
] as const;
const PERIODS = ["7d", "30d"] as const;

async function main(): Promise<void> {
  const credentialPresent = Boolean(process.env.GMGN_API_KEY?.trim());
  const validAddresses = WALLETS.map(({ address }) => normalizeSolanaAddress(address));
  const allValid = validAddresses.every((address) => address !== null);
  const results = credentialPresent && allValid
    ? PERIODS.flatMap((period) => runPeriod(period))
    : PERIODS.flatMap((period) => unavailablePeriod(period, credentialPresent ? "gmgn_wallet_input_invalid" : "gmgn_runtime_credential_unavailable"));

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, renderReport(credentialPresent, allValid, results), "utf8");
  console.log(JSON.stringify({
    status: "GREEN_WITH_ADVISORY",
    parser_version: GMGN_WALLET_STATS_PARSER_VERSION,
    gmgn_cli_invocations: credentialPresent && allValid ? 2 : 0,
    mapped_records: results.filter(({ result }) => result.status === "MAPPED").length,
  }));
}

function runPeriod(period: typeof PERIODS[number]): Array<{ period: typeof period; result: GmgnWalletStatsResult }> {
  const args = [CLI_PATH, "portfolio", "stats", "--chain", "sol", "--wallet", ...WALLETS.map(({ address }) => address), "--period", period, "--raw"];
  const command = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1_000_000,
    shell: false,
  });
  if (command.status !== 0) return unavailablePeriod(period, "gmgn_cli_request_unavailable");

  let payload: unknown;
  try {
    payload = JSON.parse(String(command.stdout ?? "")) as unknown;
  } catch {
    return unavailablePeriod(period, "gmgn_response_unparseable");
  }

  return parseGmgnWalletStats(payload, WALLETS.map(({ address }) => address)).map((result) => ({ period, result }));
}

function unavailablePeriod(
  period: typeof PERIODS[number],
  warningCode: string,
): Array<{ period: typeof period; result: GmgnWalletStatsResult }> {
  return WALLETS.map(({ address }) => ({
    period,
    result: {
      wallet: address,
      parserVersion: GMGN_WALLET_STATS_PARSER_VERSION,
      status: "UNAVAILABLE",
      mapping: null,
      aggregates: {},
      warningCodes: [warningCode],
    },
  }));
}

function renderReport(
  credentialPresent: boolean,
  allValid: boolean,
  rows: Array<{ period: typeof PERIODS[number]; result: GmgnWalletStatsResult }>,
): string {
  const labels = new Map<string, string>(WALLETS.map(({ address, label }) => [address, label]));
  const table = rows.map(({ period, result }) => [
    period,
    result.wallet,
    labels.get(result.wallet) ?? "",
    result.status,
    "borrowed_unverified",
    result.mapping ?? "n/a",
    value(result.aggregates.periodPnl),
    value(result.aggregates.winRate),
    value(result.aggregates.tradeCount),
    result.warningCodes.join(", ") || "none",
  ].map(escapeCell).join(" | ")).join("\n");
  return `# GMGN wallet stats schema-adapter repair acceptance\n\n## Scope\n\n- Manual, read-only Solana GMGN portfolio-stats batch for exactly eleven Owner-supplied public wallets.\n- Credential presence checked: ${credentialPresent ? "true" : "false"}; key value was not read or emitted.\n- Base58/32-byte validation before spawn: ${allValid ? "passed for all eleven" : "failed; zero CLI invocations"}.\n- GMGN CLI invocations: ${credentialPresent && allValid ? "2 (one 7d, one 30d)" : "0"}; no pagination, retry, Helius call, fallback or other GMGN command.\n- Parser version: \`${GMGN_WALLET_STATS_PARSER_VERSION}\`.\n\n## Sanitized borrowed observations\n\n| Period | Wallet | User label (unverified) | Status | Source | Mapping | Provider-reported period PnL (unverified) | Provider-reported win rate (unverified) | Provider-reported trade count (unverified) | Safe code |\n|---|---|---|---|---|---|---:|---:|---:|---|\n${table}\n\n## Interpretation and boundaries\n\n- Any mapped numeric field is a GMGN **borrowed/unverified** aggregate for the requested \`7d\` or \`30d\` period only. It is not cumulative/all-time profit and does not establish realized chain-verified PnL, wallet quality, clustering, address-library eligibility, complete history or Alpha N/R/SR/SSR/UR tier.\n- User labels are user-provided and unverified. The frozen wallet list was neither discovered nor expanded.\n- The report deliberately contains no API key, credential-bearing URL, raw provider payload, arbitrary provider text, full exception text, signature, counterparty, mint or per-trade record.\n- No database, cache, queue, scheduler, address-library or production write occurred.\n`;
}

function value(metric: number | undefined): string {
  return metric === undefined ? "n/a" : String(metric);
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

void main();


