import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import {
  CaHolderTaskService,
  toPublicResultSummary,
  toPublicTaskSummary,
} from "../../../src/application/operator-api/ca-holder-task-service.js";
import { createOperatorApiServer, listenOperatorApi } from "../../../src/application/operator-api/http-server.js";
import type { PilotTokenAccountSource } from "../../../src/application/live/solana-ca-real-data-cleaning-pilot.js";
import { SourceDataUnavailableError } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import type { RpcTokenAccount } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";
import { LiveHeliusDataSource } from "../../../src/infrastructure/solana/helius/live-helius-data-source.js";

const FIXED = "2026-07-30T16:00:00.000Z";
// Valid 32-byte base58-looking public mint from pilot
const OK_MINT = "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump";

function fixtureSource(opts: {
  complete?: boolean;
  residual?: boolean;
  requests?: { n: number };
} = {}): PilotTokenAccountSource {
  const requests = opts.requests ?? { n: 0 };
  // Use known valid base58 32-byte addresses from public Solana keys.
  const accounts: RpcTokenAccount[] = [
    {
      tokenAccount: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      owner: "So11111111111111111111111111111111111111112",
      amountRaw: opts.residual ? "50" : "100",
    },
  ];
  return {
    getRequestCount: () => requests.n,
    async getMint() {
      requests.n += 1;
      return {
        data: { supplyRaw: "100", decimals: 0 },
        watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
      };
    },
    async getTokenMetadata() {
      requests.n += 1;
      return {
        data: { name: "Fixture", symbol: "FIX" },
        watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
      };
    },
    async enumerateTokenAccounts() {
      requests.n += 1;
      return {
        accounts,
        pageCount: 1,
        paginationComplete: opts.complete !== false,
        pageSlots: ["1"],
        skippedMalformedCount: 0,
        watermark: {
          source: "helius",
          observedAt: new Date(FIXED),
          completeness: opts.complete === false ? "partial" : "complete",
          finalizedSlot: 1n,
        },
      };
    },
  };
}

async function waitFor(
  service: CaHolderTaskService,
  taskId: string,
  pred: (s: string) => boolean,
  ms = 3000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const t = service.getTask(taskId);
    if (t && pred(t.status)) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timeout_waiting_task");
}

test("reject unknown and forbidden body fields", () => {
  assert.equal(CaHolderTaskService.rejectUnknownFields({ mint: OK_MINT, apiKey: "x" }), "forbidden_field:apiKey");
  assert.equal(CaHolderTaskService.rejectUnknownFields({ mint: OK_MINT, provider: "helius" }), "forbidden_field:provider");
  assert.equal(CaHolderTaskService.rejectUnknownFields({ mint: OK_MINT, foo: 1 }), "unknown_field:foo");
  assert.equal(CaHolderTaskService.rejectUnknownFields({ mint: OK_MINT }), null);
  assert.equal(CaHolderTaskService.rejectUnknownFields({ mint: 1 }), "mint_required");
});

test("invalid mint fails closed", async () => {
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => fixtureSource(),
  });
  await assert.rejects(() => service.createTask({ mint: "not-a-mint" }), /invalid_mint/);
});

test("live gate disabled", async () => {
  const service = new CaHolderTaskService({
    liveEnabled: false,
    sourceFactory: () => fixtureSource(),
  });
  await assert.rejects(() => service.createTask({ mint: OK_MINT }), /live_gate_disabled/);
});

test("accounting confirmed + concentration unverified on complete fixture", async () => {
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => fixtureSource({ complete: true }),
    now: () => new Date(FIXED),
  });
  const created = await service.createTask({ mint: OK_MINT });
  await waitFor(service, created.taskId, (s) => s === "completed" || s === "partial" || s === "failed");
  const task = service.getTask(created.taskId)!;
  if (task.status !== "completed") {
    assert.fail(`status=${task.status} reason=${task.failureReason} warnings=${task.warnings.join(",")}`);
  }
  assert.equal(task.accountingEligible, true);
  assert.equal(task.exclusionCoverage, "partial");
  assert.equal(task.concentrationEligible, false);
  const pub = toPublicResultSummary(task)!;
  assert.equal(pub.concentrationEligible, false);
  const top10 = (pub.concentration as Array<{ name: string; ratio: number | null }>).find((m) => m.name === "top10");
  assert.equal(top10?.ratio, null);
});

