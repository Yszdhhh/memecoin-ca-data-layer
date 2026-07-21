import type { Pool } from "pg";
import type { AnalysisResult, Chain } from "../../domain/types.js";
import type { AnalysisRepository } from "../../application/ports.js";

const BIGINT_PREFIX = "__bigint__:";

export class PostgresAnalysisRepository implements AnalysisRepository {
  constructor(private readonly pool: Pool) {}

  async findLatest(chain: Chain, ca: string, maximumAgeSeconds: number): Promise<AnalysisResult | null> {
    const result = await this.pool.query<{ payload: unknown }>(
      `SELECT m.payload
         FROM analysis_materializations m
         JOIN tokens t ON t.id = m.token_id
        WHERE t.chain = $1
          AND lower(t.ca) = lower($2)
          AND m.data_as_of >= now() - ($3::text || ' seconds')::interval
        ORDER BY m.data_as_of DESC
        LIMIT 1`,
      [chain, ca, maximumAgeSeconds],
    );
    const payload = result.rows[0]?.payload;
    return payload ? decode(payload) : null;
  }

  async save(analysis: AnalysisResult): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tokenResult = await client.query<{ id: string }>(
        `INSERT INTO tokens (
           id, chain, ca, name, symbol, decimals, total_supply_raw, creator_address,
           launchpad, creation_tx, created_at, updated_at
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (chain, ca) DO UPDATE SET
           name = EXCLUDED.name,
           symbol = EXCLUDED.symbol,
           decimals = EXCLUDED.decimals,
           total_supply_raw = EXCLUDED.total_supply_raw,
           creator_address = COALESCE(EXCLUDED.creator_address, tokens.creator_address),
           launchpad = EXCLUDED.launchpad,
           creation_tx = COALESCE(EXCLUDED.creation_tx, tokens.creation_tx),
           created_at = COALESCE(EXCLUDED.created_at, tokens.created_at),
           updated_at = now()
         RETURNING id`,
        [
          analysis.token.id,
          analysis.token.chain,
          analysis.token.ca,
          analysis.token.name ?? null,
          analysis.token.symbol ?? null,
          analysis.token.decimals,
          analysis.token.totalSupplyRaw.toString(),
          analysis.token.creatorAddress ?? null,
          analysis.token.launchpad,
          analysis.token.creationTx ?? null,
          analysis.token.createdAt ?? null,
        ],
      );
      const tokenId = tokenResult.rows[0]!.id;
      await client.query(
        `INSERT INTO analysis_materializations (token_id, payload, data_as_of)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (token_id, data_as_of) DO UPDATE SET payload = EXCLUDED.payload`,
        [tokenId, JSON.stringify(encode(analysis)), analysis.dataAsOf],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function encode(value: unknown): unknown {
  if (typeof value === "bigint") return `${BIGINT_PREFIX}${value.toString()}`;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  }
  return value;
}

function decode(payload: unknown): AnalysisResult {
  const revive = (value: unknown): unknown => {
    if (typeof value === "string" && value.startsWith(BIGINT_PREFIX)) return BigInt(value.slice(BIGINT_PREFIX.length));
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value);
    if (Array.isArray(value)) return value.map(revive);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]));
    }
    return value;
  };
  return revive(payload) as AnalysisResult;
}
