import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataSource, isHttpLiveSource } from "../data/source";
import type { TaskViewModel } from "../data/types";
import { describeTaskTerminalState, type PublicTaskSummary } from "../data/live-api-map";
import { TrustBadge } from "../components/TrustBadge";

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const [task, setTask] = useState<TaskViewModel | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const meta = dataSource.getDataSourceMeta();

  useEffect(() => {
    let cancelled = false;
    setTask(undefined);
    setErr(null);

    async function load() {
      try {
        const t = await dataSource.getTask(taskId);
        if (cancelled) return;
        setTask(t);
        // Poll while non-terminal in Live mode
        if (
          t &&
          isHttpLiveSource(dataSource) &&
          (t.status === "queued" || t.status === "running")
        ) {
          const polled = await dataSource.pollTask(taskId, { maxAttempts: 40, intervalMs: 700 });
          if (!cancelled) setTask(polled);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "load_failed");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (err) return <div className="error">加载失败：{err}</div>;
  if (task === undefined) return <div className="loading">加载任务…</div>;
  if (task === null) {
    return (
      <div className="empty">
        未找到任务：<span className="mono">{taskId}</span>
        <div style={{ marginTop: 10 }}>
          <Link to="/tasks">返回任务中心</Link>
        </div>
      </div>
    );
  }

  const terminal = describeTaskTerminalState({
    taskId: task.taskId,
    mint: task.input.mint ?? "",
    status: task.status,
    requestBudget: task.requestBudget,
    requestsUsed: task.requestsUsed,
    startedAt: task.startedAt,
    endedAt: task.endedAt,
    warnings: task.warnings,
    failureReason: task.failureReason,
    providerBudgetExhausted: task.warnings.some((w) =>
      String(w).toLowerCase().includes("budget"),
    ),
  } satisfies PublicTaskSummary);

  return (
    <div>
      <h1>
        任务详情 · <span className="mono">{task.taskId}</span>
      </h1>
      <div className={`banner ${meta.live ? "warn" : ""}`}>
        数据源：{meta.note} · UI state: {terminal.label}
        {meta.live ? " · Live 路径：仅 loopback Operator API，浏览器无 Helius Key" : ""}
      </div>

      <div className="panel">
        <div className="kv">
          <div className="k">status</div>
          <div>
            <TrustBadge label={terminal.label} />
          </div>
          <div className="k">mint</div>
          <div className="mono">{task.input.mint ?? "—"}</div>
          <div className="k">provider</div>
          <div>{task.provider}</div>
          <div className="k">budget</div>
          <div>
            {task.requestsUsed}/{task.requestBudget}
          </div>
          <div className="k">started / ended</div>
          <div className="mono muted">
            {task.startedAt ?? "—"}
            <br />
            {task.endedAt ?? "—"}
          </div>
          <div className="k">warnings</div>
          <div className="mono muted">{task.warnings.join(", ") || "—"}</div>
          <div className="k">failure</div>
          <div className="mono">{task.failureReason ?? "—"}</div>
          <div className="k">output</div>
          <div>
            {task.outputLink ? <Link to={task.outputLink}>打开 CA 结果</Link> : "—"}
          </div>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 12 }}>
        <Link to="/tasks">← 任务中心</Link>
        {task.input.mint ? (
          <>
            {" · "}
            <Link to={`/ca/${encodeURIComponent(task.input.mint)}`}>CA 详情</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