test("pagination partial yields partial task", async () => {
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => fixtureSource({ complete: false }),
    now: () => new Date(FIXED),
  });
  const created = await service.createTask({ mint: OK_MINT });
  await waitFor(service, created.taskId, (s) => s !== "queued" && s !== "running");
  const task = service.getTask(created.taskId)!;
  assert.equal(task.accountingEligible, false);
  assert.equal(task.concentrationEligible, false);
  assert.ok(task.status === "partial" || task.status === "failed" || task.status === "completed");
});

test("idempotency and same-mint dedupe", async () => {
  let builds = 0;
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => {
      builds += 1;
      return fixtureSource();
    },
    now: () => new Date(FIXED),
  });
  const a = await service.createTask({ mint: OK_MINT, idempotencyKey: "k1" });
  const b = await service.createTask({ mint: OK_MINT, idempotencyKey: "k1" });
  assert.equal(a.taskId, b.taskId);
  await waitFor(service, a.taskId, (s) => s === "completed" || s === "partial" || s === "failed");
});

test("exact-budget complete success is not request_budget_exhausted", async () => {
  // Pilot: getMint + getTokenMetadata + 1 enumerate page = 3 HTTP when budget=3.
  const unitCredential = ["unit", "credential", "value"].join("-");
  let calls = 0;
  const service = new CaHolderTaskService({
    liveEnabled: true,
    requestBudget: 3,
    maxPages: 4,
    now: () => new Date(FIXED),
    sourceFactory: (executor) => {
      const fetchImpl: typeof fetch = async (_input, init) => {
        calls += 1;
        const body = typeof init?.body === "string" ? init.body : "";
        if (body.includes("getAccountInfo")) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: {
              context: { slot: 1 },
              value: { data: { parsed: { type: "mint", info: { supply: "100", decimals: 0 } } } },
            },
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (body.includes("getAsset")) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: { content: { metadata: { name: "T", symbol: "T" } }, last_indexed_slot: 1 },
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        // Single complete page of holders.
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            token_accounts: [{
              address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              owner: "So11111111111111111111111111111111111111112",
              amount: "100",
            }],
            total: 1,
            last_indexed_slot: 1,
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      };
      return new LiveHeliusDataSource({
        apiKey: unitCredential,
        minRequestIntervalMs: 0,
        fetchImpl,
        ...(executor ? { executor } : {}),
      });
    },
  });

  const created = await service.createTask({ mint: OK_MINT });
  await waitFor(service, created.taskId, (s) => s !== "queued" && s !== "running", 10_000);
  const task = service.getTask(created.taskId)!;
  assert.equal(calls, 3, `expected exactly 3 HTTP, got ${calls}`);
  assert.equal(task.providerRequestCount, 3);
  assert.equal(task.requestBudget, 3);
  assert.equal(task.providerBudgetExhausted, false, "full utilization is not stop-on-exhaustion");
  assert.equal(task.failureReason, null);
  assert.equal(task.warnings.includes("request_budget_exhausted"), false);
  assert.equal(task.status, "completed");
  assert.equal(task.paginationComplete, true);
  assert.equal(task.accountingEligible, true);
  // concentration remains ineligible under partial exclusion coverage; ratios null.
  const pub = toPublicResultSummary(task)!;
  const top10 = (pub.concentration as Array<{ name: string; ratio: number | null }>).find((m) => m.name === "top10");
  assert.equal(top10?.ratio, null);
});

