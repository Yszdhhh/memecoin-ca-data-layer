import type { Pool } from "pg";
import type { Chain } from "../../domain/types.js";
import type {
  AddressLibrary,
  LibraryObservationRecord,
  SedimentOrigin,
  SedimentVerification,
  WalletLibraryRecord,
  WalletTokenEdgeRecord,
} from "../../application/sedimentation/address-library.js";

type WalletRow = {
  chain: Chain;
  address: string;
  origin: SedimentOrigin;
  verification_status: SedimentVerification;
  funding_source: string | null;
  funding_source_confidence: string | number | null;
  alpha_score: string | number | null;
  alpha_score_tier: WalletLibraryRecord["alphaScoreTier"] | null;
  alpha_score_status: WalletLibraryRecord["alphaScoreStatus"] | null;
  labels: string[];
  data_completeness: string | number;
  updated_at: Date | string;
};

/** Offline-tested adapter; selecting a Pool does not open a database connection. */
export class PostgresAddressLibrary implements AddressLibrary {
  constructor(private readonly pool: Pool) {}

  async upsertWallet(record: WalletLibraryRecord): Promise<void> {
    assertSolana(record.chain);
    assertTrusted(record.origin, record.verificationStatus, "wallet conclusion");
    await this.pool.query(
      `INSERT INTO wallets (
         chain, address, origin, verification_status, funding_source,
         funding_source_confidence, alpha_score, alpha_score_tier,
         alpha_score_status, labels, data_completeness, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
       ON CONFLICT (chain, address) DO UPDATE SET
         origin = EXCLUDED.origin,
         verification_status = EXCLUDED.verification_status,
         funding_source = EXCLUDED.funding_source,
         funding_source_confidence = EXCLUDED.funding_source_confidence,
         alpha_score = EXCLUDED.alpha_score,
         alpha_score_tier = EXCLUDED.alpha_score_tier,
         alpha_score_status = EXCLUDED.alpha_score_status,
         labels = EXCLUDED.labels,
         data_completeness = EXCLUDED.data_completeness,
         updated_at = EXCLUDED.updated_at
       WHERE NOT (
         wallets.verification_status = 'verified'
         AND EXCLUDED.verification_status = 'unverified'
       )`,
      [
        record.chain,
        record.address,
        record.origin,
        record.verificationStatus,
        record.fundingSource ?? null,
        record.fundingSourceConfidence ?? null,
        record.alphaScore ?? null,
        record.alphaScoreTier ?? null,
        record.alphaScoreStatus ?? null,
        JSON.stringify(record.labels),
        record.dataCompleteness,
        record.updatedAt,
      ],
    );
  }

  async upsertWalletTokenEdge(record: WalletTokenEdgeRecord): Promise<void> {
    assertSolana(record.chain);
    assertTrusted(record.origin, record.verificationStatus, "wallet_token_edge");
    await this.pool.query(
      `INSERT INTO wallet_token_edges (
         chain, wallet_address, token_id, gross_bought_raw, gross_sold_raw,
         current_balance_raw, realized_pnl_usd, pnl_source, origin,
         verification_status, confidence, evidence, calculated_at
       ) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
       ON CONFLICT (chain, wallet_address, token_id, pnl_source) DO UPDATE SET
         gross_bought_raw = EXCLUDED.gross_bought_raw,
         gross_sold_raw = EXCLUDED.gross_sold_raw,
         current_balance_raw = EXCLUDED.current_balance_raw,
         realized_pnl_usd = EXCLUDED.realized_pnl_usd,
         origin = EXCLUDED.origin,
         verification_status = EXCLUDED.verification_status,
         confidence = EXCLUDED.confidence,
         evidence = EXCLUDED.evidence,
         calculated_at = EXCLUDED.calculated_at
       WHERE NOT (
         wallet_token_edges.verification_status = 'verified'
         AND EXCLUDED.verification_status = 'unverified'
       )`,
      [
        record.chain,
        record.walletAddress,
        record.tokenId,
        record.grossBoughtRaw,
        record.grossSoldRaw,
        record.currentBalanceRaw ?? null,
        record.realizedPnlUsd ?? null,
        record.pnlSource,
        record.origin,
        record.verificationStatus,
        record.confidence ?? null,
        JSON.stringify(record.evidence),
        record.calculatedAt,
      ],
    );
  }

