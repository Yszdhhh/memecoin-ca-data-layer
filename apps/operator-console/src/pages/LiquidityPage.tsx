import { useEffect, useState } from "react";
import { dataSource } from "../data/source";
import type { LiquidityViewModel } from "../data/types";

function cell(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : String(v);
}

export function LiquidityPage() {
  const [view, setView] = useState<LiquidityViewModel | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    dataSource
      .getLiquidityLatest()
      .then(setView)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return <div className="error">加载失败：{err}</div>;
  if (!view) return <div className="loading">加载中…</div>;

  const metricRows = Object.entries(view.metrics);

  return (
    <div>
      <h1>流动性水位</h1>
      <div className="banner warn">
        与 CA 热路径独立 · source={view.source} · freshness={view.freshness} · rule={view.ruleVersion}
      </div>
      <div className="panel">
        <div className="kv">
          <div className="k">observedAt</div>
          <div className="mono">{view.observedAt}</div>
          <div className="k">freshness</div>
          <div>{view.freshness}</div>
          <div className="k">data source mode</div>
          <div>{dataSource.getDataSourceMeta().mode}</div>
        </div>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="mono">{cell(v)}</td>
              </tr>
            ))}
            {Object.entries(view.percentiles).map(([k, v]) => (
              <tr key={`p-${k}`}>
                <td>{k} (percentile)</td>
                <td className="mono">{cell(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>Warnings</h2>
        <ul>
          {view.warnings.map((w) => (
            <li key={w} className="mono">
              {w}
            </li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <h2>Daily brief</h2>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{view.briefMarkdown}</pre>
      </div>
    </div>
  );
}
