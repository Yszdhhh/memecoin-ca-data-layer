/**
 * Owner-decided retention (OWNER_DECISIONS_NEEDED.md items 15 / 2026-07-27).
 * Live collectors must honor these defaults; offline fixtures are long-term by nature.
 */
export const RETENTION_POLICY_VERSION = "retention-policy-v1";

/** Raw provider payloads after secret scrubbing. */
export const RAW_PAYLOAD_RETENTION_DAYS = 7;

/**
 * Structured Observation rows, evidence indexes, and cleaned replay fixtures
 * are retained long-term (no automatic purge in application code).
 */
export const STRUCTURED_EVIDENCE_RETENTION = "long_term" as const;

export function rawPayloadExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RAW_PAYLOAD_RETENTION_DAYS * 86_400_000);
}
