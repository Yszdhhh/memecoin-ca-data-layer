import { FixtureOperatorConsoleDataSource } from "./fixture-source";
import type { OperatorConsoleDataSource } from "./types";

/** Shell phase always uses fixtures. HTTP adapter is not activated here. */
export function createOperatorConsoleDataSource(): OperatorConsoleDataSource {
  return new FixtureOperatorConsoleDataSource();
}

export const dataSource = createOperatorConsoleDataSource();
