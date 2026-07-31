import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dataSource, resolveOperatorApiBase } from "../data/source";
import type { TaskViewModel } from "../data/types";
import { describeTaskTerminalState } from "../data/live-api-map";
import { TrustBadge } from "../components/TrustBadge";
import {
  emptyReadiness,
  probeReadiness,
  readinessBlocksLiveSubmit,
  type ReadinessFlags,
} from "../data/readiness";
import { errorDisplayLabel, isOperatorApiError } from "../data/api-error";

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskViewModel[]>([]);
  const [mint, setMint] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessFlags>(() => emptyReadiness());
  const nav = useNavigate();
  const meta = dataSource.getDataSourceMeta();
  const live = meta.mode === "http";
  const apiBase = resolveOperatorApiBase();

  async function reload() {
    setTasks(await dataSource.listTasks());
  }

  useEffect(() => {
    void reload().catch((e: Error) => {
      if (isOperatorApiError(e)) setErr(`${errorDisplayLabel(e.code)}：${e.message}`);
      else setErr(e.message);
    });
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

  async function createTask() {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      if (live && liveBlock.disabled) {
        setErr(`Live Submit 禁用：${readiness.banner}（${liveBlock.reason}）`);
        return;
      }
      const t = await dataSource.createCaHolderTask(mint.trim() || (live ? "" : "demo-mint"));
      setNote(`已创建任务 ${t.taskId}（status=${t.status}）`);
      if (live) {
        nav(`/tasks/${encodeURIComponent(t.taskId)}`);
        return;
      }
      await reload();
    } catch (e) {
      if (isOperatorApiError(e)) setErr(`${errorDisplayLabel(e.code)}：${e.message}`);
      else setErr(e instanceof Error ? e.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>任务中心</h1>
      <div className={`banner ${live && !readiness.READY ? "warn" : ""}`} data-testid="readiness-banner">
        {live ? (
          <>
            <strong>{readiness.banner}</strong>
            {" · Live Wiring：任务经 loopback Operator API。浏览器无 Helius Key。"}
            {!readiness.READY && (
              <div className="muted" style={{ marginTop: 6 }}>
                Live Submit 已禁用 — {liveBlock.reason}
              </div>
            )}
          </>
        ) : (
          "Shell 阶段任务为静态 fixture + 本地 demo。发起任务不会触发 Helius / GMGN / RPC。"
        )}
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
            disabled={busy || (live && (!mint.trim() || liveBlock.disabled))}
            title={live && liveBlock.disabled ? liveBlock.reason : undefined}
            onClick={() => void createTask()}
          >
            {live ? (busy ? "提交中…" : "发起 CA Holder 任务") : "发起本地 demo 任务"}
          </button>
        </div>
        {note && <div className="muted">{note}</div>}
        {err && (
          <div className="error" data-testid="tasks-error">
            {err}
          </div>
        )}
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
                    {t.localOnly ? <div className="muted">local ref</div> : null}
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
