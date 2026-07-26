import type { MarketDataProvider } from "../../application/ports.js";
import type { MarketObservation, MarketSnapshot, TokenRef } from "../../domain/types.js";
import { selectMarketSnapshot } from "../../domain/rules/market-observation.js";

/**
 * Offline MarketDataProvider backed by local append-only observations.
 * Never calls a network provider; constitution rule 7 enrichment only.
 */
export class ObservationMarketDataProvider implements MarketDataProvider {
  constructor(
    private readonly observations: readonly MarketObservation[],
    private readonly options: { staleAfterMs?: number; now?: () => Date } = {},
  ) {}

  async getMarket(token: TokenRef): Promise<MarketSnapshot | null> {
    if (token.chain !== "solana") return null;
    return selectMarketSnapshot(this.observations, {
      tokenId: token.id,
      at: this.options.now?.() ?? new Date(),
      ...(this.options.staleAfterMs !== undefined ? { staleAfterMs: this.options.staleAfterMs } : {}),
    });
  }
}
