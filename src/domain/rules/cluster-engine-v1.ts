/**
 * CLUSTER-ENGINE-V1-001 — weighted multi-edge clustering (pure).
 * Single weak edge never forms a confirmed group.
 */

export const CLUSTER_ENGINE_RULE_VERSION = "cluster-engine-v1";

export interface RelationEdge {
  from: string;
  to: string;
  edgeType: "common_funder" | "same_window" | "common_token" | "common_counterparty" | "funding";
  weight: number;
  source: string;
  evidenceRef: string;
}

export type ClusterStatus = "confirmed" | "suspected" | "coincidental";

export interface ClusterSummaryV1 {
  ruleVersion: string;
  clusterId: string;
  members: string[];
  status: ClusterStatus;
  score: number;
  edges: RelationEdge[];
  explanation: string;
}

export function formClustersV1(
  edges: readonly RelationEdge[],
  opts?: { confirmedThreshold?: number; suspectedThreshold?: number },
): ClusterSummaryV1[] {
  const confirmedThreshold = opts?.confirmedThreshold ?? 1.5;
  const suspectedThreshold = opts?.suspectedThreshold ?? 0.7;

  // Union-find on addresses that share any edge
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p !== x) {
      const r = find(p);
      parent.set(x, r);
      return r;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const e of edges) {
    if (e.weight <= 0) continue;
    parent.set(e.from, parent.get(e.from) ?? e.from);
    parent.set(e.to, parent.get(e.to) ?? e.to);
    union(e.from, e.to);
  }

  const groups = new Map<string, RelationEdge[]>();
  for (const e of edges) {
    if (!parent.has(e.from)) continue;
    const root = find(e.from);
    const list = groups.get(root) ?? [];
    list.push(e);
    groups.set(root, list);
  }

  const out: ClusterSummaryV1[] = [];
  let i = 0;
  for (const [, groupEdges] of groups) {
    i += 1;
    const members = [...new Set(groupEdges.flatMap((e) => [e.from, e.to]))].sort();
    const score = groupEdges.reduce((s, e) => s + e.weight, 0);
    const distinctTypes = new Set(groupEdges.map((e) => e.edgeType)).size;
    const strong = groupEdges.filter((e) => e.weight >= 0.5).length;

    let status: ClusterStatus = "coincidental";
    if (score >= confirmedThreshold && distinctTypes >= 2 && strong >= 2) status = "confirmed";
    else if (score >= suspectedThreshold && (distinctTypes >= 2 || strong >= 2)) status = "suspected";
    else status = "coincidental";

    // Single weak edge cannot be confirmed
    if (groupEdges.length === 1 && groupEdges[0]!.weight < 1) status = "coincidental";

    out.push({
      ruleVersion: CLUSTER_ENGINE_RULE_VERSION,
      clusterId: `cluster-${i}`,
      members,
      status,
      score: Math.round(score * 1000) / 1000,
      edges: groupEdges,
      explanation:
        status === "confirmed"
          ? `Multi-edge support (types=${distinctTypes}, strong=${strong}, score=${score.toFixed(2)}).`
          : status === "suspected"
            ? `Partial multi-signal support; not confirmed.`
            : `Insufficient or single weak edge — coincidental.`,
    });
  }
  return out;
}
