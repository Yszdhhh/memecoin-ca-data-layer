import { FixtureOperatorConsoleDataSource } from "./fixture-source";
import { HttpOperatorConsoleDataSource } from "./http-source";
import type { OperatorConsoleDataSource } from "./types";

/**
 * Fail-closed allowlist for browser Operator API base.
 * Only loopback origins — never remote hosts or credential-bearing URLs.
 */
export function allowOperatorApiBase(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (!["127.0.0.1", "localhost"].includes(u.hostname)) return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Fixture by default. HTTP Live Wiring when VITE_OPERATOR_API_BASE is set
 * (loopback Operator API only — never a provider key).
 */
export function resolveOperatorApiBase(): string | null {
  return allowOperatorApiBase(import.meta.env.VITE_OPERATOR_API_BASE as string | undefined);
}

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
