import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dataSource } from "../data/source";
import type { AddressLabelViewModel } from "../data/types";
import { TrustBadge } from "../components/TrustBadge";

export function AddressesPage() {
  const [items, setItems] = useState<AddressLabelViewModel[]>([]);
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [addressId, setAddressId] = useState("demo-addr-1");
  const [label, setLabel] = useState("operator_note");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    setItems(await dataSource.listAddressLabels());
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (a) =>
        a.id.toLowerCase().includes(s) ||
        a.display.toLowerCase().includes(s) ||
        a.note.toLowerCase().includes(s) ||
        a.labels.some((l) => l.label.toLowerCase().includes(s)),
    );
  }, [items, q]);

  async function onSave() {
    await dataSource.saveLocalDemoLabel({ addressId, label, note });
    setMsg("已写入浏览器 localStorage 演示库（非生产数据库）");
    await reload();
  }

  return (
    <div>
      <h1>地址库（本地演示）</h1>
      <div className="banner warn">Local demo data — not persisted to production database</div>
      <div className="panel">
        <div className="form-row">
          <input
            placeholder="搜索 id / 标签 / 备注"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="address-search"
          />
        </div>
      </div>
      <div className="panel">
        <h2>增加演示标签 / 备注</h2>
        <div className="form-row">
          <input value={addressId} onChange={(e) => setAddressId(e.target.value)} aria-label="address-id" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="label" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" aria-label="note" />
          <button className="primary" type="button" onClick={() => void onSave()}>
            保存到 demo store
          </button>
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Display</th>
              <th>Labels</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.id}</td>
                <td>{a.display}</td>
                <td>
                  {a.labels.map((l, i) => (
                    <div key={`${l.label}-${i}`}>
                      {l.label} · {l.source} · conf={l.confidence}{" "}
                      <TrustBadge label={l.verificationStatus.toUpperCase()} />
                    </div>
                  ))}
                </td>
                <td>{a.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">无匹配地址</div>}
      </div>
    </div>
  );
}
