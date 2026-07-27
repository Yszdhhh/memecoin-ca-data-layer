import type { CreatorProfile } from "../../../domain/types.js";
import type {
  HeliusAddressTag,
  HeliusTokenMetadata,
  HeliusTransaction,
  HeliusWalletFacts,
  RpcMint,
  RpcTokenAccount,
  SolanaHeliusDataSource,
  SourceResponse,
  SourceWatermark,
} from "./helius-solana-adapter.js";
import { SourceDataUnavailableError } from "./helius-solana-adapter.js";

export interface FixtureHeliusPack {
  mint: string;
  rpcMint: RpcMint;
  metadata: HeliusTokenMetadata;
  tokenAccounts: RpcTokenAccount[];
  transactions: HeliusTransaction[];
  tags: HeliusAddressTag[];
  walletFacts: HeliusWalletFacts[];
  /** Optional first-SOL funding edges encoded as native transfers (already in transactions). */
}

function watermark(completeness: "complete" | "partial" = "complete"): SourceWatermark {
  return {
    source: "helius",
    observedAt: new Date("2026-07-26T00:00:00.000Z"),
    finalizedSlot: 600n,
    cursor: "fixture-helius-v1",
    completeness,
  };
}

function ok<T>(data: T, completeness: "complete" | "partial" = "complete"): SourceResponse<T> {
  return { data, watermark: watermark(completeness) };
}

/**
 * Offline Helius data source backed by a pinned pack. Never performs network I/O.
 * Live HTTP client is a separate, Owner-gated task.
 */
export class FixtureHeliusDataSource implements SolanaHeliusDataSource {
  constructor(private readonly pack: FixtureHeliusPack) {}

  static fromJson(json: unknown): FixtureHeliusDataSource {
    return new FixtureHeliusDataSource(json as FixtureHeliusPack);
  }

  async getMint(ca: string): Promise<SourceResponse<RpcMint | null>> {
    if (ca !== this.pack.mint) return ok(null);
    return ok(this.pack.rpcMint);
  }

  async getTokenAccounts(ca: string): Promise<SourceResponse<RpcTokenAccount[]>> {
    if (ca !== this.pack.mint) return ok([]);
    return ok(this.pack.tokenAccounts.map((row) => ({ ...row })));
  }

  async getTokenMetadata(ca: string): Promise<SourceResponse<HeliusTokenMetadata | null>> {
    if (ca !== this.pack.mint) return ok(null);
    return ok({ ...this.pack.metadata });
  }

  async getTransactions(_addresses: string[], since: Date): Promise<SourceResponse<HeliusTransaction[]>> {
    const rows = this.pack.transactions
      .filter((tx) => new Date(tx.blockTime) >= since)
      .map((tx) => structuredClone(tx));
    return ok(rows);
  }

  async getAddressTags(addresses: string[]): Promise<SourceResponse<HeliusAddressTag[]>> {
    const set = new Set(addresses);
    return ok(this.pack.tags.filter((tag) => set.has(tag.address)).map((tag) => ({ ...tag })));
  }

  async getWalletFacts(addresses: string[], _at: Date): Promise<SourceResponse<HeliusWalletFacts[]>> {
    const set = new Set(addresses);
    return ok(this.pack.walletFacts.filter((fact) => set.has(fact.address)).map((fact) => ({
      ...fact,
      tags: fact.tags.map((tag) => ({ ...tag })),
    })));
  }

  async getCreatorProfile(_creatorAddress: string, _at: Date): Promise<SourceResponse<CreatorProfile | null>> {
    return ok(null);
  }
}

export type HeliusSourceMethod =
  | "getMint"
  | "getTokenAccounts"
  | "getTokenMetadata"
  | "getTransactions"
  | "getAddressTags"
  | "getWalletFacts"
  | "getHolderSnapshot"
  | "getPumpCreatorEvidence"
  | "getDevHistory";

/**
 * Wraps any SolanaHeliusDataSource and fails closed for selected methods —
 * used by source-degradation harness style tests offline.
 */
export class DegradingHeliusDataSource implements SolanaHeliusDataSource {
  constructor(
    private readonly inner: SolanaHeliusDataSource,
    private readonly failed: ReadonlySet<HeliusSourceMethod>,
    private readonly mode: "timeout" | "malformed" | "partial" = "timeout",
  ) {}

  private async fail<T>(method: HeliusSourceMethod, run: () => Promise<SourceResponse<T>>): Promise<SourceResponse<T>> {
    if (!this.failed.has(method)) return run();
    if (this.mode === "timeout") {
      throw new SourceDataUnavailableError(`helius_${method}_timeout`);
    }
    if (this.mode === "malformed") {
      throw new SourceDataUnavailableError(`helius_${method}_malformed`);
    }
    const result = await run();
    return { data: result.data, watermark: { ...result.watermark, completeness: "partial" } };
  }

  getMint(ca: string) {
    return this.fail("getMint", () => this.inner.getMint(ca));
  }
  getTokenAccounts(ca: string) {
    return this.fail("getTokenAccounts", () => this.inner.getTokenAccounts(ca));
  }
  getTokenMetadata(ca: string) {
    return this.fail("getTokenMetadata", () => this.inner.getTokenMetadata(ca));
  }
  getTransactions(addresses: string[], since: Date) {
    return this.fail("getTransactions", () => this.inner.getTransactions(addresses, since));
  }
  getAddressTags(addresses: string[]) {
    return this.fail("getAddressTags", () => this.inner.getAddressTags(addresses));
  }
  getWalletFacts(addresses: string[], at: Date) {
    return this.fail("getWalletFacts", () => this.inner.getWalletFacts(addresses, at));
  }
}
