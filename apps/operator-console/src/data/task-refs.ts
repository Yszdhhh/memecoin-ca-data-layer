/**
 * Versioned local task-ref persistence for refresh recovery.
 * Only taskId / mint / createdAt / lastKnownStatus — never raw provider payload.
 */

export const TASK_REFS_STORAGE_KEY = "operator-console-task-refs-v1";
export const TASK_REFS_SCHEMA_VERSION = 1;
export const TASK_REFS_MAX = 20;
export const TASK_REFS_QUERY_CONCURRENCY = 2;

export interface TaskRef {
  taskId: string;
  mint: string;
  createdAt: string;
  lastKnownStatus: string;
}

export interface TaskRefsDocument {
  v: number;
  refs: TaskRef[];
}

const FORBIDDEN_REF_KEYS = new Set([
  "raw",
  "payload",
  "body",
  "response",
  "accounts",
  "owners",
  "providerPayload",
  "apiKey",
  "credential",
  "helius",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseRef(raw: unknown): TaskRef | null {
  if (!isPlainObject(raw)) return null;
  for (const k of Object.keys(raw)) {
    if (FORBIDDEN_REF_KEYS.has(k)) return null;
  }
  const taskId = raw.taskId;
  const mint = raw.mint;
  const createdAt = raw.createdAt;
  const lastKnownStatus = raw.lastKnownStatus;
  if (typeof taskId !== "string" || !taskId.trim()) return null;
  if (typeof mint !== "string") return null;
  if (typeof createdAt !== "string" || !createdAt.trim()) return null;
  if (typeof lastKnownStatus !== "string") return null;
  return {
    taskId: taskId.trim(),
    mint: mint.trim(),
    createdAt,
    lastKnownStatus: lastKnownStatus.trim() || "unknown",
  };
}

/** Fail-closed parse of localStorage document. */
export function parseTaskRefsDocument(raw: string | null | undefined): TaskRefsDocument {
  if (!raw) return { v: TASK_REFS_SCHEMA_VERSION, refs: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return { v: TASK_REFS_SCHEMA_VERSION, refs: [] };
    // Legacy: bare string[] of task ids — fail-closed (no mint) → empty
    if (Array.isArray(parsed)) return { v: TASK_REFS_SCHEMA_VERSION, refs: [] };

    const v = parsed.v;
    if (v !== TASK_REFS_SCHEMA_VERSION) {
      // Unknown schema version — fail closed rather than guess
      return { v: TASK_REFS_SCHEMA_VERSION, refs: [] };
    }
    const refsRaw = parsed.refs;
    if (!Array.isArray(refsRaw)) return { v: TASK_REFS_SCHEMA_VERSION, refs: [] };

    const refs: TaskRef[] = [];
    const seen = new Set<string>();
    for (const item of refsRaw) {
      const ref = parseRef(item);
      if (!ref || seen.has(ref.taskId)) continue;
      // Reject objects that smuggle raw payload fields alongside required ones
      if (isPlainObject(item)) {
        const extra = Object.keys(item).filter(
          (k) => !["taskId", "mint", "createdAt", "lastKnownStatus"].includes(k),
        );
        if (extra.some((k) => FORBIDDEN_REF_KEYS.has(k) || k.toLowerCase().includes("payload"))) {
          continue;
        }
      }
      seen.add(ref.taskId);
      refs.push(ref);
      if (refs.length >= TASK_REFS_MAX) break;
    }
    return { v: TASK_REFS_SCHEMA_VERSION, refs };
  } catch {
    return { v: TASK_REFS_SCHEMA_VERSION, refs: [] };
  }
}

export function loadTaskRefs(
  storage: Pick<Storage, "getItem"> = localStorage,
): TaskRef[] {
  return parseTaskRefsDocument(storage.getItem(TASK_REFS_STORAGE_KEY)).refs;
}

export function saveTaskRefs(
  refs: TaskRef[],
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  const cleaned: TaskRef[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    if (!r.taskId || seen.has(r.taskId)) continue;
    seen.add(r.taskId);
    cleaned.push({
      taskId: r.taskId,
      mint: r.mint ?? "",
      createdAt: r.createdAt,
      lastKnownStatus: r.lastKnownStatus ?? "unknown",
    });
    if (cleaned.length >= TASK_REFS_MAX) break;
  }
  const doc: TaskRefsDocument = { v: TASK_REFS_SCHEMA_VERSION, refs: cleaned };
  storage.setItem(TASK_REFS_STORAGE_KEY, JSON.stringify(doc));
}

export function upsertTaskRef(
  ref: TaskRef,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): TaskRef[] {
  const existing = loadTaskRefs(storage).filter((r) => r.taskId !== ref.taskId);
  const next = [
    {
      taskId: ref.taskId,
      mint: ref.mint ?? "",
      createdAt: ref.createdAt,
      lastKnownStatus: ref.lastKnownStatus,
    },
    ...existing,
  ].slice(0, TASK_REFS_MAX);
  saveTaskRefs(next, storage);
  return next;
}

export function updateTaskRefStatus(
  taskId: string,
  lastKnownStatus: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): void {
  const refs = loadTaskRefs(storage);
  const hit = refs.find((r) => r.taskId === taskId);
  if (!hit) return;
  hit.lastKnownStatus = lastKnownStatus;
  saveTaskRefs(refs, storage);
}

export function isTerminalTaskStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return ["completed", "partial", "failed", "blocked"].includes(s);
}

/**
 * Run async work over items with concurrency limit (default 2).
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      out[i] = await fn(items[i]!);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

/** Assert serialized ref blob has no forbidden payload keys (for tests). */
export function taskRefsBlobIsSafe(blob: string): boolean {
  const lower = blob.toLowerCase();
  if (lower.includes("providerpayload") || lower.includes("\"accounts\"")) return false;
  if (lower.includes("api_key") || lower.includes("apikey")) return false;
  if (lower.includes("helius_api")) return false;
  try {
    const doc = parseTaskRefsDocument(blob);
    return doc.refs.every(
      (r) =>
        Object.keys(r).every((k) =>
          ["taskId", "mint", "createdAt", "lastKnownStatus"].includes(k),
        ),
    );
  } catch {
    return false;
  }
}
