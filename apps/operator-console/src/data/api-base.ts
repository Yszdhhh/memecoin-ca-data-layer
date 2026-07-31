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

export function resolveOperatorApiBase(): string | null {
  return allowOperatorApiBase(import.meta.env.VITE_OPERATOR_API_BASE as string | undefined);
}
