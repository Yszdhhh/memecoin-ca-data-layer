import { calculateDevBehavior, type DevBehaviorInput } from "../../../domain/rules/dev-behavior.js";
import type { DevBehavior, NormalizedTrade, TokenTransfer } from "../../../domain/types.js";
import { PUMP_IDL_COMMIT, PUMP_IDL_SHA256, PUMP_PROGRAM_ID } from "../pump/pump-instruction-decoder.js";

export interface PumpCreatorEvidence {
  source: "pump_create.creator";
  creatorAddress: string;
  signature: string;
  slot: bigint;
  blockTime: Date;
  programId: string;
  sourceCommit: string;
  idlSha256: string;
}

export interface DevHistoryWatermark {
  oldestObservedSlot: bigint;
  newestObservedSlot: bigint;
  finalizedSlot: bigint;
  cursor: string;
  hasGaps: boolean;
  observedAt: Date;
}

export interface SolanaDevHistoryInput {
  tokenId: string;
  totalSupplyRaw: bigint;
  creatorEvidence: PumpCreatorEvidence | null;
  directCurrentBalanceRaw: bigint;
  relatedCurrentBalances: ReadonlyMap<string, bigint>;
  relatedAddresses: readonly string[];
  trades: readonly NormalizedTrade[];
  transfers: readonly TokenTransfer[];
  creationSlot: bigint;
  watermark: DevHistoryWatermark;
  calculatedAt?: Date;
}

export interface DevHistoryCoverage {
  creationSlot: bigint;
  oldestObservedSlot: bigint;
  newestObservedSlot: bigint;
  finalizedSlot: bigint;
  cursor: string;
  hasGaps: boolean;
  observedAt: Date;
  completeFromCreation: boolean;
}

export interface SolanaDevHistoryResult {
  creatorEvidence: PumpCreatorEvidence | null;
  coverage: DevHistoryCoverage;
  dev: DevBehavior | null;
  warnings: string[];
}

const CREATOR_SOURCE = "pump_create.creator";

export class SolanaDevHistoryService {
  analyze(input: SolanaDevHistoryInput): SolanaDevHistoryResult {
    const coverage = assessCoverage(input.creationSlot, input.watermark);
    const warnings: string[] = [];
    const creatorEvidence = hasTrustedCreatorEvidence(input.creatorEvidence, input.creationSlot)
      ? input.creatorEvidence
      : null;

    if (creatorEvidence === null) {
      warnings.push("CREATOR_EVIDENCE_MISSING_OR_UNTRUSTED");
    }
    if (!coverage.completeFromCreation) {
      warnings.push("DEV_HISTORY_INCOMPLETE_FROM_CREATION");
    }

    if (creatorEvidence === null || !coverage.completeFromCreation) {
      return { creatorEvidence, coverage, dev: null, warnings };
    }

    const relatedAddresses = new Set(input.relatedAddresses);
    const relatedCurrentBalances = new Map(
      [...input.relatedCurrentBalances].filter(([address]) => relatedAddresses.has(address)),
    );

    const devInput: DevBehaviorInput = {
      creatorAddress: creatorEvidence.creatorAddress,
      totalSupplyRaw: input.totalSupplyRaw,
      directCurrentBalanceRaw: input.directCurrentBalanceRaw,
      relatedCurrentBalances,
      trades: input.trades.filter((trade) => trade.chain === "solana" && trade.tokenId === input.tokenId),
      transfers: input.transfers.filter((transfer) => transfer.chain === "solana" && transfer.tokenId === input.tokenId),
      relatedAddresses: [...input.relatedAddresses],
      ...(input.calculatedAt === undefined ? {} : { calculatedAt: input.calculatedAt }),
    };

    return {
      creatorEvidence,
      coverage,
      dev: calculateDevBehavior(devInput),
      warnings,
    };
  }
}

function hasTrustedCreatorEvidence(
  evidence: PumpCreatorEvidence | null,
  creationSlot: bigint,
): evidence is PumpCreatorEvidence {
  return evidence !== null
    && evidence.source === CREATOR_SOURCE
    && evidence.creatorAddress.length > 0
    && evidence.signature.length > 0
    && evidence.slot >= 0n
    && evidence.blockTime instanceof Date
    && !Number.isNaN(evidence.blockTime.getTime())
    && evidence.programId === PUMP_PROGRAM_ID
    && evidence.sourceCommit === PUMP_IDL_COMMIT
    && evidence.idlSha256 === PUMP_IDL_SHA256
    && evidence.slot === creationSlot;
}

function assessCoverage(creationSlot: bigint, watermark: DevHistoryWatermark): DevHistoryCoverage {
  const completeFromCreation = creationSlot >= 0n
    && watermark.oldestObservedSlot >= 0n
    && watermark.newestObservedSlot >= watermark.oldestObservedSlot
    && watermark.cursor.trim().length > 0
    && watermark.observedAt instanceof Date
    && !Number.isNaN(watermark.observedAt.getTime())
    && watermark.oldestObservedSlot <= creationSlot
    && watermark.newestObservedSlot >= creationSlot
    && watermark.finalizedSlot >= watermark.newestObservedSlot
    && !watermark.hasGaps;

  return {
    creationSlot,
    oldestObservedSlot: watermark.oldestObservedSlot,
    newestObservedSlot: watermark.newestObservedSlot,
    finalizedSlot: watermark.finalizedSlot,
    cursor: watermark.cursor,
    hasGaps: watermark.hasGaps,
    observedAt: watermark.observedAt,
    completeFromCreation,
  };
}
