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
    const t = await dataSource.createLocalDemoTask(mint.trim() || "demo-mint");
    setNote(`已创建本地 demo task ${t.taskId}（未调用 Helius / 无网络）`);
    await reload();
  }

  return (
    <div>
      <h1>任务中心</h1>
      <div className="banner">
        Shell 阶段任务为静态 fixture + 本地 demo。发起任务不会触发 Helius / GMGN / RPC。
      </div>
      <div className="panel">
        <div className="form-row">
          <input
            placeholder="可选 mint（仅写入本地 demo task）"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            aria-label="demo-task-mint"
          />
          <button className="primary" type="button" onClick={() => void createDemo()}>
            发起本地 demo 任务
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
