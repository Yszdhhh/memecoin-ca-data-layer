/**
 * CREATOR-DEV-FACTS-001 — pure fact assembly from evidence rows.
 * Creator/Dev relation requires signature/account evidence; no invention.
 */

export const CREATOR_DEV_RULE_VERSION = "creator-dev-facts-v1";

export interface DevEvidenceRow {
  kind: "create" | "transfer" | "sell" | "authority" | "allocation";
  signature: string | null;
  account: string | null;
  slot: number | null;
  blockTime: string | null;
  amountRaw: string | null;
  counterparty: string | null;
  note?: string;
}

export interface DevBehaviorV1 {
  ruleVersion: string;
  mint: string;
  creator: string | null;
  devAddresses: string[];
  initialAllocationRaw: string | null;
  currentHoldingsRaw: string | null;
  transferredOutRaw: string | null;
  soldRaw: string | null;
  events: DevEvidenceRow[];
  completeness: "complete" | "partial" | "unavailable";
  verificationStatus: "confirmed" | "partial" | "unverified" | "unavailable";
  warnings: string[];
  evidenceRefs: string[];
}

export function assembleDevBehaviorV1(input: {
  mint: string;
  creatorCandidate: string | null;
  creatorEvidence: { signature: string | null; account: string | null } | null;
  events: DevEvidenceRow[];
  currentHoldingsRaw?: string | null;
}): DevBehaviorV1 {
  const warnings: string[] = [];
  const evidenceRefs: string[] = [];

  let creator: string | null = null;
  if (input.creatorCandidate && input.creatorEvidence?.signature) {
    creator = input.creatorCandidate;
    evidenceRefs.push(`create_sig:${input.creatorEvidence.signature}`);
    if (input.creatorEvidence.account) evidenceRefs.push(`create_account:${input.creatorEvidence.account}`);
  } else if (input.creatorCandidate && !input.creatorEvidence?.signature) {
    warnings.push("creator_without_signature_evidence");
    creator = null;
  } else {
    warnings.push("creator_unavailable");
  }

  const devSet = new Set<string>();
  if (creator) devSet.add(creator);

  let initial: string | null = null;
  let transferred = 0n;
  let sold = 0n;
  let completeness: DevBehaviorV1["completeness"] = input.events.length === 0 ? "unavailable" : "complete";

  for (const e of input.events) {
    if (!e.signature && !e.account) {
      warnings.push(`event_missing_evidence:${e.kind}`);
      completeness = "partial";
      continue;
    }
    if (e.signature) evidenceRefs.push(`sig:${e.signature}`);
    if (e.account) evidenceRefs.push(`acct:${e.account}`);
    if (e.counterparty) devSet.add(e.counterparty);
    if (e.kind === "allocation" && e.amountRaw) initial = e.amountRaw;
    if (e.kind === "transfer" && e.amountRaw) {
      try {
        transferred += BigInt(e.amountRaw);
      } catch {
        warnings.push("transfer_amount_parse_failed");
        completeness = "partial";
      }
    }
    if (e.kind === "sell" && e.amountRaw) {
      try {
        sold += BigInt(e.amountRaw);
      } catch {
        warnings.push("sell_amount_parse_failed");
        completeness = "partial";
      }
    }
  }

  const verificationStatus: DevBehaviorV1["verificationStatus"] =
    completeness === "unavailable"
      ? "unavailable"
      : creator && completeness === "complete"
        ? "confirmed"
        : completeness === "partial" || !creator
          ? "partial"
          : "unverified";

  return {
    ruleVersion: CREATOR_DEV_RULE_VERSION,
    mint: input.mint,
    creator,
    devAddresses: [...devSet].sort(),
    initialAllocationRaw: initial,
    currentHoldingsRaw: input.currentHoldingsRaw ?? null,
    transferredOutRaw: transferred === 0n && !input.events.some((e) => e.kind === "transfer") ? null : transferred.toString(),
    soldRaw: sold === 0n && !input.events.some((e) => e.kind === "sell") ? null : sold.toString(),
    events: input.events,
    completeness,
    verificationStatus,
    warnings: [...new Set(warnings)],
    evidenceRefs: [...new Set(evidenceRefs)].slice(0, 64),
  };
}
