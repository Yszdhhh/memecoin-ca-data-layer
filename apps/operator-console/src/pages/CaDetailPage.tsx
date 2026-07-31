import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { dataSource, resolveOperatorApiBase } from "../data/source";
import type { CaScanViewModel } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";
import {
  accountingLabel,
  concentrationLabel,
  exclusionLabel,
  formatCount,
  formatRatio,
  shortMint,
} from "../lib/format";
import { errorDisplayLabel, isOperatorApiError, type OperatorApiErrorCode } from "../data/api-error";
import {
  emptyReadiness,
  probeReadiness,
  readinessBlocksLiveSubmit,
  type ReadinessFlags,
} from "../data/readiness";

export function CaDetailPage() {
  const { mint = "" } = useParams();
  const [scan, setScan] = useState<CaScanViewModel | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<OperatorApiErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessFlags>(() => emptyReadiness());
  const nav = useNavigate();
  const meta = dataSource.getDataSourceMeta();
  const apiBase = resolveOperatorApiBase();

  useEffect(() => {
    let cancelled = false;
    void probeReadiness(apiBase).then((r) => {
      if (!cancelled) setReadiness(r);
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    setScan(undefined);
    setErr(null);
    setErrCode(null);
    dataSource
      .getCaScan(mint)
      .then(setScan)
      .catch((e: unknown) => {
        if (isOperatorApiError(e)) {
          setErrCode(e.code);
          setErr(`${errorDisplayLabel(e.code)}：${e.message}`);
        } else {
          setErr(e instanceof Error ? e.message : "load_failed");
        }
      });
  }, [mint]);

  const liveBlock = readinessBlocksLiveSubmit(readiness);

  async function runLive() {
    setBusy(true);
    setErr(null);
    setErrCode(null);
    if (meta.mode === "http" && liveBlock.disabled) {
      setErr(`Live Submit 禁用：${readiness.banner}（${liveBlock.reason}）`);
      setBusy(false);
      return;
    }
    try {
      const task = await dataSource.createCaHolderTask(mint);
      nav(`/tasks/${encodeURIComponent(task.taskId)}`);
    } catch (e) {
      if (isOperatorApiError(e)) {
        setErrCode(e.code);
        setErr(`${errorDisplayLabel(e.code)}：${e.message}`);
      } else {
        setErr(e instanceof Error ? e.message : "live_failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (err && scan === undefined) {
    return (
      <div className="error" data-testid="ca-detail-error">
        {errCode ? errorDisplayLabel(errCode) : "加载失败"}：{err}
        <div style={{ marginTop: 10 }}>
          <Link to="/ca">返回</Link>
        </div>
      </div>
    );
  }
  if (scan === undefined) return <div className="loading">加载中…</div>;
  if (scan === null) {
    return (
      <div className="empty" data-testid="ca-empty">
        空结果 / 未找到 CA 结果：<span className="mono">{mint}</span>
        {err && (
          <div className="error" style={{ marginTop: 10 }}>
            {err}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          {meta.mode === "http" ? (
            <button
              className="primary"
              type="button"
              disabled={busy || liveBlock.disabled}
              title={liveBlock.disabled ? liveBlock.reason : undefined}
              onClick={() => void runLive()}
            >
              {busy ? "提交中…" : "对该 mint 发起 Live 分析"}
            </button>
          ) : (
            <Link to="/ca">返回列表</Link>
          )}
        </div>
        {meta.mode === "http" && liveBlock.disabled && (
          <div className="banner warn" style={{ marginTop: 12 }}>
            {readiness.banner} — Live Submit 禁用（{liveBlock.reason}）
          </div>
        )}
      </div>
    );
  }

  const topNames = ["top1", "top5", "top10", "top20", "top50", "top100"] as const;
  const liveScan = scan.dataSource === "operator-api-live" || meta.live;

  return (
    <div>
      <h1>
        CA 详情 · {scan.symbol ?? "—"}{" "}
        <TrustBadge label={scan.status} />
      </h1>
      <div className={`banner ${liveScan ? "warn" : ""}`} data-testid="ca-result-trust-strip">
        {liveScan
          ? `Live / Operator API · source=${scan.dataSource} · provider=${scan.provider} · watermark=${scan.sourceWatermark} · observedAt=${scan.observedAt} · universe=${scan.universeDefinition} · 浏览器无 Helius Key`
          : `Fixture / scrubbed pilot · source=${scan.dataSource} · provider=${scan.provider} · Live 未接入`}
      </div>

      <div className="panel">
        <h2>Token 基础信息</h2>
        <div className="kv">
          <div className="k">mint</div>
          <div className="mono">{scan.mint}</div>
          <div className="k">name / symbol</div>
          <div>
            {scan.name ?? "—"} / {scan.symbol ?? "—"}
          </div>
          <div className="k">decimals</div>
          <div>{scan.decimals ?? "—"}</div>
          <div className="k">mint supply (raw)</div>
          <div className="mono">{scan.mintSupplyRaw ?? "—"}</div>
          <div className="k">observedAt</div>
          <div className="mono">{scan.observedAt}</div>
          <div className="k">source watermark</div>
          <div className="mono">{scan.sourceWatermark}</div>
        </div>
      </div>

      <div className="panel">
        <h2>可信度总览（拆分门闩）</h2>
        <div className="grid-3">
          <div className="panel" style={{ margin: 0 }}>
            <div className="muted">Accounting</div>
            <div style={{ marginTop: 6 }}>
              <TrustBadge
                label={accountingLabel(scan.accountingEligible, scan.accounting.completeness)}
                title="供应对账：分页完整 + residual=0 + 分区守恒"
              />
            </div>
          </div>
          <div className="panel" style={{ margin: 0 }}>
            <div className="muted">Exclusion coverage</div>
            <div style={{ marginTop: 6 }}>
              <TrustBadge label={exclusionLabel(scan.exclusionCoverage)} title="pool/LP/bonding-curve 排除覆盖" />
            </div>
          </div>
          <div className="panel" style={{ margin: 0 }}>
            <div className="muted">Concentration</div>
            <div style={{ marginTop: 6 }}>
              <TrustBadge
                label={concentrationLabel(scan.concentrationEligible)}
                title="不得在 exclusion incomplete 时 confirmed"
              />
            </div>
          </div>
        </div>
        {!scan.concentrationEligible && (
          <div className="banner warn" style={{ marginTop: 12, marginBottom: 0 }}>
            Concentration 为 UNVERIFIED：pool / bonding curve exclusion coverage incomplete。
            不得称为「已清洗投资者控盘率」。TopN ratio 在未确认时显示「暂不可确认」，不会显示 0%。
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>Holder universes</h2>
          <div className="kv">
            <div className="k">raw owner count</div>
            <div>{formatCount(scan.ownerCounts.total)}</div>
            <div className="k">included</div>
            <div>{formatCount(scan.ownerCounts.included)}</div>
            <div className="k">excluded</div>
            <div>{formatCount(scan.ownerCounts.excluded)}</div>
            <div className="k">unresolved</div>
            <div>{formatCount(scan.ownerCounts.unresolved)}</div>
            <div className="k">token accounts</div>
            <div>{formatCount(scan.ownerCounts.tokenAccounts)}</div>
            <div className="k">included amount</div>
            <div className="mono">{scan.accounting.includedOwnerBalanceRaw || "—"}</div>
            <div className="k">excluded amount</div>
            <div className="mono">{scan.accounting.excludedBalanceRaw || "—"}</div>
            <div className="k">unresolved amount</div>
            <div className="mono">{scan.accounting.unresolvedBalanceRaw || "—"}</div>
            <div className="k">accounting residual</div>
            <div className="mono">{scan.accounting.accountingResidualRaw || "—"}</div>
            <div className="k">pagination</div>
            <div>
              <TrustBadge label={scan.paginationComplete ? "COMPLETE" : "PARTIAL"} />
            </div>
            <div className="k">identity</div>
            <div className="mono">{scan.accounting.identity}</div>
          </div>
        </div>

        <div className="panel">
          <h2>Concentration（观察值）</h2>
          <div className="muted" style={{ marginBottom: 8 }}>
            universe: {scan.universeDefinition}
          </div>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Numerator</th>
                <th>Ratio</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {topNames.map((n) => {
                const m = scan.concentration[n];
                return (
                  <tr key={n}>
                    <td>{n}</td>
                    <td className="mono">{m?.numerator ?? "—"}</td>
                    <td>{formatRatio(m?.ratio ?? null)}</td>
                    <td>
                      <TrustBadge label={(m?.verificationStatus ?? "unverified").toUpperCase()} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {scan.concentrationWarnings.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {scan.concentrationWarnings.map((w) => (
                <div key={w} className="muted mono">
                  warning: {w}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>Market Data</h2>
          <TrustBadge label="NOT_WIRED" />
          <div className="muted" style={{ marginTop: 8 }}>
            G1 未接线 — 不使用 synthetic 数值填补 Live。
          </div>
        </div>
        <div className="panel">
          <h2>Wallet Intelligence</h2>
          <TrustBadge label="NOT_WIRED" />
          <div className="muted" style={{ marginTop: 8 }}>
            G1 未接线 / fixture-only — 不声称 smart money confirmed。
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Data quality</h2>
        {scan.issues.length === 0 ? (
          <div className="muted">无 issue records</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Severity</th>
                <th>Records</th>
                <th>Balance</th>
                <th>Manual review</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {scan.issues.map((i, idx) => (
                <tr key={`${i.code}-${idx}`}>
                  <td className="mono">{i.code}</td>
                  <td>
                    <TrustBadge label={i.severity.toUpperCase()} />
                  </td>
                  <td>{i.affectedRecordCount ?? "—"}</td>
                  <td className="mono">{i.affectedBalance ?? "—"}</td>
                  <td>{i.whetherManualReviewRequired ? "yes" : "no"}</td>
                  <td className="mono muted">{(i.evidence ?? []).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="muted mono">short: {shortMint(scan.mint, 8)}</div>
    </div>
  );
}
