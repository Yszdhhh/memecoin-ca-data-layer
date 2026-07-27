import type { AlphaScoreResult, AlphaTier, Chain } from "../../domain/types.js";
import type { WalletForensicSignals } from "../../domain/rules/forensic-signals.js";
import type { ParserInputKind } from "../../domain/observation/observation-record.js";

export type SedimentOrigin = "first_hand" | "borrowed";
export type SedimentVerification = "unverified" | "verified";

export interface WalletLibraryRecord {
  chain: Chain;
  address: string;
  origin: SedimentOrigin;
  verificationStatus: SedimentVerification;
  fundingSource?: string;
  fundingSourceConfidence?: number;
  alphaScore?: number | null;
  alphaScoreTier?: AlphaTier | null;
  alphaScoreStatus?: AlphaScoreResult["status"];
  labels: string[];
  dataCompleteness: number;
  updatedAt: Date;
}

export interface WalletTokenEdgeRecord {
  chain: Chain;
  walletAddress: string;
  tokenId: string;
  grossBoughtRaw: string;
  grossSoldRaw: string;
  currentBalanceRaw?: string;
  realizedPnlUsd?: number | null;
  pnlSource: "self_computed" | "birdeye" | "gmgn" | "moralis" | "solanatracker" | "bitquery";
  origin: SedimentOrigin;
  verificationStatus: SedimentVerification;
  confidence?: number;
  evidence: Record<string, unknown>;
  calculatedAt: Date;
}

export interface LibraryObservationRecord {
  id: string;
  chain: Chain;
  subjectKind: "token" | "wallet";
  subjectRef: string;
  snapshotKind: string;
  source: string;
  origin: SedimentOrigin;
  verificationStatus: SedimentVerification;
  trustClass: "A" | "B" | "C" | "D" | "E";
  parserVersion: string;
  parserInputKind: ParserInputKind;
  observationFingerprint: string;
  confidence: number;
  completeness: number;
  snapshot: Record<string, unknown>;
  warnings: string[];
  capturedAt: Date;
}

export interface SedimentAnalysisInput {
  chain: Chain;
  tokenId: string;
  tokenCa: string;
  analyzedAt: Date;
  /** Wallet-level conclusions after analysis / detectors / alpha. */
  wallets: Array<{
    address: string;
    fundingSource?: string;
    fundingSourceConfidence?: number;
    alpha?: AlphaScoreResult | null;
    forensics?: WalletForensicSignals | null;
    grossBoughtRaw?: string;
    grossSoldRaw?: string;
    currentBalanceRaw?: string;
    realizedPnlUsd?: number | null;
    pnlSource?: WalletTokenEdgeRecord["pnlSource"];
    origin: SedimentOrigin;
    verificationStatus: SedimentVerification;
  }>;
  observations?: LibraryObservationRecord[];
}

export interface AddressLibrary {
  upsertWallet(record: WalletLibraryRecord): Promise<void>;
  upsertWalletTokenEdge(record: WalletTokenEdgeRecord): Promise<void>;
  appendObservation(record: LibraryObservationRecord): Promise<{ accepted: boolean; reason?: string }>;
  getWallet(chain: Chain, address: string): Promise<WalletLibraryRecord | null>;
  listWalletsForToken(chain: Chain, tokenId: string): Promise<WalletLibraryRecord[]>;
  lookupByAddresses(chain: Chain, addresses: string[]): Promise<WalletLibraryRecord[]>;
}

/** In-memory library for offline fixture acceptance (Postgres adapter later). */
export class InMemoryAddressLibrary implements AddressLibrary {
  private readonly wallets = new Map<string, WalletLibraryRecord>();
  private readonly edges = new Map<string, WalletTokenEdgeRecord>();
  private readonly observations = new Map<string, LibraryObservationRecord>();

  private walletKey(chain: Chain, address: string): string {
    return `${chain}:${address}`;
  }

  private edgeKey(chain: Chain, wallet: string, tokenId: string, pnlSource: string): string {
    return `${chain}:${wallet}:${tokenId}:${pnlSource}`;
  }

  async upsertWallet(record: WalletLibraryRecord): Promise<void> {
    if (record.chain !== "solana") {
      throw new Error("address library offline stage is solana-only");
    }
    if (record.origin === "borrowed" && record.verificationStatus === "verified") {
      throw new Error("borrowed wallet conclusion cannot be verified without first-hand origin");
    }
    const key = this.walletKey(record.chain, record.address);
    const existing = this.wallets.get(key);
    if (existing?.verificationStatus === "verified" && record.verificationStatus === "unverified") {
      return;
    }
    this.wallets.set(key, {
      ...record,
      labels: [...record.labels],
      updatedAt: new Date(record.updatedAt),
    });
  }

  async upsertWalletTokenEdge(record: WalletTokenEdgeRecord): Promise<void> {
    // Borrowed edges stay unverified; only first_hand may be verified.
    if (record.origin === "borrowed" && record.verificationStatus === "verified") {
      throw new Error("borrowed wallet_token_edge cannot be verified without first-hand origin");
    }
    this.edges.set(
      this.edgeKey(record.chain, record.walletAddress, record.tokenId, record.pnlSource),
      { ...record, evidence: { ...record.evidence }, calculatedAt: new Date(record.calculatedAt) },
    );
  }

