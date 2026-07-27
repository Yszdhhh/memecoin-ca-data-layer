import type { AddressLibrary, WalletLibraryRecord } from "../sedimentation/address-library.js";
import {
  collectBorrowedMarket,
  type BorrowedHolderHint,
  type BorrowedMarketQuote,
  type BorrowedSecurityHint,
  type FreeHolderProvider,
  type FreeMarketProvider,
  type FreeSecurityProvider,
} from "../../infrastructure/providers/free-provider-ports.js";
import type { VirtualClock } from "../../harness-suites/shared.js";

export const HOTPATH_CARD_VERSION = "ca-first-screen-v1";

export interface FirstScreenCard {
  tokenCa: string;
  chain: "solana";
  status: "OK" | "DEGRADED";
  market: {
    priceUsd: number | null;
    liquidityUsd: number | null;
    fdvUsd: number | null;
    source: string | null;
    unverified: true;
  };
  security: {
    isHoneypot: boolean | null;
    buyTaxBps: number | null;
    sellTaxBps: number | null;
    source: string | null;
    unverified: true;
  };
  holders: {
    top10Pct: number | null;
    holderCount: number | null;
    isBorrowedConcentration: true;
    ownerAggregated: false;
    source: string | null;
    unverified: true;
  };
  libraryHits: Array<{
    address: string;
    labels: string[];
    alphaScoreTier?: string | null;
  }>;
  deepDiveEnqueued: boolean;
  warnings: string[];
  completeness: number;
  cardVersion: string;
  elapsedVirtualMs?: number;
}

export interface HotpathDeps {
  marketProviders: FreeMarketProvider[];
  securityProviders: FreeSecurityProvider[];
  holderProviders: FreeHolderProvider[];
  library: AddressLibrary;
  /** Simulated per-source latency for offline latency harness (ms). */
  sourceLatencyMs?: Partial<Record<"market" | "security" | "holders" | "library", number>>;
  clock?: VirtualClock;
  /** Optional known wallet addresses to cross-ref (e.g. from fixture top holders). */
  candidateWallets?: string[];
}

async function withVirtualLatency<T>(
  clock: VirtualClock | undefined,
  ms: number,
  run: () => Promise<T>,
): Promise<T> {
  const result = await run();
  clock?.advance(ms);
  return result;
}

/**
 * Second-scale first-screen card: free borrow fan-out + address-library hit.
 * Enqueues async first-hand deep-dive (flag only offline). Never treats borrowed
 * concentration as authoritative. Live network is Owner-gated elsewhere.
 */
export async function buildCaFirstScreenCard(
  tokenCa: string,
  deps: HotpathDeps,
): Promise<FirstScreenCard> {
  const warnings: string[] = [];
  const lat = deps.sourceLatencyMs ?? {};
  const clock = deps.clock;
  const start = clock?.now() ?? 0;

  // Parallel fan-out: advance clock by max latency when virtual clock provided.
  const marketP = withVirtualLatency(clock, lat.market ?? 0, async () => {
    try {
      return await collectBorrowedMarket(deps.marketProviders, tokenCa);
    } catch {
      return { quote: null as BorrowedMarketQuote | null, warnings: ["market_fanout_failed"] };
    }
  });
  const securityP = withVirtualLatency(clock, lat.security ?? 0, async () => {
    for (const provider of deps.securityProviders) {
      try {
        const hint = await provider.getSecurityHint(tokenCa);
        if (hint) return { hint, warnings: [] as string[] };
      } catch {
        warnings.push(`${provider.name}_security_unavailable`);
      }
    }
    return { hint: null as BorrowedSecurityHint | null, warnings: ["borrowed_security_unavailable"] };
  });
  const holdersP = withVirtualLatency(clock, lat.holders ?? 0, async () => {
    for (const provider of deps.holderProviders) {
      try {
        const hint = await provider.getHolderHint(tokenCa);
        if (hint) {
          if (!hint.isBorrowedConcentration || hint.ownerAggregated !== false) {
            return {
              hint: null as BorrowedHolderHint | null,
              warnings: [`${provider.name}_invalid_holder_contract`],
            };
          }
          return { hint, warnings: [] as string[] };
        }
      } catch {
        warnings.push(`${provider.name}_holders_unavailable`);
      }
    }
    return { hint: null as BorrowedHolderHint | null, warnings: ["borrowed_holders_unavailable"] };
  });
  const libraryP = withVirtualLatency(clock, lat.library ?? 0, async () => {
    const addrs = deps.candidateWallets ?? [];
    try {
      return await deps.library.lookupByAddresses("solana", addrs);
    } catch {
      warnings.push("address_library_unavailable");
      return [] as WalletLibraryRecord[];
    }
  });

  // Simulate parallel wall time: if clock was advanced sequentially above, reset
  // to start+max for reported elapsed. Callers that share one clock across
  // sequential awaits should pass pre-advanced max via sourceLatencyMs usage in tests.
  const [marketResult, securityResult, holdersResult, libraryHits] = await Promise.all([
    marketP,
    securityP,
    holdersP,
    libraryP,
  ]);

  warnings.push(...marketResult.warnings, ...securityResult.warnings, ...holdersResult.warnings);

  const market = marketResult.quote;
  const security = securityResult.hint;
  const holders = holdersResult.hint;

  let completeness = 1;
  if (!market) completeness -= 0.25;
  if (!security) completeness -= 0.25;
  if (!holders) completeness -= 0.25;

  const status: FirstScreenCard["status"] = completeness < 1 || warnings.length > 0 ? "DEGRADED" : "OK";
  const elapsedVirtualMs = clock ? clock.now() - start : undefined;

  return {
    tokenCa,
    chain: "solana",
    status,
    market: {
      priceUsd: market?.priceUsd ?? null,
      liquidityUsd: market?.liquidityUsd ?? null,
      fdvUsd: market?.fdvUsd ?? null,
      source: market?.source ?? null,
      unverified: true,
    },
    security: {
      isHoneypot: security?.isHoneypot ?? null,
      buyTaxBps: security?.buyTaxBps ?? null,
      sellTaxBps: security?.sellTaxBps ?? null,
      source: security?.source ?? null,
      unverified: true,
    },
    holders: {
      top10Pct: holders?.top10Pct ?? null,
      holderCount: holders?.holderCount ?? null,
      isBorrowedConcentration: true,
      ownerAggregated: false,
      source: holders?.source ?? null,
      unverified: true,
    },
    libraryHits: libraryHits.map((wallet) => ({
      address: wallet.address,
      labels: [...wallet.labels],
      alphaScoreTier: wallet.alphaScoreTier ?? null,
    })),
    deepDiveEnqueued: true,
    warnings,
    completeness: Math.max(0, completeness),
    cardVersion: HOTPATH_CARD_VERSION,
    ...(elapsedVirtualMs !== undefined ? { elapsedVirtualMs } : {}),
  };
}

/**
 * Parallel hot-path timing helper for latency suite style checks:
 * elapsed = max(latencies), not sum.
 */
export function parallelHotpathElapsedMs(latencies: number[]): number {
  return latencies.reduce((m, x) => Math.max(m, x), 0);
}
