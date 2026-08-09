/**
 * Canonical runtime type guard for JSON-shaped payloads parsed at provider
 * boundaries. Single project definition (rule: ts-no-local-is-record) —
 * import it instead of redefining a local guard at each call site.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
