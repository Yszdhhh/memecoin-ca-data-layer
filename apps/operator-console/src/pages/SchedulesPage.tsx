import { useEffect, useState } from "react";
import { dataSource } from "../data/source";
import type { ScheduleView } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";

export function SchedulesPage() {
  const [rows, setRows] = useState<ScheduleView[]>([]);
  const [subjects, setSubjects] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    setRows(await dataSource.listSchedules());
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onCreate() {
    try {
      const list = subjects
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await dataSource.createSchedule({
        type: "ca_watch",
        subjects: list,
        intervalHours: 24,
        budgetPerRun: 5,
        enabled: false,
      });
      setMsg("已创建计划（默认关闭；禁止全市场扫描）");
      setSubjects("");
      await reload();
    } catch (e) {
      setMsg(`失败：${e instanceof Error ? e.message : "error"}`);
    }
  }

  return (
    <div>
      <h1>受控计划（Schedules）</h1>
      <div className="banner warn">
        默认关闭 · 仅显式 CA/watchlist · 禁止 full_market_scan · mode={dataSource.getDataSourceMeta().mode}
      </div>
      <div className="panel">
        <div className="form-row">
          <input
            placeholder="CA mints，逗号分隔"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            aria-label="schedule-subjects"
          />
          <button className="primary" type="button" onClick={() => void onCreate()}>
            创建（默认 disabled）
          </button>
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Subjects</th>
              <th>Interval</th>
              <th>Budget</th>
              <th>Next</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.scheduleId}>
                <td className="mono">{s.scheduleId.slice(0, 8)}</td>
                <td>{s.type}</td>
                <td className="mono">{s.subjects.join(", ")}</td>
                <td>{s.intervalHours}h</td>
                <td>{s.budgetPerRun}</td>
                <td className="mono muted">{s.nextRunAt}</td>
                <td>
                  <TrustBadge label={s.enabled ? "ON" : "OFF"} />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => void dataSource.setScheduleEnabled(s.scheduleId, !s.enabled).then(reload)}
                  >
                    {s.enabled ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">暂无计划</div>}
      </div>
    </div>
  );
}
