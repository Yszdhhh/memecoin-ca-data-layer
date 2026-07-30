/**
 * EARLY-BUYER-SNIPER-001 — fixed-list cohort from ordered first buys.
 * Transfer vs sell not force-classified when ambiguous.
 */

export const EARLY_BUYER_RULE_VERSION = "early-buyer-cohort-v1";

export interface EarlyBuyEvent {
  buyer: string;
  signature: string;
  slot: number;
  blockTime: string | null;
  amountRaw: string;
  /** When false, disposition unknown (not forced to sell). */
  dispositionKnown: boolean;
  stillHoldingRaw: string | null;
  transferredOutRaw: string | null;
  soldRaw: string | null;
}

export interface EarlyBuyerCohortV1 {
  ruleVersion: string;
  mint: string;
  listVersion: string;
  buyers: Array<{
    rank: number;
    buyer: string;
    firstBuySlot: number;
    firstBuyTime: string | null;
    firstBuyAmountRaw: string;
    stillHoldingRaw: string | null;
    transferredOutRaw: string | null;
    soldRaw: string | null;
    disposition: "holding" | "transferred" | "sold" | "mixed" | "unknown";
  }>;
  completeness: "complete" | "partial";
  warnings: string[];
}

export function buildEarlyBuyerCohort(input: {
  mint: string;
  events: EarlyBuyEvent[];
  topN?: number;
  listVersion?: string;
}): EarlyBuyerCohortV1 {
  const topN = input.topN ?? 50;
  const sorted = [...input.events].sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature));
  const seen = new Set<string>();
  const buyers: EarlyBuyerCohortV1["buyers"] = [];
  const warnings: string[] = [];
  let completeness: "complete" | "partial" = "complete";

  for (const e of sorted) {
    if (seen.has(e.buyer)) continue;
    seen.add(e.buyer);
    let disposition: EarlyBuyerCohortV1["buyers"][0]["disposition"] = "unknown";
    if (!e.dispositionKnown) {
      disposition = "unknown";
      warnings.push(`disposition_unknown:${e.buyer.slice(0, 6)}`);
      completeness = "partial";
    } else if (e.soldRaw && e.soldRaw !== "0" && e.transferredOutRaw && e.transferredOutRaw !== "0") {
      disposition = "mixed";
    } else if (e.soldRaw && e.soldRaw !== "0") disposition = "sold";
    else if (e.transferredOutRaw && e.transferredOutRaw !== "0") disposition = "transferred";
    else disposition = "holding";

    buyers.push({
      rank: buyers.length + 1,
      buyer: e.buyer,
      firstBuySlot: e.slot,
      firstBuyTime: e.blockTime,
      firstBuyAmountRaw: e.amountRaw,
      stillHoldingRaw: e.stillHoldingRaw,
      transferredOutRaw: e.transferredOutRaw,
      soldRaw: e.soldRaw,
      disposition,
    });
    if (buyers.length >= topN) break;
  }

  return {
    ruleVersion: EARLY_BUYER_RULE_VERSION,
    mint: input.mint,
    listVersion: input.listVersion ?? `top${topN}-v1`,
    buyers,
    completeness,
    warnings: [...new Set(warnings)].slice(0, 32),
  };
}
