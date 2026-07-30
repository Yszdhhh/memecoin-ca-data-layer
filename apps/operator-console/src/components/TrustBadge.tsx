import { trustClass } from "../lib/format";

export function TrustBadge({ label, title }: { label: string; title?: string }) {
  return (
    <span className={`badge ${trustClass(label)}`} title={title}>
      <span aria-hidden="true">●</span>
      {label}
    </span>
  );
}
