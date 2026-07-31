import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { dataSource, resolveOperatorApiBase } from "../data/source";
import { emptyReadiness, probeReadiness, type ReadinessFlags } from "../data/readiness";

export function Layout() {
  const meta = dataSource.getDataSourceMeta();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [readiness, setReadiness] = useState<ReadinessFlags>(() => emptyReadiness());
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

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (v.startsWith("fp-") || v.startsWith("demo-")) {
      nav(`/wallets/${encodeURIComponent(v)}`);
      return;
    }
    if (v.length >= 32) {
      nav(`/ca/${encodeURIComponent(v)}`);
      return;
    }
    nav(`/addresses?q=${encodeURIComponent(v)}`);
  }

  const chip =
    meta.mode === "fixture"
      ? `source: fixture · live=false`
      : `source: http · ${readiness.READY ? "Ready" : readiness.banner}`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Operator Console</div>
        <div className="brand-sub">
          memecoin-ca-data-layer · {meta.live ? "G1 Live Wiring" : "Shell / Fixture"}
        </div>
        <nav className="nav">
          <NavLink to="/ca" className={({ isActive }) => (isActive ? "active" : "")}>
            CA 分析
          </NavLink>
          <NavLink to="/wallets" className={({ isActive }) => (isActive ? "active" : "")}>
            钱包库
          </NavLink>
          <NavLink to="/addresses" className={({ isActive }) => (isActive ? "active" : "")}>
            地址库
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => (isActive ? "active" : "")}>
            任务中心
          </NavLink>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <form onSubmit={onSearch} style={{ display: "flex", flex: 1, gap: 8 }}>
            <input
              placeholder="全局搜索：CA mint / wallet id / 地址关键词"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="global-search"
            />
            <button type="submit">搜索</button>
          </form>
          <span className="meta-chip" title={meta.note} data-testid="source-chip">
            {chip}
          </span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
