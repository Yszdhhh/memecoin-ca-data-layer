import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataSource } from "../data/source";
import type { CaScanViewModel } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";
import {
  accountingLabel,
  concentrationLabel,
  exclusionLabel,
  formatRatio,
  shortMint,
} from "../lib/format";

export function CaDetailPage() {
  const { mint = "" } = useParams();
  const [scan, setScan] = useState<CaScanViewModel | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setScan(undefined);
    setErr(null);
    dataSource
      .getCaScan(mint)
      .then(setScan)
      .catch((e: Error) => setErr(e.message));
  }, [mint]);

  if (err) return <div className="error">加载失败：{err}</div>;
  if (scan === undefined) return <div className="loading">加载中…</div>;
  if (scan === null) {
    return (
      <div className="empty">
        未找到 fixture CA：<span className="mono">{mint}</span>
        <div style={{ marginTop: 10 }}>
          <Link to="/ca">返回列表</Link>
        </div>
      </div>
    );
  }

  const topNames = ["top1", "top5", "top10", "top20", "top50", "top100"] as const;

  return (
    <div>
      <h1>
        CA 详情 · {scan.symbol ?? "—"}{" "}
        <TrustBadge label={scan.status} />
      </h1>
      <div className="banner warn">
        Fixture / scrubbed pilot · source={scan.dataSource} · provider={scan.provider} · Live 未接入
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
            <div>{scan.ownerCounts.total}</div>
            <div className="k">included</div>
            <div>{scan.ownerCounts.included}</div>
            <div className="k">excluded</div>
            <div>{scan.ownerCounts.excluded}</div>
            <div className="k">unresolved</div>
            <div>{scan.ownerCounts.unresolved}</div>
            <div className="k">token accounts</div>
            <div>{scan.ownerCounts.tokenAccounts}</div>
            <div className="k">included amount</div>
            <div className="mono">{scan.accounting.includedOwnerBalanceRaw}</div>
            <div className="k">excluded amount</div>
            <div className="mono">{scan.accounting.excludedBalanceRaw}</div>
            <div className="k">unresolved amount</div>
            <div className="mono">{scan.accounting.unresolvedBalanceRaw}</div>
            <div className="k">accounting residual</div>
            <div className="mono">{scan.accounting.accountingResidualRaw}</div>
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

      <div className="panel">
        <h2>Data quality</h2>
        {scan.issues.length === 0 ? (
          <div className="muted">无 issue records（本 fixture）</div>
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

      {scan.analysis && (
        <div className="panel">
          <h2>CA Analysis V2（composer）</h2>
          <div className="kv">
            <div className="k">market trust</div>
            <div>{String((scan.analysis as { market?: { trust?: string } }).market?.trust ?? "—")}</div>
            <div className="k">price / liq</div>
            <div className="mono">
              {String((scan.analysis as { market?: { priceUsd?: number | null; liquidityUsd?: number | null } }).market?.priceUsd ?? "—")}
              {" / "}
              {String((scan.analysis as { market?: { liquidityUsd?: number | null } }).market?.liquidityUsd ?? "—")}
            </div>
            <div className="k">research priority</div>
            <div>
              {((scan.analysis as { researchPriority?: Array<{ dimension: string; summary: string }> }).researchPriority ?? []).map(
                (p) => (
                  <div key={p.dimension} className="muted">
                    <strong>{p.dimension}</strong>: {p.summary}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {scan.dev && (
        <div className="panel">
          <h2>Dev / Creator facts</h2>
          <div className="kv">
            <div className="k">creator</div>
            <div className="mono">{String((scan.dev as { creator?: string | null }).creator ?? "—")}</div>
            <div className="k">verification</div>
            <div>{String((scan.dev as { verificationStatus?: string }).verificationStatus ?? "—")}</div>
            <div className="k">warnings</div>
            <div className="mono muted">
              {((scan.dev as { warnings?: string[] }).warnings ?? []).join(", ") || "—"}
            </div>
          </div>
        </div>
      )}

      {scan.judgment && (
        <div className="panel">
          <h2>Judgment（非交易建议）</h2>
          <div className="kv">
            <div className="k">overall</div>
            <div>
              <TrustBadge label={String((scan.judgment as { overall?: string }).overall ?? "unknown").toUpperCase()} />
            </div>
            <div className="k">dimensions</div>
            <div>
              {((scan.judgment as { dimensions?: Array<{ dimension: string; verdict: string; summary: string }> }).dimensions ?? []).map(
                (d) => (
                  <div key={d.dimension} className="muted">
                    {d.dimension}: {d.verdict} — {d.summary}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {scan.crossCa && (
        <div className="panel">
          <h2>Cross-CA archive hits</h2>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              {
                tokenToWallets: (scan.crossCa as { tokenToWallets?: unknown }).tokenToWallets,
                repeatWinners: (scan.crossCa as { repeatWinners?: unknown }).repeatWinners,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}

      <div className="muted mono">short: {shortMint(scan.mint, 8)}</div>
    </div>
  );
}
