import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { dataSource, isHttpLiveSource, resolveOperatorApiBase } from "../data/source";
import type { TaskViewModel } from "../data/types";
import { describeTaskTerminalState, type PublicTaskSummary } from "../data/live-api-map";
import { TrustBadge } from "../components/TrustBadge";
import { errorDisplayLabel, isOperatorApiError, type OperatorApiErrorCode } from "../data/api-error";
import {
  emptyReadiness,
  probeReadiness,
  readinessBlocksLiveSubmit,
  type ReadinessFlags,
} from "../data/readiness";

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const [task, setTask] = useState<TaskViewModel | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<OperatorApiErrorCode | null>(null);
  const [busyRetry, setBusyRetry] = useState(false);
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
    let cancelled = false;
    setTask(undefined);
    setErr(null);
    setErrCode(null);

    async function load() {
      try {
        const t = await dataSource.getTask(taskId);
        if (cancelled) return;
        setTask(t);
        if (
          t &&
          isHttpLiveSource(dataSource) &&
          (t.status === "queued" || t.status === "running")
        ) {
          const polled = await dataSource.pollTask(taskId, { maxAttempts: 40, intervalMs: 700 });
          if (!cancelled) setTask(polled);
        }
      } catch (e) {
        if (cancelled) return;
        if (isOperatorApiError(e)) {
          setErrCode(e.code);
          setErr(`${errorDisplayLabel(e.code)}：${e.message}`);
        } else {
          setErr(e instanceof Error ? e.message : "load_failed");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const liveBlock = readinessBlocksLiveSubmit(readiness);

  async function retryNewTask() {
    if (!task) return;
    const mint = task.input.mint?.trim();
    if (!mint) return;
    if (liveBlock.disabled) {
      setErr(`Retry 禁用：${readiness.banner}`);
      return;
    }
    const previousTaskId = task.taskId;
    setBusyRetry(true);
    setErr(null);
    try {
      // Retry creates a NEW taskId — never mutates the previous task.
      const next = await dataSource.createCaHolderTask(mint, {
        idempotencyKey: `retry:${previousTaskId}:${Date.now()}`,
      });
      nav(`/tasks/${encodeURIComponent(next.taskId)}`);
    } catch (e) {
      if (isOperatorApiError(e)) setErr(`${errorDisplayLabel(e.code)}：${e.message}`);
      else setErr(e instanceof Error ? e.message : "retry_failed");
    } finally {
      setBusyRetry(false);
    }
  }

  if (err && task === undefined) {
    return (
      <div className="error" data-testid="task-error">
        {errCode ? `${errorDisplayLabel(errCode)}` : "加载失败"}：{err}
        <div style={{ marginTop: 10 }}>
          <Link to="/tasks">返回任务中心</Link>
        </div>
      </div>
    );
  }
  if (task === undefined) return <div className="loading">加载任务…</div>;
  if (task === null) {
    return (
      <div className="empty" data-testid="task-not-found">
        未找到任务：<span className="mono">{taskId}</span>
        <div className="muted" style={{ marginTop: 8 }}>
          （仅真实 HTTP 404 → not_found；API 不可达等错误会显示为独立状态，不会折叠到此处）
        </div>
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
    providerRequestCount: task.providerRequestCount,
    pageCount: task.pageCount ?? undefined,
    retryCount: task.retryCount ?? undefined,
    timeoutCount: task.timeoutCount ?? undefined,
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
      {err && (
        <div className="error" data-testid="task-error">
          {err}
        </div>
      )}

      <div className="panel">
        <div className="kv">
          <div className="k">status</div>
          <div>
            <TrustBadge label={terminal.label} />
            <div className="muted" style={{ marginTop: 4 }}>
              原因：{task.failureReason ?? terminal.kind}
              {terminal.mapsToTaskStatus === "partial" && terminal.kind === "budget_exhausted"
                ? " · budget exhausted 映射为 partial（非 failed）"
                : ""}
            </div>
          </div>
          <div className="k">mint</div>
          <div className="mono">{task.input.mint ?? "—"}</div>
          <div className="k">provider</div>
          <div>{task.provider}</div>
          <div className="k">budget / requests</div>
          <div>
            used {task.requestsUsed}/{task.requestBudget}
            {task.providerRequestCount != null
              ? ` · providerRequestCount=${task.providerRequestCount}`
              : ""}
          </div>
          <div className="k">page / retry / timeout</div>
          <div className="mono muted">
            page={task.pageCount ?? "—"} · retry={task.retryCount ?? "—"} · timeout=
            {task.timeoutCount ?? "—"}
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
          <div className="k">actions</div>
          <div>
            <button
              type="button"
              className="primary"
              disabled={busyRetry || !task.input.mint || liveBlock.disabled}
              title={
                liveBlock.disabled
                  ? liveBlock.reason
                  : "创建新 taskId，不篡改当前任务"
              }
              onClick={() => void retryNewTask()}
            >
              {busyRetry ? "重试中…" : "Retry（新 task）"}
            </button>
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