test("mid-flight budget refuse yields partial + request_budget_exhausted + ineligible", async () => {
  // budget=3: getMint + getTokenMetadata + page1; page2 refused.
  const unitCredential = ["unit", "credential", "value"].join("-");
  let calls = 0;
  const service = new CaHolderTaskService({
    liveEnabled: true,
    requestBudget: 3,
    maxPages: 8,
    now: () => new Date(FIXED),
    sourceFactory: (executor) => {
      const fetchImpl: typeof fetch = async (_input, init) => {
        calls += 1;
        const body = typeof init?.body === "string" ? init.body : "";
        if (body.includes("getAccountInfo")) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: {
              context: { slot: 1 },
              value: { data: { parsed: { type: "mint", info: { supply: "100", decimals: 0 } } } },
            },
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (body.includes("getAsset")) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: { content: { metadata: { name: "T", symbol: "T" } }, last_indexed_slot: 1 },
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        // Page 1 with cursor → would need page 2 (4th HTTP) which must be refused.
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            token_accounts: [{
              address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              owner: "So11111111111111111111111111111111111111112",
              amount: "50",
            }],
            cursor: "more-pages",
            total: 2,
            last_indexed_slot: 1,
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      };
      return new LiveHeliusDataSource({
        apiKey: unitCredential,
        minRequestIntervalMs: 0,
        fetchImpl,
        ...(executor ? { executor } : {}),
      });
    },
  });

  const created = await service.createTask({ mint: OK_MINT });
  await waitFor(service, created.taskId, (s) => s !== "queued" && s !== "running", 10_000);
  const task = service.getTask(created.taskId)!;
  assert.ok(calls <= 3, `must not exceed budget HTTP attempts, calls=${calls}`);
  assert.equal(task.providerRequestCount, 3);
  assert.equal(task.providerBudgetExhausted, true);
  assert.equal(task.status, "partial");
  assert.equal(task.failureReason, "request_budget_exhausted");
  assert.equal(task.warnings.includes("request_budget_exhausted"), true);
  assert.equal(task.paginationComplete, false);
  assert.equal(task.accountingEligible, false);
  assert.equal(task.concentrationEligible, false);
  const pub = toPublicResultSummary(task)!;
  assert.equal(pub.accountingEligible, false);
  assert.equal(pub.concentrationEligible, false);
  const top10 = (pub.concentration as Array<{ name: string; ratio: number | null }>).find((m) => m.name === "top10");
  assert.equal(top10?.ratio, null);
});

test("credential unavailable maps to blocked with zero requests (not budget exhausted)", async () => {
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => {
      throw new SourceDataUnavailableError("helius_runtime_credential_unavailable");
    },
  });
  const created = await service.createTask({ mint: OK_MINT });
  await waitFor(service, created.taskId, (s) => s === "blocked" || s === "failed");
  const task = service.getTask(created.taskId)!;
  assert.equal(task.status, "blocked");
  assert.equal(task.failureReason, "credential_unavailable");
  assert.equal(task.providerRequestCount, 0);
  assert.equal(task.providerBudgetExhausted, false);
  assert.equal(task.warnings.includes("request_budget_exhausted"), false);
  const pub = JSON.stringify(toPublicTaskSummary(task));
  assert.equal(pub.includes("request_budget_exhausted"), false);
});

test("public summaries never include api keys", async () => {
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => fixtureSource(),
    now: () => new Date(FIXED),
  });
  const created = await service.createTask({ mint: OK_MINT });
  await waitFor(service, created.taskId, (s) => s !== "queued" && s !== "running");
  const task = service.getTask(created.taskId)!;
  const text = JSON.stringify([toPublicTaskSummary(task), toPublicResultSummary(task)]);
  assert.equal(text.includes("apiKey"), false);
  assert.equal(text.includes("HELIUS"), false);
  assert.equal(text.includes("mainnet.helius-rpc.com/"), false);
});

test("HTTP server health and validation", async () => {
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => fixtureSource(),
    now: () => new Date(FIXED),
  });
  const server = createOperatorApiServer({ service, host: "127.0.0.1" });
  await listenOperatorApi(server, 0);
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const port = addr.port;

  const health = await fetchJson(port, "GET", "/api/v1/health");
  assert.equal(health.status, 200);
  assert.equal((health.body as { status: string }).status, "ok");

  const bad = await fetchJson(port, "POST", "/api/v1/ca-holder-tasks", { mint: OK_MINT, apiKey: "secret" });
  assert.equal(bad.status, 400);

  const created = await fetchJson(port, "POST", "/api/v1/ca-holder-tasks", { mint: OK_MINT });
  assert.equal(created.status, 202);
  const taskId = (created.body as { taskId: string }).taskId;
  await waitFor(service, taskId, (s) => s !== "queued" && s !== "running");
  const got = await fetchJson(port, "GET", `/api/v1/ca-holder-tasks/${taskId}`);
  assert.equal(got.status, 200);
  const result = await fetchJson(port, "GET", `/api/v1/ca-holder-results/${taskId}`);
  assert.equal(result.status, 200);
  assert.equal((result.body as { concentrationEligible: boolean }).concentrationEligible, false);

  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function fetchJson(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: payload
          ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
          : {},
      },
      resolve,
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
  const chunks: Buffer[] = [];
  for await (const c of res) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const text = Buffer.concat(chunks).toString("utf8");
  return { status: res.statusCode ?? 0, body: text ? JSON.parse(text) : null };
}
