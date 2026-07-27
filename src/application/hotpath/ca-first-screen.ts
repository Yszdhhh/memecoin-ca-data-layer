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
export const HOTPATH_P95_BUDGET_MS = 2_000;

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
    verificationStatus: "unverified" | "verified";
  }>;
  deepDiveEnqueued: boolean;
  warnings: string[];
  completeness: number;
  cardVersion: string;
  elapsedVirtualMs?: number;
}

export interface DeepDiveQueue {
  enqueue(tokenCa: string): Promise<void>;
}

export interface HotpathDeps {
  marketProviders: FreeMarketProvider[];
  securityProviders: FreeSecurityProvider[];
  holderProviders: FreeHolderProvider[];
  library: AddressLibrary;
  deepDiveQueue: DeepDiveQueue;
  /** Simulated per-source latency for offline latency harness (ms). */
  sourceLatencyMs?: Partial<Record<"market" | "security" | "holders" | "library" | "enqueue", number>>;
  clock?: VirtualClock;
  /** Optional known wallet addresses to cross-ref (e.g. from fixture top holders). */
  candidateWallets?: string[];
}

interface SourceResult<T> {
  value: T | null;
  warnings: string[];
  available: boolean;
}

async function collectSecurity(
  providers: FreeSecurityProvider[],
  tokenCa: string,
): Promise<SourceResult<BorrowedSecurityHint>> {
  const warnings: string[] = [];
  for (const provider of providers) {
    try {
      const hint = await provider.getSecurityHint(tokenCa);
      if (!hint) {
        warnings.push(`${provider.name}_empty`);
        continue;
      }
      if (hint.origin !== "borrowed" || hint.verificationStatus !== "unverified") {
        warnings.push(`${provider.name}_invalid_security_contract`);
        continue;
      }
      return { value: hint, warnings, available: true };
    } catch {
      warnings.push(`${provider.name}_security_unavailable`);
    }
  }
  return { value: null, warnings: [...warnings, "borrowed_security_unavailable"], available: false };
}

async function collectHolders(
  providers: FreeHolderProvider[],
  tokenCa: string,
): Promise<SourceResult<BorrowedHolderHint>> {
  const warnings: string[] = [];
  for (const provider of providers) {
    try {
      const hint = await provider.getHolderHint(tokenCa);
      if (!hint) {
        warnings.push(`${provider.name}_empty`);
        continue;
      }
      if (
        hint.origin !== "borrowed"
        || hint.verificationStatus !== "unverified"
        || !hint.isBorrowedConcentration
        || hint.ownerAggregated !== false
      ) {
        warnings.push(`${provider.name}_invalid_holder_contract`);
        continue;
      }
      return { value: hint, warnings, available: true };
    } catch {
      warnings.push(`${provider.name}_holders_unavailable`);
    }
  }
  return { value: null, warnings: [...warnings, "borrowed_holders_unavailable"], available: false };
}

/**
 * Second-scale first-screen card: free borrow fan-out + address-library hit.
 * The deep-dive enqueue is explicit and fail-closed. Borrowed concentration is
 * never treated as authoritative. Live network remains Owner-gated elsewhere.
 */
export async function buildCaFirstScreenCard(
  tokenCa: string,
  deps: HotpathDeps,
): Promise<FirstScreenCard> {
  const lat = deps.sourceLatencyMs ?? {};
  const clock = deps.clock;
  const start = clock?.now() ?? 0;

  const marketP = collectBorrowedMarket(deps.marketProviders, tokenCa)
    .then((result) => ({
      value: result.quote,
      warnings: result.warnings,
      available: result.quote !== null,
    } satisfies SourceResult<BorrowedMarketQuote>))
    .catch(() => ({ value: null, warnings: ["market_fanout_failed"], available: false }));
  const securityP = collectSecurity(deps.securityProviders, tokenCa);
  const holdersP = collectHolders(deps.holderProviders, tokenCa);
  const libraryP = deps.library.lookupByAddresses("solana", deps.candidateWallets ?? [])
    .then((value) => ({ value, warnings: [] as string[], available: true }))
    .catch(() => ({ value: [] as WalletLibraryRecord[], warnings: ["address_library_unavailable"], available: false }));
  const enqueueP = deps.deepDiveQueue.enqueue(tokenCa)
    .then(() => ({ enqueued: true, warnings: [] as string[] }))
    .catch(() => ({ enqueued: false, warnings: ["deep_dive_enqueue_failed"] }));

  const [marketResult, securityResult, holdersResult, libraryResult, enqueueResult] = await Promise.all([
    marketP,
    securityP,
    holdersP,
    libraryP,
    enqueueP,
  ]);

  const elapsed = parallelHotpathElapsedMs([
    lat.market ?? 0,
    lat.security ?? 0,
    lat.holders ?? 0,
    lat.library ?? 0,
    lat.enqueue ?? 0,
  ]);
  clock?.advance(elapsed);

  const warnings = [
    ...marketResult.warnings,
    ...securityResult.warnings,
    ...holdersResult.warnings,
    ...libraryResult.warnings,
    ...enqueueResult.warnings,
    ...(elapsed >= HOTPATH_P95_BUDGET_MS ? ["hotpath_latency_budget_exceeded"] : []),
  ];
  const availableCount = [
    marketResult.available,
    securityResult.available,
    holdersResult.available,
    libraryResult.available,
  ].filter(Boolean).length;
  const completeness = availableCount / 4;
  const status: FirstScreenCard["status"] = completeness < 1 || warnings.length > 0 || !enqueueResult.enqueued
    ? "DEGRADED"
    : "OK";

  const market = marketResult.value;
  const security = securityResult.value;
  const holders = holdersResult.value;

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
    libraryHits: (libraryResult.value ?? []).map((wallet) => ({
      address: wallet.address,
      labels: [...wallet.labels],
      alphaScoreTier: wallet.alphaScoreTier ?? null,
      verificationStatus: wallet.verificationStatus,
    })),
    deepDiveEnqueued: enqueueResult.enqueued,
    warnings,
    completeness,
    cardVersion: HOTPATH_CARD_VERSION,
    ...(clock ? { elapsedVirtualMs: clock.now() - start } : {}),
  };
}

/** Parallel fan-out budget: elapsed is max(latencies), not their sum. */
export function parallelHotpathElapsedMs(latencies: number[]): number {
  return latencies.reduce((max, value) => Math.max(max, value), 0);
}
