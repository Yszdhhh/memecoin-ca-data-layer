import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dataSource, isHttpLiveSource } from "../data/source";
import type { CaScanListItem } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";
import { accountingLabel, concentrationLabel, exclusionLabel, shortMint } from "../lib/format";

export function CaListPage() {
  const [items, setItems] = useState<CaScanListItem[]>([]);
  const [mint, setMint] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const nav = useNavigate();
  const meta = dataSource.getDataSourceMeta();
  const live = meta.mode === "http";

  useEffect(() => {
    dataSource
      .listCaScans()
      .then(setItems)
      .catch((e: Error) => setErr(e.message));
  }, []);

  async function runLiveAnalysis() {
    const m = mint.trim();
    if (!m) return;
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const task = await dataSource.createLocalDemoTask(m);
      setNote(`已创建任务 ${task.taskId}（status=${task.status}）`);
      if (isHttpLiveSource(dataSource)) {
        const done = await dataSource.pollTask(task.taskId, { maxAttempts: 45, intervalMs: 700 });
        if (done) setNote(`任务 ${done.taskId} → ${done.status}`);
      }
      nav(`/ca/${encodeURIComponent(m)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>CA 分析</h1>
      <div className={`banner ${live ? "warn" : ""}`}>
        数据源：{meta.note}
        {live
          ? " · Live Wiring：POST loopback Operator API，浏览器无 Helius Key"
          : " · 更新时间见各 CA observedAt · 本页零 Live Provider 请求"}
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
            disabled={busy}
            onClick={() => {
              if (live) void runLiveAnalysis();
              else if (mint.trim()) nav(`/ca/${encodeURIComponent(mint.trim())}`);
            }}
          >
            {live ? (busy ? "分析中…" : "发起 Live 分析") : "打开"}
          </button>
          {!live && (
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
          )}
        </div>
        {note && <div className="muted">{note}</div>}
      </div>

      {err && <div className="error">{err}</div>}
      {!err && items.length === 0 && (
        <div className="empty">
          {live ? "本会话尚无 Live CA 结果 — 输入 mint 发起任务" : "暂无 fixture CA"}
        </div>
      )}

      {items.length > 0 && (
        <div className="panel">
          <h2>{live ? "本会话 Live 结果" : "最近分析列表（fixture pilot）"}</h2>
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
                    {i.symbol ?? "—"}
                    <div className="muted">{i.name ?? ""}</div>
                  </td>
                  <td className="mono">
                    <Link to={`/ca/${encodeURIComponent(i.mint)}`}>{shortMint(i.mint, 6)}</Link>
                  </td>
                  <td>
                    <TrustBadge label={accountingLabel(i.accountingEligible)} />
                  </td>
                  <td>
                    <TrustBadge label={exclusionLabel(i.exclusionCoverage)} />
                  </td>
                  <td>
                    <TrustBadge label={concentrationLabel(i.concentrationEligible)} />
                  </td>
                  <td className="mono muted">{i.observedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
