/**
 * REPLAY-BACKTEST-001 / SCORE-CALIBRATION-001 — as-of reconstruction helpers.
 * Forbid using labels observed after the decision time.
 */

export const REPLAY_ASOF_RULE_VERSION = "replay-asof-v1";

export interface AsOfLabel {
  label: string;
  observedAt: string;
  verificationStatus: string;
}

export interface ReplayPoint {
  decisionAt: string;
  subjectId: string;
  features: Record<string, number | null>;
  labelsAsOf: AsOfLabel[];
  outcome?: { realizedAt: string; result: string } | null;
}

export function filterLabelsAsOf(labels: AsOfLabel[], decisionAt: string): AsOfLabel[] {
  return labels.filter((l) => l.observedAt <= decisionAt);
}

export function assertNoFutureLeak(point: ReplayPoint): { ok: true } | { ok: false; reason: string } {
  for (const l of point.labelsAsOf) {
    if (l.observedAt > point.decisionAt) {
      return { ok: false, reason: `future_label:${l.label}` };
    }
  }
  if (point.outcome && point.outcome.realizedAt < point.decisionAt) {
    return { ok: false, reason: "outcome_before_decision" };
  }
  return { ok: true };
}

export interface CalibrationReport {
  ruleVersion: string;
  sampleSize: number;
  threshold: number | null;
  hitRate: number | null;
  falsePositiveRate: number | null;
  warnings: string[];
  note: string;
}

/**
 * Without enough samples, only report observation — no calibrated threshold.
 */
export function calibrateBinaryThreshold(
  scores: Array<{ score: number; positive: boolean }>,
  minSamples = 30,
): CalibrationReport {
  if (scores.length < minSamples) {
    return {
      ruleVersion: REPLAY_ASOF_RULE_VERSION,
      sampleSize: scores.length,
      threshold: null,
      hitRate: null,
      falsePositiveRate: null,
      warnings: ["insufficient_samples_for_calibration"],
      note: "Observation only — do not replace hand thresholds until sample support exists.",
    };
  }
  // Simple grid search on unique scores
  const uniq = [...new Set(scores.map((s) => s.score))].sort((a, b) => a - b);
  let best = { t: uniq[0]!, f1: -1, hit: 0, fp: 0 };
  for (const t of uniq) {
    let tp = 0,
      fp = 0,
      fn = 0,
      tn = 0;
    for (const s of scores) {
      const pred = s.score >= t;
      if (pred && s.positive) tp += 1;
      else if (pred && !s.positive) fp += 1;
      else if (!pred && s.positive) fn += 1;
      else tn += 1;
    }
    const prec = tp + fp === 0 ? 0 : tp / (tp + fp);
    const rec = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = prec + rec === 0 ? 0 : (2 * prec * rec) / (prec + rec);
    if (f1 > best.f1) best = { t, f1, hit: rec, fp: tp + fp + tn + fn === 0 ? 0 : fp / Math.max(1, fp + tn) };
  }
  return {
    ruleVersion: REPLAY_ASOF_RULE_VERSION,
    sampleSize: scores.length,
    threshold: best.t,
    hitRate: best.hit,
    falsePositiveRate: best.fp,
    warnings: [],
    note: "Threshold from as-of labels only; re-run when sample grows.",
  };
}
