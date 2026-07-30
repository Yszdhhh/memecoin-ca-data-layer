import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dataSource } from "../data/source";
import type { CaScanListItem } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";
import { accountingLabel, concentrationLabel, exclusionLabel, shortMint } from "../lib/format";

export function CaListPage() {
  const [items, setItems] = useState<CaScanListItem[]>([]);
  const [mint, setMint] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const meta = dataSource.getDataSourceMeta();

  useEffect(() => {
    dataSource
      .listCaScans()
      .then(setItems)
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1>CA 分析</h1>
      <div className="banner">
        数据源：{meta.note} · 更新时间见各 CA observedAt · 本页零 Live Provider 请求
      </div>
      <div className="panel">
        <div className="form-row">
          <input
            placeholder="输入 Solana mint"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            aria-label="ca-input"
          />
          <button
            className="primary"
            type="button"
            onClick={() => mint.trim() && nav(`/ca/${encodeURIComponent(mint.trim())}`)}
          >
            打开
          </button>
          <select
            aria-label="fixture-ca-select"
            value=""
            onChange={(e) => {
              if (e.target.value) nav(`/ca/${encodeURIComponent(e.target.value)}`);
            }}
          >
            <option value="">选择 fixture CA…</option>
            {items.map((i) => (
              <option key={i.mint} value={i.mint}>
                {i.status} · {i.symbol ?? "?"} · {shortMint(i.mint, 6)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="error">{err}</div>}
      {!err && items.length === 0 && <div className="empty">暂无 fixture CA</div>}

      {items.length > 0 && (
        <div className="panel">
          <h2>最近分析列表（fixture pilot）</h2>
          <table>
            <thead>
              <tr>
                <th>状态</th>
                <th>Token</th>
                <th>Mint</th>
                <th>Accounting</th>
                <th>Exclusion</th>
                <th>Concentration</th>
                <th>observedAt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.mint}>
                  <td>
                    <TrustBadge label={i.status} />
                  </td>
                  <td>
                    <Link to={`/ca/${i.mint}`}>
                      {i.symbol ?? "—"} / {i.name ?? "—"}
                    </Link>
                  </td>
                  <td className="mono">{shortMint(i.mint, 6)}</td>
                  <td>
                    <TrustBadge label={accountingLabel(i.accountingEligible)} />
                  </td>
                  <td>
                    <TrustBadge label={exclusionLabel(i.exclusionCoverage)} />
                  </td>
                  <td>
                    <TrustBadge label={concentrationLabel(i.concentrationEligible)} />
                  </td>
                  <td className="muted mono">{i.observedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
