/**
 * OBSERVABILITY-BASELINE-001 — structured, scrubbed logs.
 * Never log full URLs with query secrets, API keys, or raw provider payloads.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLogEvent {
  level: LogLevel;
  msg: string;
  taskId?: string;
  provider?: string;
  operation?: string;
  latencyMs?: number;
  status?: string;
  errorClass?: string;
  sourceWatermark?: string | null;
  [key: string]: unknown;
}

const SECRET_KEY = /(api[_-]?key|authorization|password|private[_-]?key|credential|secret|token)/i;
const QUERY_SECRET = /([?&](api[_-]?key|key|access_token|token)=)[^&\s]+/gi;

export function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(QUERY_SECRET, "$1***").slice(0, 500);
  }
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "***" : scrubValue(v);
    }
    return out;
  }
  return value;
}

export function emitStructuredLog(event: StructuredLogEvent, sink: (line: string) => void = console.log): void {
  const cleaned = scrubValue({
    ts: new Date().toISOString(),
    ...event,
  }) as Record<string, unknown>;
  sink(JSON.stringify(cleaned));
}

export function classifyProviderError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/credential|api[_-]?key|unauthorized|401/i.test(msg)) return "credential";
  if (/429|rate.?limit|too many/i.test(msg)) return "rate_limit";
  if (/timeout|ETIMEDOUT|ABORT/i.test(msg)) return "timeout";
  if (/ECONN|network|fetch failed/i.test(msg)) return "network";
  if (/partial|pagination|incomplete/i.test(msg)) return "partial";
  return "provider_error";
}
