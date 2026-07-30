import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dataSource } from "../data/source";
import type { WalletListItem, WalletPoolSummary } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";

export function WalletListPage() {
  const [summary, setSummary] = useState<WalletPoolSummary | null>(null);
  const [items, setItems] = useState<WalletListItem[]>([]);

  useEffect(() => {
    dataSource.listWallets().then((r) => {
      setSummary(r.summary);
      setItems(r.items);
    });
  }, []);

  if (!summary) return <div className="loading">加载中…</div>;

  return (
    <div>
      <h1>钱包库（脱敏摘要）</h1>
      <div className="banner warn">{summary.disclaimer}</div>
      <div className="banner">
        source={summary.source} · verification={summary.verificationStatus} · observedAt={summary.observedAt}
        · 不包含 Git 中不存在的 1,433 明文地址
      </div>
      <div className="grid-3">
        <div className="panel">
          <div className="muted">Alpha</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.alpha}</div>
        </div>
        <div className="panel">
          <div className="muted">Tier-B usable pool</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.tierBUsablePool}</div>
        </div>
        <div className="panel">
          <div className="muted">Tier-B shortlist</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.tierBShortlist}</div>
        </div>
        <div className="panel">
          <div className="muted">Manual Review</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.manualReview}</div>
        </div>
        <div className="panel">
          <div className="muted">MAPPED / PARTIAL≈</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {summary.mapped} / {summary.partialApproxPct}%
          </div>
        </div>
        <div className="panel">
          <div className="muted">≥1 period UNAVAILABLE</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.unavailablePeriodWallets}</div>
        </div>
      </div>

      <div className="panel">
        <h2>演示钱包（fingerprint / 合成，非明文 bulk）</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tier</th>
              <th>7d / 30d</th>
              <th>Completeness</th>
              <th>Verification</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td>
                  <Link to={`/wallets/${w.id}`}>{w.fingerprint}</Link>
                </td>
                <td>{w.tier}</td>
                <td>
                  <TrustBadge label={w.status7d} /> / <TrustBadge label={w.status30d} />
                </td>
                <td>{w.completeness.toFixed(2)}</td>
                <td>
                  <TrustBadge label={w.verificationStatus.toUpperCase()} />
                </td>
                <td className="mono muted">{w.warnings.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
