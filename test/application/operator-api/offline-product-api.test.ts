import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CaHolderTaskService } from "../../../src/application/operator-api/ca-holder-task-service.js";
import { createOperatorApiServer, listenOperatorApi } from "../../../src/application/operator-api/http-server.js";
import { OfflineBackend, OFFLINE_DEMO_MINT } from "../../../src/application/operator-api/offline-backend.js";
import { buildLiquiditySnapshotV1 } from "../../../src/domain/rules/liquidity-metrics-v1.js";

async function fetchJson(
  port: number,
  method: string,
  p: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: p,
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

test("offline product API drives shipped pure engines end-to-end", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "offline-api-"));
  const offline = new OfflineBackend({ dataDir: dir });
  const service = new CaHolderTaskService({
    liveEnabled: false,
    sourceFactory: () => {
      throw new Error("live_not_used");
    },
  });
  const server = createOperatorApiServer({ service, offline, host: "127.0.0.1" });
  await listenOperatorApi(server, 0);
  const port = (server.address() as { port: number }).port;

  // Liquidity: API result must match direct pure function on same history
  const liq = await fetchJson(port, "GET", "/api/v1/liquidity/latest");
  assert.equal(liq.status, 200);
  const snap = (liq.body as { snapshot: ReturnType<typeof buildLiquiditySnapshotV1>; briefMarkdown: string }).snapshot;
  const direct = buildLiquiditySnapshotV1(offline.getLiquidityHistory());
  assert.equal(snap.ruleVersion, direct.ruleVersion);
  assert.equal(snap.metrics.dexVolumeUsd, direct.metrics.dexVolumeUsd);
  assert.equal(snap.metrics.protocolRevenueUsd, null);
  assert.match((liq.body as { briefMarkdown: string }).briefMarkdown, /Liquidity Daily Brief/);

  // CA dashboard card from composer
  const ca = await fetchJson(port, "GET", `/api/v1/tokens/${encodeURIComponent(OFFLINE_DEMO_MINT)}/latest`);
  assert.equal(ca.status, 200);
  const body = ca.body as {
    analysis: { schemaVersion: string; market: { trust: string }; researchPriority: unknown[] };
    dev: { creator: string | null; verificationStatus: string };
    judgment: { overall: string };
    earlyBuyers: { buyers: unknown[] };
    crossCa: { ruleVersion: string };
  };
  assert.equal(body.analysis.schemaVersion, "CaAnalysisResponseV2");
  assert.equal(body.analysis.market.trust, "unverified");
  assert.ok(body.analysis.researchPriority.length >= 1);
  assert.ok(body.dev.creator);
  assert.ok(body.earlyBuyers.buyers.length >= 1);
  assert.match(body.crossCa.ruleVersion, /cross-ca/);

  // Address labels + LABEL-OPS
  const addrs = await fetchJson(port, "GET", "/api/v1/addresses");
  assert.equal(addrs.status, 200);
  assert.ok(((addrs.body as { items: unknown[] }).items).length >= 2);

  const label = await fetchJson(port, "POST", `/api/v1/addresses/${DEMO_ADDR()}/labels`, {
    label: "operator_note",
    note: "offline label",
  });
  assert.equal(label.status, 201);

  // Wallets from address store
  const wallets = await fetchJson(port, "GET", "/api/v1/wallets");
  assert.equal(wallets.status, 200);
  const wsum = wallets.body as { summary: { alpha: number; tierBUsablePool: number }; items: Array<{ id: string }> };
  assert.equal(wsum.summary.alpha, 0);
  assert.ok(wsum.summary.tierBUsablePool >= 1);
  const w = await fetchJson(port, "GET", `/api/v1/wallets/${encodeURIComponent(wsum.items[0]!.id)}`);
  assert.equal(w.status, 200);
  assert.ok((w.body as { ledger: unknown }).ledger !== undefined);

  // Jobs / task center
  const jobs = await fetchJson(port, "GET", "/api/v1/jobs");
  assert.equal(jobs.status, 200);
  assert.ok(((jobs.body as { jobs: unknown[] }).jobs).length >= 1);

  const enq = await fetchJson(port, "POST", "/api/v1/jobs", {
    type: "ca_analysis_offline",
    input: { mint: OFFLINE_DEMO_MINT },
  });
  assert.equal(enq.status, 202);

  // Cross-CA
  const cross = await fetchJson(port, "GET", `/api/v1/cross-ca?kind=mint&id=${encodeURIComponent(OFFLINE_DEMO_MINT)}`);
  assert.equal(cross.status, 200);
  assert.ok(((cross.body as { tokenToWallets: unknown[] }).tokenToWallets).length >= 1);

  // Replay calibration offline
  const replay = await fetchJson(port, "GET", "/api/v1/replay/calibration");
  assert.equal(replay.status, 200);
  const cal = replay.body as { calibration: { threshold: number | null; warnings: string[] } };
  assert.equal(cal.calibration.threshold, null);
  assert.ok(cal.calibration.warnings.includes("insufficient_samples_for_calibration"));

  // Schedule forbids full market
  const badSched = await fetchJson(port, "POST", "/api/v1/schedules", {
    type: "full_market_scan",
    subjects: ["*"],
  });
  assert.equal(badSched.status, 400);

  // Watchlist + alerts (local research notify)
  const wl = await fetchJson(port, "GET", "/api/v1/watchlist");
  assert.equal(wl.status, 200);
  assert.ok(((wl.body as { items: unknown[] }).items).length >= 1);
  const alerts = await fetchJson(port, "GET", "/api/v1/alerts");
  assert.equal(alerts.status, 200);
  assert.ok(((alerts.body as { items: unknown[] }).items).length >= 1);
  assert.ok(
    ((alerts.body as { items: Array<{ disclaimer: string }> }).items)[0]!.disclaimer.match(/not a trade/i),
  );

  // Schedules list
  const sched = await fetchJson(port, "GET", "/api/v1/schedules");
  assert.equal(sched.status, 200);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(dir, { recursive: true, force: true });
});

function DEMO_ADDR(): string {
  return "So11111111111111111111111111111111111111112";
}
