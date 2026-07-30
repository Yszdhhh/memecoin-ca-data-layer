/**
 * WALLET-TOKEN-LEDGER-001 — pure event→ledger builder.
 * Uncertain buy/sell semantics stay unknown. Amounts conserved as raw strings.
 */

export const WALLET_TOKEN_LEDGER_RULE_VERSION = "wallet-token-ledger-v1";

export type WalletEventType = "swap" | "transfer_in" | "transfer_out" | "airdrop" | "lp" | "unknown";

export interface WalletTokenEventV1 {
  signature: string;
  slot: number;
  blockTime: string | null;
  tokenMint: string;
  eventType: WalletEventType;
  /** Signed delta on the wallet's token balance (raw integer string, may be negative). */
  amountDeltaRaw: string;
  quoteMint: string | null;
  quoteDeltaRaw: string | null;
  counterparty: string | null;
  completeness: "complete" | "partial";
}

export interface TokenLotV1 {
  lotId: string;
  tokenMint: string;
  openAmountRaw: string;
  costBasisKnown: boolean;
  openedAt: string | null;
  sourceEvent: string;
}

export interface WalletTokenLedgerV1 {
  ruleVersion: string;
  wallet: string;
  tokenMint: string;
  events: WalletTokenEventV1[];
  netDeltaRaw: string;
  openBalanceRaw: string;
  lots: TokenLotV1[];
  conservationOk: boolean;
  completeness: "complete" | "partial";
  warnings: string[];
}

function parseRaw(s: string): bigint {
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

export function buildWalletTokenLedger(input: {
  wallet: string;
  tokenMint: string;
  events: WalletTokenEventV1[];
  startingBalanceRaw?: string;
}): WalletTokenLedgerV1 {
  const warnings: string[] = [];
  const sorted = [...input.events].sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature));
  let balance = parseRaw(input.startingBalanceRaw ?? "0");
  let net = 0n;
  const lots: TokenLotV1[] = [];
  let completeness: "complete" | "partial" = "complete";
  let lotSeq = 0;

  for (const ev of sorted) {
    if (ev.tokenMint !== input.tokenMint) {
      warnings.push(`event_mint_mismatch:${ev.signature.slice(0, 8)}`);
      continue;
    }
    if (ev.completeness === "partial") completeness = "partial";
    if (ev.eventType === "unknown") warnings.push(`unknown_semantics:${ev.signature.slice(0, 8)}`);

    const delta = parseRaw(ev.amountDeltaRaw);
    balance += delta;
    net += delta;

    if (delta > 0n) {
      lotSeq += 1;
      lots.push({
        lotId: `lot-${lotSeq}`,
        tokenMint: input.tokenMint,
        openAmountRaw: delta.toString(),
        costBasisKnown: ev.eventType === "swap" && ev.quoteDeltaRaw !== null,
        openedAt: ev.blockTime,
        sourceEvent: ev.signature,
      });
    } else if (delta < 0n) {
      let need = -delta;
      for (const lot of lots) {
        if (need === 0n) break;
        const open = parseRaw(lot.openAmountRaw);
        if (open <= 0n) continue;
        const take = open < need ? open : need;
        lot.openAmountRaw = (open - take).toString();
        need -= take;
      }
      if (need > 0n) {
        warnings.push(`over_close:${ev.signature.slice(0, 8)}`);
        completeness = "partial";
      }
    }
  }

  const conservationOk = balance === parseRaw(input.startingBalanceRaw ?? "0") + net;
  if (!conservationOk) warnings.push("balance_conservation_failed");

  return {
    ruleVersion: WALLET_TOKEN_LEDGER_RULE_VERSION,
    wallet: input.wallet,
    tokenMint: input.tokenMint,
    events: sorted,
    netDeltaRaw: net.toString(),
    openBalanceRaw: balance.toString(),
    lots: lots.filter((l) => parseRaw(l.openAmountRaw) > 0n),
    conservationOk,
    completeness,
    warnings: [...new Set(warnings)],
  };
}

/**
 * WALLET-PNL-V1-001 — fail-closed performance. Missing price/cost → null PnL, never invent.
 */
export interface WalletPerformanceV1 {
  ruleVersion: string;
  wallet: string;
  tokenMint: string;
  realizedPnlQuote: number | null;
  unrealizedPnlQuote: number | null;
  costBasisKnown: boolean;
  sampleSize: number;
  completeness: "complete" | "partial" | "unavailable";
  warnings: string[];
  accountingNote: string;
}

export const WALLET_PNL_RULE_VERSION = "wallet-pnl-v1";

export function computeWalletPerformanceV1(input: {
  ledger: WalletTokenLedgerV1;
  /** Optional mark price in quote units per whole token; null → no unrealized. */
  markPrice?: number | null;
  decimals?: number;
}): WalletPerformanceV1 {
  const { ledger } = input;
  const warnings = [...ledger.warnings];
  const anyCost = ledger.lots.some((l) => l.costBasisKnown) || ledger.events.some((e) => e.eventType === "swap" && e.quoteDeltaRaw);

  if (!anyCost) {
    return {
      ruleVersion: WALLET_PNL_RULE_VERSION,
      wallet: ledger.wallet,
      tokenMint: ledger.tokenMint,
      realizedPnlQuote: null,
      unrealizedPnlQuote: null,
      costBasisKnown: false,
      sampleSize: ledger.events.length,
      completeness: "unavailable",
      warnings: [...warnings, "cost_basis_unknown"],
      accountingNote: "PnL withheld: cost basis unknown (transfer-in/airdrop without price).",
    };
  }

  // Realized: sum quote deltas on swaps only when both legs present.
  let realized: number | null = 0;
  let swaps = 0;
  for (const e of ledger.events) {
    if (e.eventType !== "swap" || e.quoteDeltaRaw === null) continue;
    const q = Number(e.quoteDeltaRaw);
    if (!Number.isFinite(q)) {
      realized = null;
      warnings.push("quote_parse_failed");
      break;
    }
    realized = (realized ?? 0) + q;
    swaps += 1;
  }

  let unrealized: number | null = null;
  const mark = input.markPrice;
  const decimals = input.decimals ?? 0;
  if (mark !== null && mark !== undefined && Number.isFinite(mark) && ledger.conservationOk) {
    const bal = Number(ledger.openBalanceRaw) / 10 ** decimals;
    if (Number.isFinite(bal)) unrealized = bal * mark;
    else warnings.push("balance_not_numeric_for_mark");
  } else {
    warnings.push("mark_price_missing_unrealized_null");
  }

  return {
    ruleVersion: WALLET_PNL_RULE_VERSION,
    wallet: ledger.wallet,
    tokenMint: ledger.tokenMint,
    realizedPnlQuote: realized,
    unrealizedPnlQuote: unrealized,
    costBasisKnown: true,
    sampleSize: swaps,
    completeness: ledger.completeness === "complete" && realized !== null ? "complete" : "partial",
    warnings: [...new Set(warnings)],
    accountingNote: "Realized from swap quote legs only; transfers do not invent entry price.",
  };
}