  async appendObservation(record: LibraryObservationRecord): Promise<{ accepted: boolean; reason?: string }> {
    assertSolana(record.chain);
    if (record.origin === "borrowed" && record.verificationStatus === "verified") {
      return { accepted: false, reason: "invalid_verified_borrowed" };
    }
    const result = await this.pool.query(
      `INSERT INTO observations (
         chain, subject_kind, subject_ref, snapshot_kind, source, origin,
         verification_status, trust_class, parser_version, parser_input_kind,
         observation_fingerprint, confidence, completeness, snapshot, warnings,
         captured_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16)
       ON CONFLICT (source, observation_fingerprint) DO NOTHING
       RETURNING id`,
      [
        record.chain,
        record.subjectKind,
        record.subjectRef,
        record.snapshotKind,
        record.source,
        record.origin,
        record.verificationStatus,
        record.trustClass,
        record.parserVersion,
        record.parserInputKind,
        record.observationFingerprint,
        record.confidence,
        record.completeness,
        JSON.stringify(record.snapshot),
        JSON.stringify(record.warnings),
        record.capturedAt,
      ],
    );
    return result.rowCount === 0 ? { accepted: false, reason: "duplicate_fingerprint" } : { accepted: true };
  }

  async getWallet(chain: Chain, address: string): Promise<WalletLibraryRecord | null> {
    assertSolana(chain);
    const result = await this.pool.query<WalletRow>(
      `SELECT chain, address, origin, verification_status, funding_source,
              funding_source_confidence, alpha_score, alpha_score_tier,
              alpha_score_status, labels, data_completeness, updated_at
         FROM wallets
        WHERE chain = $1 AND address = $2`,
      [chain, address],
    );
    return result.rows[0] ? toWallet(result.rows[0]) : null;
  }

  async listWalletsForToken(chain: Chain, tokenId: string): Promise<WalletLibraryRecord[]> {
    assertSolana(chain);
    const result = await this.pool.query<WalletRow>(
      `SELECT DISTINCT w.chain, w.address, w.origin, w.verification_status,
              w.funding_source, w.funding_source_confidence, w.alpha_score,
              w.alpha_score_tier, w.alpha_score_status, w.labels,
              w.data_completeness, w.updated_at
         FROM wallets w
         JOIN wallet_token_edges e
           ON e.chain = w.chain AND e.wallet_address = w.address
        WHERE e.chain = $1 AND e.token_id = $2::uuid
        ORDER BY w.address`,
      [chain, tokenId],
    );
    return result.rows.map(toWallet);
  }

  async lookupByAddresses(chain: Chain, addresses: string[]): Promise<WalletLibraryRecord[]> {
    assertSolana(chain);
    if (addresses.length === 0) return [];
    const result = await this.pool.query<WalletRow>(
      `SELECT chain, address, origin, verification_status, funding_source,
              funding_source_confidence, alpha_score, alpha_score_tier,
              alpha_score_status, labels, data_completeness, updated_at
         FROM wallets
        WHERE chain = $1 AND address = ANY($2::text[])
        ORDER BY address`,
      [chain, addresses],
    );
    return result.rows.map(toWallet);
  }
}

function assertSolana(chain: Chain): void {
  if (chain !== "solana") throw new Error("address library offline stage is solana-only");
}

function assertTrusted(origin: SedimentOrigin, verificationStatus: SedimentVerification, subject: string): void {
  if (origin === "borrowed" && verificationStatus === "verified") {
    throw new Error(`borrowed ${subject} cannot be verified without first-hand origin`);
  }
}

function toWallet(row: WalletRow): WalletLibraryRecord {
  return {
    chain: row.chain,
    address: row.address,
    origin: row.origin,
    verificationStatus: row.verification_status,
    ...(row.funding_source ? { fundingSource: row.funding_source } : {}),
    ...(row.funding_source_confidence !== null
      ? { fundingSourceConfidence: Number(row.funding_source_confidence) }
      : {}),
    ...(row.alpha_score !== null ? { alphaScore: Number(row.alpha_score) } : {}),
    ...(row.alpha_score_tier ? { alphaScoreTier: row.alpha_score_tier } : {}),
    ...(row.alpha_score_status ? { alphaScoreStatus: row.alpha_score_status } : {}),
    labels: [...row.labels],
    dataCompleteness: Number(row.data_completeness),
    updatedAt: new Date(row.updated_at),
  };
}