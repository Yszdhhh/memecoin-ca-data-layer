/**
 * MARKET-CONTEXT-ADAPTER-001 — DexScreener Tier-B market snapshot.
 * Missing fields → null. Never overrides on-chain supply. source=DEXSCREENER/unverified.
 */

export const DEXSCREENER_MARKET_ADAPTER_VERSION = "dexscreener-market-v1";

export interface MarketSnapshotV1 {
  mint: string;
  priceUsd: number | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  pairAddress: string | null;
  pairAgeHours: number | null;
  links: string[];
  source: "DEXSCREENER";
  tier: "B";
  verificationStatus: "unverified";
  observedAt: string;
  completeness: number;
  warnings: string[];
  adapterVersion: string;
}

export interface DexScreenerPairLike {
  pairAddress?: string;
  priceUsd?: string | number;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  pairCreatedAt?: number;
  url?: string;
  info?: { imageUrl?: string; websites?: Array<{ url?: string }>; socials?: Array<{ url?: string }> };
  baseToken?: { address?: string; symbol?: string; name?: string };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Pure mapper from DexScreener pair JSON (fixture or live response). */
export function mapDexScreenerPairToMarketSnapshot(
  mint: string,
  pair: DexScreenerPairLike | null | undefined,
  observedAt = new Date().toISOString(),
): MarketSnapshotV1 {
  if (!pair) {
    return {
      mint,
      priceUsd: null,
      fdvUsd: null,
      marketCapUsd: null,
      liquidityUsd: null,
      volume24hUsd: null,
      pairAddress: null,
      pairAgeHours: null,
      links: [],
      source: "DEXSCREENER",
      tier: "B",
      verificationStatus: "unverified",
      observedAt,
      completeness: 0,
      warnings: ["dexscreener_pair_missing"],
      adapterVersion: DEXSCREENER_MARKET_ADAPTER_VERSION,
    };
  }

  const priceUsd = num(pair.priceUsd);
  const fdvUsd = num(pair.fdv);
  const marketCapUsd = num(pair.marketCap);
  const liquidityUsd = num(pair.liquidity?.usd);
  const volume24hUsd = num(pair.volume?.h24);
  const pairAddress = typeof pair.pairAddress === "string" ? pair.pairAddress : null;
  let pairAgeHours: number | null = null;
  if (typeof pair.pairCreatedAt === "number" && Number.isFinite(pair.pairCreatedAt)) {
    pairAgeHours = Math.max(0, (Date.parse(observedAt) - pair.pairCreatedAt) / 3_600_000);
  }

  const links: string[] = [];
  if (pair.url) links.push(pair.url);
  for (const w of pair.info?.websites ?? []) if (w.url) links.push(w.url);
  for (const s of pair.info?.socials ?? []) if (s.url) links.push(s.url);

  const fields = [priceUsd, fdvUsd, liquidityUsd, volume24hUsd, pairAddress];
  const present = fields.filter((f) => f !== null && f !== undefined).length;
  const warnings: string[] = [];
  if (priceUsd === null) warnings.push("price_null");
  if (liquidityUsd === null) warnings.push("liquidity_null");

  return {
    mint,
    priceUsd,
    fdvUsd,
    marketCapUsd,
    liquidityUsd,
    volume24hUsd,
    pairAddress,
    pairAgeHours,
    links: [...new Set(links)].slice(0, 16),
    source: "DEXSCREENER",
    tier: "B",
    verificationStatus: "unverified",
    observedAt,
    completeness: present / fields.length,
    warnings,
    adapterVersion: DEXSCREENER_MARKET_ADAPTER_VERSION,
  };
}

/**
 * Live fetch — only when explicitly enabled. Budget: caller must count ≤3 calls/CA.
 * Returns null pair on HTTP failure (degrade, do not throw secrets).
 */
export async function fetchDexScreenerPairs(
  mint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DexScreenerPairLike[]> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as { pairs?: DexScreenerPairLike[] };
  return Array.isArray(body.pairs) ? body.pairs : [];
}

export function selectBestPair(pairs: DexScreenerPairLike[]): DexScreenerPairLike | null {
  if (pairs.length === 0) return null;
  return [...pairs].sort((a, b) => (num(b.liquidity?.usd) ?? 0) - (num(a.liquidity?.usd) ?? 0))[0] ?? null;
}
