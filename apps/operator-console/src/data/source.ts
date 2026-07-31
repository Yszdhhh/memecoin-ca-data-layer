import { FixtureOperatorConsoleDataSource } from "./fixture-source";
import { HttpOperatorConsoleDataSource } from "./http-source";
import type { OperatorConsoleDataSource } from "./types";
import { allowOperatorApiBase, resolveOperatorApiBase } from "./api-base";

export { allowOperatorApiBase, resolveOperatorApiBase };

/**
 * Fixture by default. HTTP Live Wiring when VITE_OPERATOR_API_BASE is set
 * (loopback Operator API only — never a provider key).
 */
export function createOperatorConsoleDataSource(): OperatorConsoleDataSource {
  const base = resolveOperatorApiBase();
  if (base) return new HttpOperatorConsoleDataSource(base);
  return new FixtureOperatorConsoleDataSource();
}

export const dataSource = createOperatorConsoleDataSource();

export function isHttpLiveSource(
  ds: OperatorConsoleDataSource,
): ds is HttpOperatorConsoleDataSource {
  return ds.getDataSourceMeta().mode === "http";
}
