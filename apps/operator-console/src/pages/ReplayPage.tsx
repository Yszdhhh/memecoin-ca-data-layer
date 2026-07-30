import { useEffect, useState } from "react";
import { dataSource } from "../data/source";

export function ReplayPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    dataSource
      .getReplayCalibration()
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return <div className="error">加载失败：{err}</div>;
  if (!data) return <div className="loading">加载中…</div>;

  const cal = (data.calibration ?? {}) as {
    threshold?: number | null;
    sampleSize?: number;
    warnings?: string[];
    note?: string;
    hitRate?: number | null;
    falsePositiveRate?: number | null;
  };

  return (
    <div>
      <h1>Replay / 校准（as-of）</h1>
      <div className="banner warn">
        禁止未来标签泄漏 · 样本不足时 threshold=null · mode={dataSource.getDataSourceMeta().mode}
      </div>
      <div className="panel">
        <div className="kv">
          <div className="k">asOfCheck</div>
          <div className="mono">{JSON.stringify(data.asOfCheck ?? data.note ?? null)}</div>
          <div className="k">labelsAsOfCount</div>
          <div>{String(data.labelsAsOfCount ?? "—")}</div>
          <div className="k">sampleSize</div>
          <div>{cal.sampleSize ?? "—"}</div>
          <div className="k">threshold</div>
          <div className="mono">{cal.threshold === null || cal.threshold === undefined ? "null (observation only)" : String(cal.threshold)}</div>
          <div className="k">hitRate / fpRate</div>
          <div className="mono">
            {cal.hitRate ?? "—"} / {cal.falsePositiveRate ?? "—"}
          </div>
          <div className="k">warnings</div>
          <div className="mono">{(cal.warnings ?? []).join(", ") || "—"}</div>
          <div className="k">note</div>
          <div>{cal.note ?? "—"}</div>
        </div>
      </div>
      <div className="panel">
        <h2>Raw</h2>
        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
