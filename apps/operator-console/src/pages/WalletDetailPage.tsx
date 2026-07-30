import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataSource } from "../data/source";
import type { WalletViewModel } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";

export function WalletDetailPage() {
  const { walletId = "" } = useParams();
  const [w, setW] = useState<WalletViewModel | null | undefined>(undefined);

  useEffect(() => {
    dataSource.getWallet(walletId).then(setW);
  }, [walletId]);

  if (w === undefined) return <div className="loading">加载中…</div>;
  if (w === null) {
    return (
      <div className="empty">
        未找到演示钱包 <span className="mono">{walletId}</span> · <Link to="/wallets">返回</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>钱包详情 · {w.fingerprint}</h1>
      <div className="banner warn">
        Third-party Tier-B observation · Not confirmed on-chain smart money
      </div>
      <div className="banner">{w.disclaimer}</div>
      <div className="panel">
        <div className="kv">
          <div className="k">id</div>
          <div className="mono">{w.id}</div>
          <div className="k">tier</div>
          <div>{w.tier}</div>
          <div className="k">7d / 30d</div>
          <div>
            <TrustBadge label={w.status7d} /> / <TrustBadge label={w.status30d} />
          </div>
          <div className="k">completeness</div>
          <div>{w.completeness.toFixed(2)}</div>
          <div className="k">verification</div>
          <div>
            <TrustBadge label={w.verificationStatus.toUpperCase()} />
          </div>
          <div className="k">observedAt</div>
          <div className="mono">{w.observedAt}</div>
          <div className="k">warnings</div>
          <div className="mono">{w.warnings.join(", ") || "—"}</div>
          <div className="k">CA hits</div>
          <div className="muted">{w.caHitsPlaceholder}</div>
          <div className="k">note</div>
          <div>{w.note || "—"}</div>
        </div>
      </div>
      <div className="panel">
        <h2>标签</h2>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Source</th>
              <th>Confidence</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {w.labels.map((l, i) => (
              <tr key={`${l.label}-${i}`}>
                <td>{l.label}</td>
                <td className="mono">{l.source}</td>
                <td>{l.confidence}</td>
                <td>
                  <TrustBadge label={l.verificationStatus.toUpperCase()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {w.ledger && (
        <div className="panel">
          <h2>Wallet token ledger（offline fixture path）</h2>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              {
                openBalanceRaw: (w.ledger as { openBalanceRaw?: string }).openBalanceRaw,
                netDeltaRaw: (w.ledger as { netDeltaRaw?: string }).netDeltaRaw,
                conservationOk: (w.ledger as { conservationOk?: boolean }).conservationOk,
                completeness: (w.ledger as { completeness?: string }).completeness,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
      {w.performance && (
        <div className="panel">
          <h2>PnL（fail-closed）</h2>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(w.performance, null, 2)}</pre>
        </div>
      )}
      {w.crossCa && (
        <div className="panel">
          <h2>Cross-CA</h2>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
            {JSON.stringify((w.crossCa as { walletToTokens?: unknown }).walletToTokens, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
