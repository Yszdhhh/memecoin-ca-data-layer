import { useMemo } from "react";

/**
 * LIQUIDITY-DASHBOARD-V1 — fixture/offline surface.
 * Does not couple CA hotpath refresh. Nulls stay visible as "—".
 */
const FIXTURE = {
  observedAt: "2026-07-30T00:00:00.000Z",
  freshness: "stale" as const,
  source: "fixture_offline",
  metrics: {
    dexVolumeUsd: 12_500_000,
    swapCount: 420_000,
    activeAddresses: 88_000,
    newTokens: 1200,
    graduatedTokens: 45,
    newPools: 900,
    protocolRevenueUsd: null as number | null,
    compositeLevel: null as number | null,
  },
  warnings: ["live_dune_owner_gated", "composite_withheld_or_fixture"],
};

function cell(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : String(v);
}

export function LiquidityPage() {
  const rows = useMemo(
    () => [
      ["DEX volume USD", FIXTURE.metrics.dexVolumeUsd],
      ["Swaps", FIXTURE.metrics.swapCount],
      ["Active addresses", FIXTURE.metrics.activeAddresses],
      ["New tokens", FIXTURE.metrics.newTokens],
      ["Graduated", FIXTURE.metrics.graduatedTokens],
      ["New pools", FIXTURE.metrics.newPools],
      ["Protocol revenue USD", FIXTURE.metrics.protocolRevenueUsd],
      ["Composite level", FIXTURE.metrics.compositeLevel],
    ],
    [],
  );

  return (
    <div>
      <h1>流动性水位</h1>
      <div className="banner warn">
        与 CA 热路径独立 · source={FIXTURE.source} · freshness={FIXTURE.freshness} · Live Dune 需 Owner 凭据
      </div>
      <div className="panel">
        <div className="kv">
          <div className="k">observedAt</div>
          <div className="mono">{FIXTURE.observedAt}</div>
          <div className="k">freshness</div>
          <div>{FIXTURE.freshness}</div>
        </div>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={String(k)}>
                <td>{k}</td>
                <td className="mono">{cell(v as number | null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>Warnings</h2>
        <ul>
          {FIXTURE.warnings.map((w) => (
            <li key={w} className="mono">
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
