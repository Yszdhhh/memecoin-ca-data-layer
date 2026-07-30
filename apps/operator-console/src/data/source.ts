import { FixtureOperatorConsoleDataSource } from "./fixture-source";
import { HttpOperatorConsoleDataSource } from "./http-source";
import type { OperatorConsoleDataSource } from "./types";

/**
 * Fixture by default (shell). Set VITE_OPERATOR_API_BASE=http://127.0.0.1:8787
 * to use local Operator API (keys never enter the browser bundle).
 */
export function createOperatorConsoleDataSource(): OperatorConsoleDataSource {
  const base = (import.meta.env.VITE_OPERATOR_API_BASE as string | undefined)?.trim();
  if (base) {
    return new HttpOperatorConsoleDataSource(base.replace(/\/$/, ""), {
      liveLabel: import.meta.env.VITE_OPERATOR_API_LIVE_LABEL === "1",
    });
  }
  return new FixtureOperatorConsoleDataSource();
}

export const dataSource = createOperatorConsoleDataSource();
