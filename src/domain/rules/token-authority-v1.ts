/**
 * TOKEN-AUTHORITY-METADATA-001 — pure mapping of mint/authority observations.
 * Parse failure → null fields, never guess.
 */

export const TOKEN_AUTHORITY_RULE_VERSION = "token-authority-v1";

export interface TokenIdentityAndAuthorityV1 {
  ruleVersion: string;
  mint: string;
  decimals: number | null;
  supplyRaw: string | null;
  program: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  metadataMutable: boolean | null;
  creator: string | null;
  observedAt: string;
  source: string;
  tier: "A";
  verificationStatus: "confirmed" | "partial" | "unavailable";
  sourceWatermark: string | null;
  warnings: string[];
  fieldSources: Record<string, string>;
}

export function mapTokenAuthorityObservation(input: {
  mint: string;
  decimals?: unknown;
  supplyRaw?: unknown;
  program?: unknown;
  mintAuthority?: unknown;
  freezeAuthority?: unknown;
  metadataMutable?: unknown;
  creator?: unknown;
  observedAt?: string;
  source?: string;
  sourceWatermark?: string | null;
}): TokenIdentityAndAuthorityV1 {
  const warnings: string[] = [];
  const fieldSources: Record<string, string> = {};
  const source = input.source ?? "helius";

  const decimals =
    typeof input.decimals === "number" && Number.isInteger(input.decimals) && input.decimals >= 0 && input.decimals <= 18
      ? input.decimals
      : null;
  if (decimals === null && input.decimals !== undefined) warnings.push("decimals_parse_failed");
  if (decimals !== null) fieldSources.decimals = source;

  const supplyRaw = typeof input.supplyRaw === "string" && /^-?\d+$/.test(input.supplyRaw) ? input.supplyRaw : null;
  if (supplyRaw === null && input.supplyRaw !== undefined) warnings.push("supply_parse_failed");
  if (supplyRaw !== null) fieldSources.supplyRaw = source;

  const asAddr = (v: unknown, field: string): string | null => {
    if (v === null) {
      fieldSources[field] = source;
      return null;
    }
    if (typeof v === "string" && v.length >= 32 && v.length <= 64) {
      fieldSources[field] = source;
      return v;
    }
    if (v !== undefined) warnings.push(`${field}_parse_failed`);
    return null;
  };

  const program = asAddr(input.program, "program");
  const mintAuthority = asAddr(input.mintAuthority, "mintAuthority");
  const freezeAuthority = asAddr(input.freezeAuthority, "freezeAuthority");
  const creator = asAddr(input.creator, "creator");

  let metadataMutable: boolean | null = null;
  if (typeof input.metadataMutable === "boolean") {
    metadataMutable = input.metadataMutable;
    fieldSources.metadataMutable = source;
  } else if (input.metadataMutable !== undefined) {
    warnings.push("metadata_mutable_parse_failed");
  }

  const present = [decimals, supplyRaw, program].filter((x) => x !== null).length;
  const verificationStatus =
    present === 0 ? "unavailable" : present < 3 || warnings.length > 0 ? "partial" : "confirmed";

  return {
    ruleVersion: TOKEN_AUTHORITY_RULE_VERSION,
    mint: input.mint,
    decimals,
    supplyRaw,
    program,
    mintAuthority,
    freezeAuthority,
    metadataMutable,
    creator,
    observedAt: input.observedAt ?? new Date().toISOString(),
    source,
    tier: "A",
    verificationStatus,
    sourceWatermark: input.sourceWatermark ?? null,
    warnings,
    fieldSources,
  };
}
