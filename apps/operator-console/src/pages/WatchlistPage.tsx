import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dataSource } from "../data/source";
import type { AlertView, WatchlistItemView } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";

export function WatchlistPage() {
  const [watches, setWatches] = useState<WatchlistItemView[]>([]);
  const [alerts, setAlerts] = useState<AlertView[]>([]);
  const [unread, setUnread] = useState(0);
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<"ca" | "address">("ca");
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    setWatches(await dataSource.listWatchlist());
    const a = await dataSource.listAlerts(false);
    setAlerts(a.items);
    setUnread(a.unreadCount);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onAdd() {
    try {
      await dataSource.addWatch({ kind, subject: subject.trim() });
      setMsg("已加入本地 watchlist（研究提醒，非交易信号）");
      setSubject("");
      await reload();
    } catch (e) {
      setMsg(`失败：${e instanceof Error ? e.message : "error"}`);
    }
  }

  return (
    <div>
      <h1>Watchlist / 本地提醒</h1>
      <div className="banner warn">
        Research notifications only · dedupe + cooldown · 无自动交易 · unread={unread} · mode=
        {dataSource.getDataSourceMeta().mode}
      </div>

      <div className="panel">
        <h2>添加关注</h2>
        <div className="form-row">
          <select value={kind} onChange={(e) => setKind(e.target.value as "ca" | "address")} aria-label="watch-kind">
            <option value="ca">CA mint</option>
            <option value="address">Address</option>
          </select>
          <input
            placeholder="mint 或 wallet"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="watch-subject"
          />
          <button className="primary" type="button" onClick={() => void onAdd()}>
            加入
          </button>
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>

      <div className="panel">
        <h2>Watchlist</h2>
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Subject</th>
              <th>Label</th>
              <th>Cooldown</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {watches.map((w) => (
              <tr key={w.watchId}>
                <td>{w.kind}</td>
                <td className="mono">
                  {w.kind === "ca" ? <Link to={`/ca/${w.subject}`}>{w.subject}</Link> : w.subject}
                </td>
                <td>{w.label ?? "—"}</td>
                <td>{w.cooldownMinutes}m</td>
                <td>
                  <TrustBadge label={w.enabled ? "ON" : "OFF"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {watches.length === 0 && <div className="empty">暂无关注项</div>}
      </div>

      <div className="panel">
        <h2>
          Alerts{" "}
          <button type="button" onClick={() => void dataSource.markAllAlertsRead().then(reload)}>
            全部已读
          </button>
        </h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Kind</th>
              <th>Summary</th>
              <th>Evidence</th>
              <th>Read</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.alertId}>
                <td className="mono muted">{a.createdAt}</td>
                <td>
                  <TrustBadge label={a.kind.toUpperCase()} />
                </td>
                <td>
                  {a.summary}
                  <div className="muted" style={{ fontSize: 11 }}>
                    {a.disclaimer}
                  </div>
                </td>
                <td>
                  {a.evidenceLink ? <Link to={a.evidenceLink}>open</Link> : "—"}
                  <div className="mono muted" style={{ fontSize: 11 }}>
                    {a.evidenceRefs.join(", ")}
                  </div>
                </td>
                <td>
                  {a.read ? (
                    "yes"
                  ) : (
                    <button type="button" onClick={() => void dataSource.markAlertRead(a.alertId).then(reload)}>
                      mark
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {alerts.length === 0 && <div className="empty">暂无提醒</div>}
      </div>
    </div>
  );
}
