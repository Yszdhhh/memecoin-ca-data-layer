export type GmgnWalletStatsEnvelopeKind =
  | "top_level_record"
  | "top_level_record_list"
  | "data_record"
  | "data_record_list"
  | "result_record"
  | "result_record_list"
  | "wallet_keyed_record"
  | "unrecognized";

export interface GmgnWalletStatsEnvelopeDiagnostic {
  envelopeKind: GmgnWalletStatsEnvelopeKind;
  requestedWalletCount: number;
  candidateRecordCount: number;
  recordsWithIdentityCount: number;
  requestedIdentityMatchCount: number;
  requestedIdentityMissingCount: number;
  duplicateRequestedIdentityCount: number;
  identitylessRecordCount: number;
  responseCoversAllRequestedWallets: boolean;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function identityOf(record: JsonRecord): string | null {
  for (const key of ["wallet", "address", "wallet_address", "user_address"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function recordsFromArray(value: unknown): JsonRecord[] {
  return (asArray(value) ?? []).map(asRecord).filter((value): value is JsonRecord => value !== null);
}

function discover(payload: unknown, requested: ReadonlySet<string>): { kind: GmgnWalletStatsEnvelopeKind; records: JsonRecord[] } {
  const topList = recordsFromArray(payload);
  if (topList.length > 0) return { kind: "top_level_record_list", records: topList };

  const root = asRecord(payload);
  if (!root) return { kind: "unrecognized", records: [] };

  const rootIdentity = identityOf(root);
  if (rootIdentity !== null) return { kind: "top_level_record", records: [root] };

  const dataList = recordsFromArray(root.data);
  if (dataList.length > 0) return { kind: "data_record_list", records: dataList };
  const resultList = recordsFromArray(root.result);
  if (resultList.length > 0) return { kind: "result_record_list", records: resultList };

  const data = asRecord(root.data);
  if (data) {
    const identity = identityOf(data);
    if (identity !== null) return { kind: "data_record", records: [data] };
    for (const key of ["rows", "list", "wallets", "records", "results", "data"]) {
      const rows = recordsFromArray(data[key]);
      if (rows.length > 0) return { kind: "data_record_list", records: rows };
    }
  }

  const result = asRecord(root.result);
  if (result) {
    const identity = identityOf(result);
    if (identity !== null) return { kind: "result_record", records: [result] };
    for (const key of ["rows", "list", "wallets", "records", "results", "data"]) {
      const rows = recordsFromArray(result[key]);
      if (rows.length > 0) return { kind: "result_record_list", records: rows };
    }
  }

  const keyedRecords: JsonRecord[] = [];
  for (const wallet of requested) {
    const candidates = [root[wallet], data?.[wallet], result?.[wallet]];
    for (const candidate of candidates) {
      const record = asRecord(candidate);
      if (record) { keyedRecords.push(record); break; }
    }
  }
  if (keyedRecords.length > 0) return { kind: "wallet_keyed_record", records: keyedRecords };

  return { kind: "unrecognized", records: [] };
}

export function summarizeGmgnWalletStatsEnvelope(
  payload: unknown,
  requestedWallets: readonly string[],
): GmgnWalletStatsEnvelopeDiagnostic {
  const requested = new Set(requestedWallets);
  const { kind, records } = discover(payload, requested);
  const matchedCounts = new Map<string, number>();
  let recordsWithIdentityCount = 0;
  let identitylessRecordCount = 0;
  for (const record of records) {
    const identity = identityOf(record);
    if (identity === null) { identitylessRecordCount += 1; continue; }
    recordsWithIdentityCount += 1;
    if (requested.has(identity)) matchedCounts.set(identity, (matchedCounts.get(identity) ?? 0) + 1);
  }
  const requestedIdentityMatchCount = matchedCounts.size;
  let duplicateRequestedIdentityCount = 0;
  for (const count of matchedCounts.values()) duplicateRequestedIdentityCount += Math.max(0, count - 1);
  return {
    envelopeKind: kind,
    requestedWalletCount: requested.size,
    candidateRecordCount: records.length,
    recordsWithIdentityCount,
    requestedIdentityMatchCount,
    requestedIdentityMissingCount: Math.max(0, requested.size - requestedIdentityMatchCount),
    duplicateRequestedIdentityCount,
    identitylessRecordCount,
    responseCoversAllRequestedWallets: requested.size > 0 && requestedIdentityMatchCount === requested.size,
  };
}
