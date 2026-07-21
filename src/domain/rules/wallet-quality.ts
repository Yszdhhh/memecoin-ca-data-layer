import type { WalletFacts, WalletQuality, WalletQualityLabel } from "../types.js";

export function classifyWallet(facts: WalletFacts, at: Date): WalletQuality {
  const labels: WalletQualityLabel[] = [];
  const reasons: string[] = [];
  const tagRoles = new Set(facts.tags.filter((tag) => tag.confidence >= 0.8).map((tag) => tag.role));

  if (tagRoles.has("blacklist")) {
    labels.push("blacklist");
    reasons.push("命中黑名单地址库");
  }
  if (tagRoles.has("whitelist")) {
    labels.push("whitelist");
    reasons.push("命中白名单地址库");
  }

  const ageHours = facts.firstSeenAt ? (at.getTime() - facts.firstSeenAt.getTime()) / 3_600_000 : null;
  if (ageHours !== null && ageHours <= 24 && facts.transactionCount <= 5) {
    labels.push("new_wallet");
    reasons.push("地址存续不超过 24 小时且历史交易不超过 5 笔");
  } else if (ageHours !== null && ageHours >= 30 * 24 && facts.transactionCount >= 30) {
    labels.push("historical_wallet");
    reasons.push("地址存续至少 30 天且有稳定交易历史");
  }

  const botSignals = [
    facts.swapsLast24h >= 150,
    facts.medianSwapIntervalSeconds !== undefined && facts.medianSwapIntervalSeconds <= 5,
    facts.failedTxRatio !== undefined && facts.failedTxRatio >= 0.35,
  ].filter(Boolean).length;
  if (botSignals >= 2) {
    labels.push("suspected_bot");
    reasons.push("高频、短间隔或失败率信号中至少命中两项");
  }

  const primary: WalletQualityLabel = labels.includes("blacklist")
    ? "blacklist"
    : labels.includes("whitelist")
      ? "whitelist"
      : labels.includes("suspected_bot")
        ? "suspected_bot"
        : labels[0] ?? "unknown";
  const score = primary === "whitelist" ? 90 : primary === "historical_wallet" ? 70 : primary === "new_wallet" ? 35 : primary === "suspected_bot" ? 20 : primary === "blacklist" ? 0 : 50;
  return { primary, labels: labels.length > 0 ? labels : ["unknown"], score, reasons };
}
