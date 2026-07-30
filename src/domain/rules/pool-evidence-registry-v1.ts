/**
 * POOL-EVIDENCE-REGISTRY-001 — program/pool evidence for exclusion.
 * Pair addresses are clues only; owner/program hard evidence required for confirmed exclusion.
 */

export const POOL_EVIDENCE_RULE_VERSION = "pool-evidence-registry-v1";

/** Well-known Solana program owners (public constants, not secrets). */
export const KNOWN_POOL_PROGRAMS: Readonly<Record<string, { name: string; role: "amm" | "bonding_curve" | "lp" }>> = {
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": { name: "pump_fun", role: "bonding_curve" },
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA": { name: "pump_swap", role: "amm" },
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": { name: "raydium_amm_v4", role: "amm" },
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": { name: "raydium_clmm", role: "amm" },
  "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG": { name: "meteora_cpamm", role: "amm" },
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": { name: "meteora_dlmm", role: "amm" },
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": { name: "orca_whirlpool", role: "amm" },
};

export interface PoolCandidate {
  address: string;
  /** On-chain owner of the account (program id), if known. */
  programOwner: string | null;
  /** Soft clue from DexScreener etc. */
  clueSource?: string | null;
}

export interface PoolEvidenceItem {
  address: string;
  programOwner: string | null;
  programName: string | null;
  role: "lp" | "bonding_curve" | "amm" | "unknown";
  exclusionStrength: "hard" | "soft" | "none";
  evidenceRefs: string[];
}

export interface PoolEvidenceV1 {
  ruleVersion: string;
  pools: PoolEvidenceItem[];
  coverage: "complete" | "partial" | "unavailable";
  hardExclusionOwners: string[];
  warnings: string[];
}

export function evaluatePoolEvidence(candidates: readonly PoolCandidate[]): PoolEvidenceV1 {
  if (candidates.length === 0) {
    return {
      ruleVersion: POOL_EVIDENCE_RULE_VERSION,
      pools: [],
      coverage: "unavailable",
      hardExclusionOwners: [],
      warnings: ["no_pool_candidates"],
    };
  }

  const pools: PoolEvidenceItem[] = [];
  const hard: string[] = [];
  const warnings: string[] = [];
  let anyHard = false;
  let anyUnknown = false;

  for (const c of candidates) {
    const known = c.programOwner ? KNOWN_POOL_PROGRAMS[c.programOwner] : undefined;
    if (c.programOwner && known) {
      anyHard = true;
      hard.push(c.address);
      pools.push({
        address: c.address,
        programOwner: c.programOwner,
        programName: known.name,
        role: known.role === "bonding_curve" ? "bonding_curve" : "amm",
        exclusionStrength: "hard",
        evidenceRefs: [`account_owner:${c.programOwner}`, `program:${known.name}`],
      });
    } else if (c.clueSource && !c.programOwner) {
      anyUnknown = true;
      warnings.push(`soft_clue_only:${c.address.slice(0, 8)}`);
      pools.push({
        address: c.address,
        programOwner: null,
        programName: null,
        role: "unknown",
        exclusionStrength: "soft",
        evidenceRefs: [`clue:${c.clueSource}`],
      });
    } else if (c.programOwner) {
      anyUnknown = true;
      warnings.push(`unknown_program:${c.programOwner.slice(0, 8)}`);
      pools.push({
        address: c.address,
        programOwner: c.programOwner,
        programName: null,
        role: "unknown",
        exclusionStrength: "none",
        evidenceRefs: [`account_owner:${c.programOwner}`],
      });
    } else {
      anyUnknown = true;
      pools.push({
        address: c.address,
        programOwner: null,
        programName: null,
        role: "unknown",
        exclusionStrength: "none",
        evidenceRefs: [],
      });
    }
  }

  let coverage: PoolEvidenceV1["coverage"] = "partial";
  if (anyHard && !anyUnknown) coverage = "complete";
  else if (!anyHard && anyUnknown) coverage = "partial";
  else if (!anyHard && !anyUnknown) coverage = "unavailable";

  if (!anyHard) {
    warnings.push("no_hard_program_evidence_do_not_confirmed_exclude");
  }

  return {
    ruleVersion: POOL_EVIDENCE_RULE_VERSION,
    pools,
    coverage,
    hardExclusionOwners: hard,
    warnings: [...new Set(warnings)],
  };
}