  async appendObservation(record: LibraryObservationRecord): Promise<{ accepted: boolean; reason?: string }> {
    const key = `${record.source}:${record.observationFingerprint}`;
    if (this.observations.has(key)) return { accepted: false, reason: "duplicate_fingerprint" };
    if (record.origin === "borrowed" && record.verificationStatus === "verified") {
      return { accepted: false, reason: "invalid_verified_borrowed" };
    }
    this.observations.set(key, {
      ...record,
      warnings: [...record.warnings],
      snapshot: { ...record.snapshot },
      capturedAt: new Date(record.capturedAt),
    });
    return { accepted: true };
  }

  async getWallet(chain: Chain, address: string): Promise<WalletLibraryRecord | null> {
    return this.wallets.get(this.walletKey(chain, address)) ?? null;
  }

  async listWalletsForToken(chain: Chain, tokenId: string): Promise<WalletLibraryRecord[]> {
    const addrs = [...this.edges.values()]
      .filter((edge) => edge.chain === chain && edge.tokenId === tokenId)
      .map((edge) => edge.walletAddress);
    const out: WalletLibraryRecord[] = [];
    for (const address of new Set(addrs)) {
      const wallet = await this.getWallet(chain, address);
      if (wallet) out.push(wallet);
    }
    return out;
  }

  async lookupByAddresses(chain: Chain, addresses: string[]): Promise<WalletLibraryRecord[]> {
    const out: WalletLibraryRecord[] = [];
    for (const address of addresses) {
      const wallet = await this.getWallet(chain, address);
      if (wallet) out.push(wallet);
    }
    return out;
  }
}

/**
 * Sediment wallet-level conclusions after analysis.
 * Never promotes borrowed→verified here; confirmation is a separate first-hand path.
 */
export async function sedimentAnalysis(
  library: AddressLibrary,
  input: SedimentAnalysisInput,
): Promise<{ walletsWritten: number; edgesWritten: number; observationsAccepted: number }> {
  if (input.chain !== "solana") throw new Error("sedimentation offline stage is solana-only");
  let walletsWritten = 0;
  let edgesWritten = 0;
  let observationsAccepted = 0;

  for (const wallet of input.wallets) {
    const labels: string[] = [];
    if (wallet.forensics?.clusterSignal.riskTier === "cluster"
      || wallet.forensics?.clusterSignal.riskTier === "insider") {
      labels.push(wallet.forensics.clusterSignal.insiderEscalated ? "insider_cluster" : "cluster");
    } else if (wallet.forensics?.clusterSignal.riskTier === "suspected") {
      labels.push("cluster_suspected");
    }
    if (wallet.forensics?.sniperSignal.isSniper) labels.push("sniper");
    else if (wallet.forensics?.sniperSignal.isBotPattern) labels.push("bot_like");
    if (wallet.forensics?.independenceSignal.certified) labels.push("independent_smart_money");
    if (wallet.alpha?.tier) labels.push(`alpha_${wallet.alpha.tier}`);

    await library.upsertWallet({
      chain: input.chain,
      address: wallet.address,
      origin: wallet.origin,
      verificationStatus: wallet.verificationStatus,
      ...(wallet.fundingSource ? { fundingSource: wallet.fundingSource } : {}),
      ...(wallet.fundingSourceConfidence !== undefined
        ? { fundingSourceConfidence: wallet.fundingSourceConfidence }
        : {}),
      alphaScore: wallet.alpha?.alphaScore ?? null,
      alphaScoreTier: wallet.alpha?.tier ?? null,
      ...(wallet.alpha?.status ? { alphaScoreStatus: wallet.alpha.status } : {}),
      labels,
      dataCompleteness: wallet.alpha?.completeness ?? 0,
      updatedAt: input.analyzedAt,
    });
    walletsWritten += 1;

    await library.upsertWalletTokenEdge({
      chain: input.chain,
      walletAddress: wallet.address,
      tokenId: input.tokenId,
      grossBoughtRaw: wallet.grossBoughtRaw ?? "0",
      grossSoldRaw: wallet.grossSoldRaw ?? "0",
      ...(wallet.currentBalanceRaw !== undefined ? { currentBalanceRaw: wallet.currentBalanceRaw } : {}),
      realizedPnlUsd: wallet.realizedPnlUsd ?? null,
      pnlSource: wallet.pnlSource ?? (wallet.origin === "first_hand" ? "self_computed" : "gmgn"),
      origin: wallet.origin,
      verificationStatus: wallet.verificationStatus,
      ...(wallet.alpha?.confidence !== undefined ? { confidence: wallet.alpha.confidence } : {}),
      evidence: {
        tokenCa: input.tokenCa,
        ...(wallet.forensics
          ? {
            forensics: {
              clusterC: wallet.forensics.clusterSignal.C,
              sniperS: wallet.forensics.sniperSignal.S,
              independenceI: wallet.forensics.independenceSignal.I,
            },
          }
          : {}),
      },
      calculatedAt: input.analyzedAt,
    });
    edgesWritten += 1;
  }

  for (const observation of input.observations ?? []) {
    const result = await library.appendObservation(observation);
    if (result.accepted) observationsAccepted += 1;
  }

  return { walletsWritten, edgesWritten, observationsAccepted };
}
