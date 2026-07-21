import type {
  AddressTag,
  CleanHolderRow,
  ClusterMember,
  HolderBalance,
  HolderConcentration,
  HolderExclusionReason,
} from "../types.js";

const EXCLUDED_ROLES = new Set([
  "bonding_curve",
  "official_proxy",
  "liquidity_pool",
  "burn",
] as const);

export interface RealHolderInput {
  holders: HolderBalance[];
  totalSupplyRaw: bigint;
  addressTags: AddressTag[];
  clusterMembers: ClusterMember[];
  minimumClusterConfidence?: number;
}

function ratioPct(value: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  // Integer scaling avoids bigint -> number overflow before division.
  return Number((value * 1_000_000n) / total) / 10_000;
}

/**
 * Computes concentration over eligible owners. On Solana callers must aggregate
 * token accounts by owner first (ownerAddress), otherwise one wallet may appear
 * multiple times.
 */
export function calculateRealHolderConcentration(input: RealHolderInput): HolderConcentration {
  const minClusterConfidence = input.minimumClusterConfidence ?? 0.85;
  const tagByAddress = new Map(
    input.addressTags
      .filter((tag) => tag.confidence >= 0.8 && EXCLUDED_ROLES.has(tag.role as never))
      .map((tag) => [tag.address, tag] as const),
  );
  const clusterByAddress = new Map(
    input.clusterMembers
      .filter((member) => member.confidence >= minClusterConfidence)
      .map((member) => [member.address, member] as const),
  );

  const aggregated = new Map<string, bigint>();
  for (const holder of input.holders) {
    const owner = holder.ownerAddress ?? holder.address;
    aggregated.set(owner, (aggregated.get(owner) ?? 0n) + holder.balanceRaw);
  }

  const rows: CleanHolderRow[] = [...aggregated.entries()]
    .map(([address, balanceRaw]) => {
      const tag = tagByAddress.get(address);
      const cluster = clusterByAddress.get(address);
      const exclusionReason = (tag?.role ?? (cluster ? "same_source_cluster" : undefined)) as
        | HolderExclusionReason
        | undefined;
      return {
        address,
        balanceRaw,
        supplyPct: ratioPct(balanceRaw, input.totalSupplyRaw),
        excluded: exclusionReason !== undefined,
        ...(exclusionReason ? { exclusionReason } : {}),
        ...(cluster ? { clusterId: cluster.clusterId } : {}),
      };
    })
    .sort((a, b) => (a.balanceRaw === b.balanceRaw ? 0 : a.balanceRaw > b.balanceRaw ? -1 : 1));

  const eligible = rows.filter((row) => !row.excluded);
  eligible.forEach((row, index) => {
    row.rank = index + 1;
  });

  const sumPct = (limit: number): number =>
    Number(eligible.slice(0, limit).reduce((sum, row) => sum + row.supplyPct, 0).toFixed(4));

  return {
    top10Pct: sumPct(10),
    top20Pct: sumPct(20),
    eligibleHolderCount: eligible.length,
    excludedPct: Number(
      rows
        .filter((row) => row.excluded)
        .reduce((sum, row) => sum + row.supplyPct, 0)
        .toFixed(4),
    ),
    rows,
  };
}
