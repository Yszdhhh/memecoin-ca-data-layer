import type { ObservationOrigin, VerificationStatus } from "../../domain/observation/observation-record.js";

/**
 * Free-tier borrow layer ports (offline fixtures now; live flip Owner-gated).
 * Every output is origin=borrowed, verification=unverified by construction.
 */

export interface BorrowedMarketQuote {
  source: "dexscreener" | "birdeye" | "jupiter" | "gmgn";
  tokenCa: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  pairAddress?: string;
  observedAt: Date;
  origin: ObservationOrigin;
  verificationStatus: VerificationStatus;
  warnings: string[];
}

export interface BorrowedSecurityHint {
  source: "gmgn" | "birdeye";
  tokenCa: string;
  isHoneypot: boolean | null;
  buyTaxBps: number | null;
  sellTaxBps: number | null;
  origin: ObservationOrigin;
  verificationStatus: VerificationStatus;
  warnings: string[];
}

export interface BorrowedHolderHint {
  source: "birdeye" | "gmgn";
  tokenCa: string;
  top10Pct: number | null;
  holderCount: number | null;
  /** Always true for borrow path — never authoritative concentration. */
  isBorrowedConcentration: true;
  ownerAggregated: false;
  origin: ObservationOrigin;
  verificationStatus: VerificationStatus;
  warnings: string[];
}

export interface FreeMarketProvider {
  readonly name: BorrowedMarketQuote["source"];
  getMarketQuote(tokenCa: string): Promise<BorrowedMarketQuote | null>;
}

export interface FreeSecurityProvider {
  readonly name: BorrowedSecurityHint["source"];
  getSecurityHint(tokenCa: string): Promise<BorrowedSecurityHint | null>;
}

export interface FreeHolderProvider {
  readonly name: BorrowedHolderHint["source"];
  getHolderHint(tokenCa: string): Promise<BorrowedHolderHint | null>;
}

export interface FreeProviderBundle {
  market: FreeMarketProvider[];
  security: FreeSecurityProvider[];
  holders: FreeHolderProvider[];
}

function borrowedBase(source: string, tokenCa: string) {
  return {
    tokenCa,
    origin: "borrowed" as const,
    verificationStatus: "unverified" as const,
    warnings: [`borrowed_unverified:${source}`],
  };
}

/** Fixture-backed free providers — no network. */
export class FixtureDexscreenerProvider implements FreeMarketProvider {
  readonly name = "dexscreener" as const;
  constructor(private readonly rows: Record<string, Omit<BorrowedMarketQuote, "source" | "origin" | "verificationStatus" | "warnings">>) {}
  async getMarketQuote(tokenCa: string): Promise<BorrowedMarketQuote | null> {
    const row = this.rows[tokenCa];
    if (!row) return null;
    return {
      source: this.name,
      ...borrowedBase(this.name, tokenCa),
      priceUsd: row.priceUsd,
      liquidityUsd: row.liquidityUsd,
      fdvUsd: row.fdvUsd,
      volume24hUsd: row.volume24hUsd,
      ...(row.pairAddress ? { pairAddress: row.pairAddress } : {}),
      observedAt: row.observedAt,
    };
  }
}

export class FixtureBirdeyeMarketProvider implements FreeMarketProvider {
  readonly name = "birdeye" as const;
  constructor(private readonly rows: Record<string, { priceUsd: number | null; liquidityUsd: number | null; fdvUsd: number | null; volume24hUsd: number | null; observedAt: Date }>) {}
  async getMarketQuote(tokenCa: string): Promise<BorrowedMarketQuote | null> {
    const row = this.rows[tokenCa];
    if (!row) return null;
    return { source: this.name, ...borrowedBase(this.name, tokenCa), ...row, warnings: borrowedBase(this.name, tokenCa).warnings };
  }
}

export class FixtureGmgnSecurityProvider implements FreeSecurityProvider {
  readonly name = "gmgn" as const;
  constructor(private readonly rows: Record<string, { isHoneypot: boolean | null; buyTaxBps: number | null; sellTaxBps: number | null }>) {}
  async getSecurityHint(tokenCa: string): Promise<BorrowedSecurityHint | null> {
    const row = this.rows[tokenCa];
    if (!row) return null;
    return { source: this.name, ...borrowedBase(this.name, tokenCa), ...row };
  }
}

export class FixtureBirdeyeHolderProvider implements FreeHolderProvider {
  readonly name = "birdeye" as const;
  constructor(private readonly rows: Record<string, { top10Pct: number | null; holderCount: number | null }>) {}
  async getHolderHint(tokenCa: string): Promise<BorrowedHolderHint | null> {
    const row = this.rows[tokenCa];
    if (!row) return null;
    return {
      source: this.name,
      ...borrowedBase(this.name, tokenCa),
      top10Pct: row.top10Pct,
      holderCount: row.holderCount,
      isBorrowedConcentration: true,
      ownerAggregated: false,
    };
  }
}

/** Fail-closed wrapper for degradation tests. */
export class FailingMarketProvider implements FreeMarketProvider {
  readonly name: FreeMarketProvider["name"];
  constructor(name: FreeMarketProvider["name"], private readonly error = "provider_timeout") {
    this.name = name;
  }
  async getMarketQuote(_tokenCa: string): Promise<BorrowedMarketQuote | null> {
    throw new Error(this.error);
  }
}

/**
 * Fan-out free market providers; first non-null wins; failures become warnings.
 * Never elevates verificationStatus.
 */
export async function collectBorrowedMarket(
  providers: FreeMarketProvider[],
  tokenCa: string,
): Promise<{ quote: BorrowedMarketQuote | null; warnings: string[] }> {
  const warnings: string[] = [];
  for (const provider of providers) {
    try {
      const quote = await provider.getMarketQuote(tokenCa);
      if (quote) {
        if (quote.origin !== "borrowed" || quote.verificationStatus !== "unverified") {
          warnings.push(`${provider.name}_invalid_borrow_contract`);
          continue;
        }
        return { quote, warnings };
      }
      warnings.push(`${provider.name}_empty`);
    } catch {
      warnings.push(`${provider.name}_unavailable`);
    }
  }
  return { quote: null, warnings: [...warnings, "borrowed_market_unavailable"] };
}
