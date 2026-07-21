import type { DevBehavior, NormalizedTrade, TokenTransfer } from "../types.js";

export interface DevBehaviorInput {
  creatorAddress: string;
  totalSupplyRaw: bigint;
  directCurrentBalanceRaw: bigint;
  relatedCurrentBalances: Map<string, bigint>;
  trades: NormalizedTrade[];
  transfers: TokenTransfer[];
  relatedAddresses: string[];
  calculatedAt?: Date;
}

function pct(value: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((value * 1_000_000n) / total) / 10_000;
}

export function calculateDevBehavior(input: DevBehaviorInput): DevBehavior {
  const related = new Set(input.relatedAddresses);
  let directBought = 0n;
  let directSold = 0n;
  let relatedSold = 0n;
  let directSellCount = 0;

  for (const trade of input.trades) {
    if (trade.trader === input.creatorAddress) {
      if (trade.side === "buy") directBought += trade.tokenAmountRaw;
      else {
        directSold += trade.tokenAmountRaw;
        directSellCount += 1;
      }
    } else if (related.has(trade.trader) && trade.side === "sell") {
      relatedSold += trade.tokenAmountRaw;
    }
  }

  // Transfers to known related wallets are not counted as sold. They remain traceable inventory.
  const outboundTransfer = input.transfers
    .filter((transfer) => transfer.from === input.creatorAddress && !related.has(transfer.to))
    .reduce((sum, transfer) => sum + transfer.amountRaw, 0n);
  const relatedBalance = [...input.relatedCurrentBalances.values()].reduce((sum, value) => sum + value, 0n);
  const netDisposed = directSold > directBought ? directSold - directBought : 0n;

  return {
    creatorAddress: input.creatorAddress,
    currentHoldingPct: pct(input.directCurrentBalanceRaw, input.totalSupplyRaw),
    relatedHoldingPct: pct(relatedBalance, input.totalSupplyRaw),
    grossBoughtPct: pct(directBought, input.totalSupplyRaw),
    grossSoldPct: pct(directSold, input.totalSupplyRaw),
    netDisposedPct: pct(netDisposed, input.totalSupplyRaw),
    soldOfAcquiredPct: directBought > 0n ? Number((directSold * 10_000n) / directBought) / 100 : null,
    directSellCount,
    relatedGrossSoldPct: pct(relatedSold, input.totalSupplyRaw),
    outboundTransferPct: pct(outboundTransfer, input.totalSupplyRaw),
    relatedAddresses: [...related],
    calculatedAt: input.calculatedAt ?? new Date(),
  };
}
