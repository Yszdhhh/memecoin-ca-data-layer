import { createHash } from "node:crypto";
import type { ClusterMember, FirstBuy, FundingEdge } from "../types.js";

export interface FundingClusterOptions {
  fundingToBuyWindowSeconds: number;
  siblingBuyWindowSeconds: number;
  newWalletWindowSeconds: number;
  minimumMembers: number;
}

const DEFAULTS: FundingClusterOptions = {
  fundingToBuyWindowSeconds: 10 * 60,
  siblingBuyWindowSeconds: 2 * 60,
  newWalletWindowSeconds: 24 * 60 * 60,
  minimumMembers: 2,
};

/** High-precision/simple detector: same funder -> recently created recipients -> synchronized first buy. */
export function detectFundingClusters(
  fundingEdges: FundingEdge[],
  firstBuys: FirstBuy[],
  options: Partial<FundingClusterOptions> = {},
): ClusterMember[] {
  const cfg = { ...DEFAULTS, ...options };
  const buyByAddress = new Map(firstBuys.map((buy) => [buy.buyer, buy] as const));
  const candidatesByFunder = new Map<string, Array<{ edge: FundingEdge; buy: FirstBuy }>>();

  for (const edge of fundingEdges) {
    const buy = buyByAddress.get(edge.recipient);
    if (!buy || edge.fundedAt > buy.boughtAt) continue;
    const fundingLag = (buy.boughtAt.getTime() - edge.fundedAt.getTime()) / 1000;
    if (fundingLag > cfg.fundingToBuyWindowSeconds) continue;
    if (edge.recipientFirstSeenAt) {
      const walletAge = (buy.boughtAt.getTime() - edge.recipientFirstSeenAt.getTime()) / 1000;
      if (walletAge < 0 || walletAge > cfg.newWalletWindowSeconds) continue;
    }
    const group = candidatesByFunder.get(edge.funder) ?? [];
    group.push({ edge, buy });
    candidatesByFunder.set(edge.funder, group);
  }

  const result: ClusterMember[] = [];
  for (const [funder, candidates] of candidatesByFunder) {
    candidates.sort((a, b) => a.buy.boughtAt.getTime() - b.buy.boughtAt.getTime());
    for (let start = 0; start < candidates.length; start += 1) {
      const first = candidates[start];
      if (!first) continue;
      const cohort = candidates.filter((candidate) => {
        const delta = Math.abs(candidate.buy.boughtAt.getTime() - first.buy.boughtAt.getTime()) / 1000;
        return delta <= cfg.siblingBuyWindowSeconds;
      });
      if (cohort.length < cfg.minimumMembers) continue;
      const members = [...new Set(cohort.map((item) => item.edge.recipient))].sort();
      if (members.length < cfg.minimumMembers) continue;
      const clusterId = createHash("sha256").update(`${funder}:${members.join(",")}`).digest("hex").slice(0, 24);
      const confidence = Math.min(0.99, 0.75 + members.length * 0.05);
      for (const item of cohort) {
        if (result.some((member) => member.address === item.edge.recipient)) continue;
        result.push({
          address: item.edge.recipient,
          clusterId,
          confidence,
          evidence: {
            funder,
            fundedAt: item.edge.fundedAt.toISOString(),
            firstBuyAt: item.buy.boughtAt.toISOString(),
            siblingCount: members.length,
          },
        });
      }
    }
  }
  return result;
}
