export const BOT_SNIPER_RULE_VERSION = "bot-sniper-v1";

export interface BotSniperFeatures {
  /** Entry earliness 1.0 at slots 0–2 → 0 by ~150. */
  fSlot: number;
  /** First-minute frequency / wallet-quality bot signal strength. */
  fFreq: number;
  /** Median buy→sell hold time score (1 if <60s). */
  fHold: number;
  /** Multi-address funder fan-out pattern strength. */
  fDist: number;
  /** Tier-B external sniper label, capped. */
  fExt?: number;
}

export interface SniperSignal {
  S: number;
  isBotPattern: boolean;
  isSniper: boolean;
  distributed: boolean;
  ruleVersion: string;
  features: Required<BotSniperFeatures>;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Behavior label only — never drives holder exclusion
 * (holderExclusionUsesWalletQuality remains false).
 */
export function scoreBotSniper(features: BotSniperFeatures): SniperSignal {
  const fSlot = clamp01(features.fSlot);
  const fFreq = clamp01(features.fFreq);
  const fHold = clamp01(features.fHold);
  const fDist = clamp01(features.fDist);
  const fExt = clamp01(features.fExt ?? 0);

  const S = 0.3 * fSlot
    + 0.25 * fFreq
    + 0.2 * fHold
    + 0.25 * fDist
    + Math.min(0.1, 0.1 * fExt);

  // G-3a: multi-address pattern OR ≥2 of {slot,freq,hold} high
  const highCore = [fSlot, fFreq, fHold].filter((x) => x >= 0.8).length;
  const mayFire = fDist > 0 || highCore >= 2;
  const isSniper = mayFire && S >= 0.75;
  const isBotPattern = mayFire && S >= 0.6;

  return {
    S,
    isBotPattern,
    isSniper,
    distributed: fDist > 0,
    ruleVersion: BOT_SNIPER_RULE_VERSION,
    features: { fSlot, fFreq, fHold, fDist, fExt },
  };
}

/** Map entry slot offset to f_slot (methods: 1.0 at 0–2, 0 by ~150). */
export function slotEarliness(entrySlotOffset: number): number {
  if (entrySlotOffset <= 2) return 1;
  if (entrySlotOffset >= 150) return 0;
  return 1 - (entrySlotOffset - 2) / (150 - 2);
}
