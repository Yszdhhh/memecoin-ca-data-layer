import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dataSource, isHttpLiveSource } from "../data/source";
import type { TaskViewModel } from "../data/types";
import { describeTaskTerminalState } from "../data/live-api-map";
import { TrustBadge } from "../components/TrustBadge";

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskViewModel[]>([]);
  const [mint, setMint] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = dataSource.getDataSourceMeta();
  const live = meta.mode === "http";

  async function reload() {
    setTasks(await dataSource.listTasks());
  }

  useEffect(() => {
    void reload().catch((e: Error) => setErr(e.message));
  }, []);

  async function createTask() {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const t = await dataSource.createLocalDemoTask(mint.trim() || (live ? "" : "demo-mint"));
      if (live && isHttpLiveSource(dataSource)) {
        setNote(`已创建 Live 任务 ${t.taskId}，轮询中…`);
        const done = await dataSource.pollTask(t.taskId, { maxAttempts: 45, intervalMs: 700 });
        setNote(
          done
            ? `任务 ${done.taskId} → ${done.status}（${done.requestsUsed}/${done.requestBudget}）`
            : `任务 ${t.taskId} 已提交`,
        );
      } else {
        setNote(`已创建本地 demo task ${t.taskId}（未调用 Helius / 无网络）`);
      }
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>任务中心</h1>
      <div className={`banner ${live ? "warn" : ""}`}>
        {live
          ? "Live Wiring：任务经 loopback Operator API（POST/GET ca-holder-tasks）。浏览器无 Helius Key。"
          : "Shell 阶段任务为静态 fixture + 本地 demo。发起任务不会触发 Helius / GMGN / RPC。"}
      </div>
      <div className="panel">
        <div className="form-row">
          <input
            placeholder={live ? "Solana mint（必填）" : "可选 mint（仅写入本地 demo task）"}
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            aria-label="demo-task-mint"
          />
          <button
            className="primary"
            type="button"
            disabled={busy || (live && !mint.trim())}
            onClick={() => void createTask()}
          >
            {live ? (busy ? "提交中…" : "发起 CA Holder 任务") : "发起本地 demo 任务"}
          </button>
        </div>
        {note && <div className="muted">{note}</div>}
        {err && <div className="error">{err}</div>}
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Input</th>
              <th>Provider</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Start / End</th>
              <th>Warnings</th>
              <th>Output</th>
              <th>Failure</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const terminal = describeTaskTerminalState({
                taskId: t.taskId,
                mint: t.input.mint ?? "",
                status: t.status,
                requestBudget: t.requestBudget,
                requestsUsed: t.requestsUsed,
                startedAt: t.startedAt,
                endedAt: t.endedAt,
                warnings: t.warnings,
                failureReason: t.failureReason,
                providerBudgetExhausted: t.warnings.some((w) =>
                  String(w).toLowerCase().includes("budget"),
                ),
              });
              return (
                <tr key={t.taskId}>
                  <td className="mono">
                    <Link to={`/tasks/${encodeURIComponent(t.taskId)}`}>{t.taskId}</Link>
                  </td>
                  <td className="mono">{t.input.mint ?? "—"}</td>
                  <td>{t.provider}</td>
                  <td>
                    {t.requestsUsed}/{t.requestBudget}
                  </td>
                  <td>
                    <TrustBadge label={terminal.label} />
                  </td>
                  <td className="mono muted">
                    {t.startedAt ?? "—"}
                    <br />
                    {t.endedAt ?? "—"}
                  </td>
                  <td className="mono muted">{t.warnings.join(", ") || "—"}</td>
                  <td>{t.outputLink ? <Link to={t.outputLink}>open</Link> : "—"}</td>
                  <td className="mono">{t.failureReason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tasks.length === 0 && <div className="empty">暂无任务</div>}
      </div>
    </div>
  );
}
