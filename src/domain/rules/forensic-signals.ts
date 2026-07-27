import type { ClusterMember } from "../types.js";
import { scoreClusterFusion, type ClusterFusionFeatures, type ClusterSignal } from "./cluster-fusion.js";
import { scoreBotSniper, type BotSniperFeatures, type SniperSignal } from "./bot-sniper.js";
import {
  scoreIndependentSmartMoney,
  type IndependenceFeatures,
  type IndependenceSignal,
} from "./independent-smart-money.js";

export interface WalletForensicSignals {
  clusterSignal: ClusterSignal;
  sniperSignal: SniperSignal;
  independenceSignal: IndependenceSignal;
}

/** Compose all three detectors for a wallet (offline pure). */
export function evaluateWalletForensics(input: {
  seed: ClusterMember | null;
  clusterFeatures: Omit<ClusterFusionFeatures, "fFund"> & { fFund?: number };
  sniperFeatures: BotSniperFeatures;
  independenceFeatures: IndependenceFeatures;
}): WalletForensicSignals {
  const clusterSignal = scoreClusterFusion(input.seed, input.clusterFeatures);
  const sniperSignal = scoreBotSniper(input.sniperFeatures);
  const independenceSignal = scoreIndependentSmartMoney(
    input.independenceFeatures,
    clusterSignal,
    sniperSignal,
  );
  return { clusterSignal, sniperSignal, independenceSignal };
}
