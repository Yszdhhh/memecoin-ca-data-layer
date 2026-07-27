import type { AnalysisOptions, AnalysisResult } from "../../domain/types.js";
import type { DeepDiveQueue } from "./ca-first-screen.js";

export interface DeepAnalysisRunner {
  getDeepAnalysis(ca: string, options?: AnalysisOptions): Promise<AnalysisResult>;
}

export interface DeepDiveDrainReport {
  processed: string[];
  failed: Array<{ tokenCa: string; reason: string }>;
}

/**
 * Offline queue adapter that connects the hot path to AnalysisService without
 * running deep analysis inside the first-screen latency budget.
 */
export class AnalysisServiceDeepDiveQueue implements DeepDiveQueue {
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();

  constructor(private readonly analysis: DeepAnalysisRunner) {}

  async enqueue(tokenCa: string): Promise<void> {
    if (this.queued.has(tokenCa)) return;
    this.queued.add(tokenCa);
    this.pending.push(tokenCa);
  }

  size(): number {
    return this.pending.length;
  }

  async drainAll(): Promise<DeepDiveDrainReport> {
    const report: DeepDiveDrainReport = { processed: [], failed: [] };
    while (this.pending.length > 0) {
      const tokenCa = this.pending.shift()!;
      this.queued.delete(tokenCa);
      try {
        await this.analysis.getDeepAnalysis(tokenCa, { chainHint: "solana" });
        report.processed.push(tokenCa);
      } catch (error) {
        report.failed.push({
          tokenCa,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return report;
  }
}
