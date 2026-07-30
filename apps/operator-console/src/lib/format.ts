import type { ExclusionCoverage } from "../data/types";

export function shortMint(mint: string, n = 4): string {
  if (mint.length <= n * 2 + 1) return mint;
  return `${mint.slice(0, n)}…${mint.slice(-n)}`;
}

export function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) {
    return "暂不可确认";
  }
  return `${(ratio * 100).toFixed(2)}%`;
}

export function accountingLabel(eligible: boolean, completeness?: string): string {
  if (eligible) return "CONFIRMED";
  if (completeness === "partial") return "PARTIAL";
  return "UNVERIFIED";
}

export function concentrationLabel(eligible: boolean): string {
  return eligible ? "CONFIRMED" : "UNVERIFIED";
}

export function exclusionLabel(coverage: ExclusionCoverage): string {
  return coverage.toUpperCase();
}

export function trustClass(label: string): string {
  const u = label.toUpperCase();
  if (u === "CONFIRMED" || u === "COMPLETE" || u === "OK" || u === "COMPLETED") return "trust-ok";
  if (u === "PARTIAL" || u === "RUNNING" || u === "QUEUED") return "trust-warn";
  if (u === "FAILED" || u === "BLOCKED" || u === "REJECTED") return "trust-bad";
  return "trust-muted";
}
