import { beforeEach, describe, expect, it } from "vitest";
import {
  isTerminalTaskStatus,
  loadTaskRefs,
  parseTaskRefsDocument,
  saveTaskRefs,
  TASK_REFS_MAX,
  TASK_REFS_STORAGE_KEY,
  taskRefsBlobIsSafe,
  upsertTaskRef,
} from "./task-refs";

describe("task-refs persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("refs persisted and hydrate after refresh", () => {
    upsertTaskRef({
      taskId: "t-1",
      mint: "Mint111",
      createdAt: "2026-07-31T00:00:00.000Z",
      lastKnownStatus: "running",
    });
    const loaded = loadTaskRefs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.taskId).toBe("t-1");
    expect(loaded[0]!.mint).toBe("Mint111");

    // simulate refresh
    const again = parseTaskRefsDocument(localStorage.getItem(TASK_REFS_STORAGE_KEY));
    expect(again.refs[0]!.taskId).toBe("t-1");
  });

  it("malformed storage handled fail-closed", () => {
    localStorage.setItem(TASK_REFS_STORAGE_KEY, "{not-json");
    expect(loadTaskRefs()).toEqual([]);
    localStorage.setItem(TASK_REFS_STORAGE_KEY, JSON.stringify({ v: 99, refs: [{ taskId: "x" }] }));
    expect(loadTaskRefs()).toEqual([]);
    localStorage.setItem(TASK_REFS_STORAGE_KEY, JSON.stringify(["legacy-id-only"]));
    expect(loadTaskRefs()).toEqual([]);
  });

  it("max 20 refs", () => {
    for (let i = 0; i < 30; i += 1) {
      upsertTaskRef({
        taskId: `t-${i}`,
        mint: `m-${i}`,
        createdAt: `2026-07-31T00:00:${String(i).padStart(2, "0")}.000Z`,
        lastKnownStatus: "queued",
      });
    }
    expect(loadTaskRefs().length).toBe(TASK_REFS_MAX);
  });

  it("terminal not repeatedly polled (helper)", () => {
    expect(isTerminalTaskStatus("completed")).toBe(true);
    expect(isTerminalTaskStatus("partial")).toBe(true);
    expect(isTerminalTaskStatus("failed")).toBe(true);
    expect(isTerminalTaskStatus("blocked")).toBe(true);
    expect(isTerminalTaskStatus("running")).toBe(false);
    expect(isTerminalTaskStatus("queued")).toBe(false);
  });

  it("API unavailable keeps refs", () => {
    upsertTaskRef({
      taskId: "keep-me",
      mint: "Mint",
      createdAt: "2026-07-31T00:00:00.000Z",
      lastKnownStatus: "running",
    });
    // even if we never update from API, refs remain
    expect(loadTaskRefs().some((r) => r.taskId === "keep-me")).toBe(true);
  });

  it("no raw payload stored", () => {
    upsertTaskRef({
      taskId: "t-safe",
      mint: "Mint",
      createdAt: "2026-07-31T00:00:00.000Z",
      lastKnownStatus: "completed",
    });
    const blob = localStorage.getItem(TASK_REFS_STORAGE_KEY)!;
    expect(taskRefsBlobIsSafe(blob)).toBe(true);
    expect(blob).not.toMatch(/accounts|providerPayload|apiKey/i);

    // smuggled payload keys rejected on parse
    saveTaskRefs([
      {
        taskId: "ok",
        mint: "m",
        createdAt: "2026-07-31T00:00:00.000Z",
        lastKnownStatus: "queued",
      },
    ]);
    const poisoned = JSON.stringify({
      v: 1,
      refs: [
        {
          taskId: "bad",
          mint: "m",
          createdAt: "2026-07-31T00:00:00.000Z",
          lastKnownStatus: "queued",
          providerPayload: { accounts: [1, 2, 3] },
        },
      ],
    });
    const parsed = parseTaskRefsDocument(poisoned);
    expect(parsed.refs).toEqual([]);
  });
});
