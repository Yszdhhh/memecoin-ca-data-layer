import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import {
  CaHolderTaskService,
} from "../../../src/application/operator-api/ca-holder-task-service.js";
import { createOperatorApiServer, listenOperatorApi } from "../../../src/application/operator-api/http-server.js";
import type { PilotTokenAccountSource } from "../../../src/application/live/solana-ca-real-data-cleaning-pilot.js";
import type { RpcTokenAccount } from "../../../src/infrastructure/solana/helius/helius-solana-adapter.js";

const FIXED = "2026-07-30T16:00:00.000Z";
const OK_MINT = "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump";

function fixtureSource(): PilotTokenAccountSource {
  const accounts: RpcTokenAccount[] = [
    {
      tokenAccount: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      owner: "So11111111111111111111111111111111111111112",
      amountRaw: "100",
    },
  ];
  let n = 0;
  return {
    getRequestCount: () => n,
    async getMint() {
      n += 1;
      return {
        data: { supplyRaw: "100", decimals: 0 },
        watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
      };
    },
    async getTokenMetadata() {
      n += 1;
      return {
        data: { name: "Fixture", symbol: "FIX" },
        watermark: { source: "helius", observedAt: new Date(FIXED), completeness: "complete", finalizedSlot: 1n },
      };
    },
    async enumerateTokenAccounts() {
      n += 1;
      return {
        accounts,
        pageCount: 1,
        paginationComplete: true,
        pageSlots: ["1"],
        skippedMalformedCount: 0,
        watermark: {
          source: "helius",
          observedAt: new Date(FIXED),
          completeness: "complete",
          finalizedSlot: 1n,
        },
      };
    },
  };
}

async function startServer(): Promise<{ port: number; server: http.Server; service: CaHolderTaskService }> {
  const service = new CaHolderTaskService({
    liveEnabled: true,
    sourceFactory: () => fixtureSource(),
    now: () => new Date(FIXED),
  });
  const server = createOperatorApiServer({ service, host: "127.0.0.1" });
  await listenOperatorApi(server, 0);
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  return { port: addr.port, server, service };
}

async function rawRequest(
  port: number,
  opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
    host?: string;
  },
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: opts.path,
        method: opts.method,
        headers: {
          host: opts.host ?? `127.0.0.1:${port}`,
          ...(opts.headers ?? {}),
          ...(opts.body !== undefined
            ? { "content-length": Buffer.byteLength(opts.body) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

test("trusted localhost Origin accepted", async () => {
  const { port, server } = await startServer();
  try {
    const res = await rawRequest(port, {
      method: "POST",
      path: "/api/v1/ca-holder-tasks",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:5173",
      },
      body: JSON.stringify({ mint: OK_MINT }),
    });
    assert.equal(res.status, 202);
    assert.equal(res.headers["access-control-allow-origin"], "http://127.0.0.1:5173");
    assert.notEqual(res.headers["access-control-allow-origin"], "*");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("cross-site Origin rejected", async () => {
  const { port, server } = await startServer();
  try {
    const res = await rawRequest(port, {
      method: "POST",
      path: "/api/v1/ca-holder-tasks",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ mint: OK_MINT }),
    });
    assert.equal(res.status, 403);
    assert.match(res.body, /origin_not_allowed/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("Sec-Fetch-Site: cross-site rejected", async () => {
  const { port, server } = await startServer();
  try {
    const res = await rawRequest(port, {
      method: "POST",
      path: "/api/v1/ca-holder-tasks",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ mint: OK_MINT }),
    });
    assert.equal(res.status, 403);
    assert.match(res.body, /cross_site_forbidden/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("text/plain POST rejected; application/json accepted", async () => {
  const { port, server } = await startServer();
  try {
    const plain = await rawRequest(port, {
      method: "POST",
      path: "/api/v1/ca-holder-tasks",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ mint: OK_MINT }),
    });
    assert.equal(plain.status, 415);

    const ok = await rawRequest(port, {
      method: "POST",
      path: "/api/v1/ca-holder-tasks",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mint: OK_MINT }),
    });
    assert.equal(ok.status, 202);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("unknown field and client-provided key rejected", async () => {
  const { port, server } = await startServer();
  try {
    const unknown = await rawRequest(port, {
      method: "POST",
      path: "/api/v1/ca-holder-tasks",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mint: OK_MINT, foo: 1 }),
    });
    assert.equal(unknown.status, 400);
    assert.match(unknown.body, /unknown_field/);

    const key = await rawRequest(port, {
      method: "POST",
      path: "/api/v1/ca-holder-tasks",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mint: OK_MINT, apiKey: "secret" }),
    });
    assert.equal(key.status, 400);
    assert.match(key.body, /forbidden_field/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("non-loopback Host rejected", async () => {
  const { port, server } = await startServer();
  try {
    const res = await rawRequest(port, {
      method: "GET",
      path: "/api/v1/health",
      host: "evil.example",
    });
    assert.equal(res.status, 403);
    assert.match(res.body, /host_not_allowed/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("CORS wildcard absent (OPTIONS only for allowlisted origin)", async () => {
  const { port, server } = await startServer();
  try {
    const bad = await rawRequest(port, {
      method: "OPTIONS",
      path: "/api/v1/ca-holder-tasks",
      headers: { origin: "https://evil.example" },
    });
    assert.equal(bad.status, 403);

    const good = await rawRequest(port, {
      method: "OPTIONS",
      path: "/api/v1/ca-holder-tasks",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
      },
    });
    assert.equal(good.status, 204);
    assert.equal(good.headers["access-control-allow-origin"], "http://localhost:5173");
    assert.notEqual(good.headers["access-control-allow-origin"], "*");
    const allHeaderValues = JSON.stringify(good.headers);
    assert.equal(allHeaderValues.includes("\"*\""), false);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
