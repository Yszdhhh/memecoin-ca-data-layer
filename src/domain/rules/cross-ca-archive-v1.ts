/**
 * CROSS-CA-ARCHIVE-001 — local reverse indexes only (no online per-wallet fetch).
 */

export const CROSS_CA_ARCHIVE_RULE_VERSION = "cross-ca-archive-v1";

export interface WalletTokenHit {
  wallet: string;
  mint: string;
  role: "holder" | "early_buyer" | "dev" | "funder" | "unknown";
  observedAt: string;
  result?: "profit" | "loss" | "unknown";
  evidenceRef: string;
}

export interface CrossTokenMatchV1 {
  ruleVersion: string;
  query: { kind: "wallet" | "mint" | "cluster"; id: string };
  walletToTokens: Array<{ wallet: string; mints: string[]; roles: string[] }>;
  tokenToWallets: Array<{ mint: string; wallets: string[]; roles: string[] }>;
  repeatWinners: Array<{ wallet: string; profitHits: number; mints: string[] }>;
  riskClusters: Array<{ clusterId: string; members: string[]; mintHits: string[] }>;
  warnings: string[];
}

export class CrossCaArchive {
  private readonly edges: WalletTokenHit[] = [];
  private readonly clusters = new Map<string, string[]>();

  addHit(hit: WalletTokenHit): void {
    this.edges.push(hit);
  }

  addCluster(clusterId: string, members: string[]): void {
    this.clusters.set(clusterId, [...new Set(members)].sort());
  }

  queryByWallet(wallet: string): CrossTokenMatchV1 {
    const hits = this.edges.filter((e) => e.wallet === wallet);
    return this.pack({ kind: "wallet", id: wallet }, hits);
  }

  queryByMint(mint: string): CrossTokenMatchV1 {
    const hits = this.edges.filter((e) => e.mint === mint);
    return this.pack({ kind: "mint", id: mint }, hits);
  }

  queryByCluster(clusterId: string): CrossTokenMatchV1 {
    const members = new Set(this.clusters.get(clusterId) ?? []);
    const hits = this.edges.filter((e) => members.has(e.wallet));
    return this.pack({ kind: "cluster", id: clusterId }, hits);
  }

  private pack(
    query: CrossTokenMatchV1["query"],
    hits: WalletTokenHit[],
  ): CrossTokenMatchV1 {
    const byWallet = new Map<string, { mints: Set<string>; roles: Set<string> }>();
    const byMint = new Map<string, { wallets: Set<string>; roles: Set<string> }>();
    for (const h of hits) {
      const w = byWallet.get(h.wallet) ?? { mints: new Set(), roles: new Set() };
      w.mints.add(h.mint);
      w.roles.add(h.role);
      byWallet.set(h.wallet, w);
      const m = byMint.get(h.mint) ?? { wallets: new Set(), roles: new Set() };
      m.wallets.add(h.wallet);
      m.roles.add(h.role);
      byMint.set(h.mint, m);
    }

    const profitByWallet = new Map<string, { n: number; mints: Set<string> }>();
    for (const h of this.edges) {
      if (h.result !== "profit") continue;
      const r = profitByWallet.get(h.wallet) ?? { n: 0, mints: new Set() };
      r.n += 1;
      r.mints.add(h.mint);
      profitByWallet.set(h.wallet, r);
    }

    const riskClusters: CrossTokenMatchV1["riskClusters"] = [];
    for (const [clusterId, members] of this.clusters) {
      const mintHits = [
        ...new Set(this.edges.filter((e) => members.includes(e.wallet)).map((e) => e.mint)),
      ].sort();
      if (mintHits.length > 0) riskClusters.push({ clusterId, members, mintHits });
    }

    return {
      ruleVersion: CROSS_CA_ARCHIVE_RULE_VERSION,
      query,
      walletToTokens: [...byWallet.entries()].map(([wallet, v]) => ({
        wallet,
        mints: [...v.mints].sort(),
        roles: [...v.roles].sort(),
      })),
      tokenToWallets: [...byMint.entries()].map(([mint, v]) => ({
        mint,
        wallets: [...v.wallets].sort(),
        roles: [...v.roles].sort(),
      })),
      repeatWinners: [...profitByWallet.entries()]
        .filter(([, v]) => v.n >= 2)
        .map(([wallet, v]) => ({ wallet, profitHits: v.n, mints: [...v.mints].sort() }))
        .sort((a, b) => b.profitHits - a.profitHits),
      riskClusters,
      warnings: hits.length === 0 ? ["no_local_hits"] : [],
    };
  }
}
