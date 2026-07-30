import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dataSource } from "../data/source";
import type { TaskViewModel } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskViewModel[]>([]);
  const [mint, setMint] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function reload() {
    setTasks(await dataSource.listTasks());
  }

  useEffect(() => {
    void reload();
  }, []);

  async function createDemo() {
    try {
      const t = await dataSource.createLocalDemoTask(mint.trim() || "demo-mint");
      const meta = dataSource.getDataSourceMeta();
      setNote(
        meta.mode === "http"
          ? `已提交本地 API 任务 ${t.taskId}（status=${t.status}；凭据仅服务端；${t.failureReason ?? "ok"}）`
          : `已创建本地 demo task ${t.taskId}（fixture 模式，未调用 Helius）`,
      );
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      setNote(`任务失败：${msg}（live_gate_disabled / credential_unavailable / invalid_mint 均为预期 fail-closed）`);
    }
  }

  const meta = dataSource.getDataSourceMeta();

  return (
    <div>
      <h1>任务中心</h1>
      <div className="banner">
        数据源：{meta.mode} · live={String(meta.live)} · {meta.note}
      </div>
      <div className="panel">
        <div className="form-row">
          <input
            placeholder="Solana mint（HTTP 模式走本地 Operator API）"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            aria-label="demo-task-mint"
          />
          <button className="primary" type="button" onClick={() => void createDemo()}>
            发起 CA 任务
          </button>
        </div>
        {note && <div className="muted">{note}</div>}
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
            {tasks.map((t) => (
              <tr key={t.taskId}>
                <td className="mono">{t.taskId}</td>
                <td className="mono">{t.input.mint ?? "—"}</td>
                <td>{t.provider}</td>
                <td>
                  {t.requestsUsed}/{t.requestBudget}
                </td>
                <td>
                  <TrustBadge label={t.status.toUpperCase()} />
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
