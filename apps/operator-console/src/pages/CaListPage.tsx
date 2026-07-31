import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dataSource, resolveOperatorApiBase } from "../data/source";
import type { CaScanListItem } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";
import { accountingLabel, concentrationLabel, exclusionLabel, shortMint } from "../lib/format";
import {
  emptyReadiness,
  probeReadiness,
  readinessBlocksLiveSubmit,
  type ReadinessFlags,
} from "../data/readiness";
import { errorDisplayLabel, isOperatorApiError } from "../data/api-error";

function isValidMintInput(m: string): boolean {
  const t = m.trim();
  // Solana base58 mint — length band only (full validation is server-side)
  return t.length >= 32 && t.length <= 48 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}

export function CaListPage() {
  const [items, setItems] = useState<CaScanListItem[]>([]);
  const [mint, setMint] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessFlags>(() => emptyReadiness());
  const nav = useNavigate();
  const meta = dataSource.getDataSourceMeta();
  const liveConfigured = meta.mode === "http";
  const apiBase = resolveOperatorApiBase();

  useEffect(() => {
    dataSource
      .listCaScans()
      .then(setItems)
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void probeReadiness(apiBase).then((r) => {
      if (!cancelled) setReadiness(r);
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const liveBlock = readinessBlocksLiveSubmit(readiness);
  const mintOk = isValidMintInput(mint);
  const submitDisabled =
    busy || (liveConfigured ? liveBlock.disabled || !mintOk : !mint.trim());

  async function runLiveAnalysis() {
    const m = mint.trim();
    if (!m || !mintOk) return;
    if (liveConfigured && liveBlock.disabled) {
      setErr(`Live Submit 禁用：${readiness.banner}（${liveBlock.reason}）`);
      return;
    }
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const task = await dataSource.createCaHolderTask(m);
      setNote(`已创建任务 ${task.taskId}（status=${task.status}）`);
      nav(`/tasks/${encodeURIComponent(task.taskId)}`);
    } catch (e) {
      if (isOperatorApiError(e)) {
        setErr(`${errorDisplayLabel(e.code)}：${e.message}`);
      } else {
        setErr(e instanceof Error ? e.message : "create_failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const bannerClass =
    readiness.READY ? "banner" : liveConfigured || apiBase ? "banner warn" : "banner";

  return (
    <div>
      <h1>CA 分析</h1>
      <div className={bannerClass} data-testid="readiness-banner">
        <strong>{liveConfigured || apiBase ? readiness.banner : "Fixture 模式"}</strong>
        {" · "}
        {meta.note}
        {liveConfigured
          ? " · Live：POST loopback Operator API，浏览器无 Helius Key"
          : " · 本页零 Live Provider 请求"}
        {liveConfigured && !readiness.READY && (
          <div className="muted" style={{ marginTop: 6 }}>
            Live Submit 已禁用 — {liveBlock.reason}
            {" · flags: "}
            HTTP_CONFIGURED={String(readiness.HTTP_CONFIGURED)} API_REACHABLE=
            {String(readiness.API_REACHABLE)} LIVE_ENABLED={String(readiness.LIVE_ENABLED)}{" "}
            CREDENTIAL_AVAILABLE={String(readiness.CREDENTIAL_AVAILABLE)}
          </div>
        )}
      </div>
      <div className="panel">
        <div className="form-row">
          <input
            placeholder="输入公开 Solana mint"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            aria-label="ca-input"
          />
          <button
            className="primary"
            type="button"
            disabled={submitDisabled}
            title={
              liveConfigured && liveBlock.disabled
                ? `Live 未 Ready：${liveBlock.reason}`
                : liveConfigured && !mintOk
                  ? "请输入合法 Solana mint"
                  : undefined
            }
            onClick={() => {
              if (liveConfigured) void runLiveAnalysis();
              else if (mint.trim()) nav(`/ca/${encodeURIComponent(mint.trim())}`);
            }}
          >
            {liveConfigured ? (busy ? "提交中…" : "发起 Live 分析") : "打开"}
          </button>
          {!liveConfigured && (
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
        {liveConfigured && mint.trim() && !mintOk && (
          <div className="muted">mint 格式无效（需 base58，32–48 字符）</div>
        )}
      </div>

      {err && (
        <div className="error" data-testid="ca-error">
          {err}
        </div>
      )}
      {!err && items.length === 0 && (
        <div className="empty">
          {liveConfigured ? "本会话尚无 Live CA 结果 — 输入 mint 发起任务" : "暂无 fixture CA"}
        </div>
      )}

      {items.length > 0 && (
        <div className="panel">
          <h2>{liveConfigured ? "本会话 Live 结果" : "最近分析列表（fixture pilot）"}</h2>
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
