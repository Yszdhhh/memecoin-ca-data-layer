import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WatchlistAlertStore } from "../../src/application/watchlist/watchlist-alerts.js";

test("watchlist dedupe and cooldown suppress repeats", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wl-"));
  let t = Date.parse("2026-07-30T12:00:00.000Z");
  const store = new WatchlistAlertStore({
    dataDir: dir,
    now: () => new Date(t),
    defaultCooldownMinutes: 60,
  });
  const w = store.addWatch({
    kind: "ca",
    subject: "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump",
    label: "demo",
  });
  const a1 = store.emitAlert({
    watchId: w.watchId,
    kind: "liquidity_anomaly",
    summary: "low liq",
    evidenceRefs: ["market:liquidity"],
    evidenceLink: "/ca/x",
  });
  assert.ok(a1);
  assert.match(a1!.disclaimer, /not a trade/i);
  assert.ok(a1!.evidenceLink);

  // exact fingerprint dedupe
  const a2 = store.emitAlert({
    watchId: w.watchId,
    kind: "liquidity_anomaly",
    summary: "low liq",
    evidenceRefs: ["market:liquidity"],
  });
  assert.equal(a2, null);

  // cooldown: different summary but same kind within window
  const a3 = store.emitAlert({
    watchId: w.watchId,
    kind: "liquidity_anomaly",
    summary: "low liq again different text",
    evidenceRefs: ["market:liquidity2"],
  });
  assert.equal(a3, null);

  // after cooldown
  t += 61 * 60_000;
  const a4 = store.emitAlert({
    watchId: w.watchId,
    kind: "liquidity_anomaly",
    summary: "low liq again different text",
    evidenceRefs: ["market:liquidity2"],
  });
  assert.ok(a4);

  const unread = store.listAlerts({ unreadOnly: true });
  assert.ok(unread.length >= 2);
  store.markRead(a1!.alertId);
  assert.equal(store.listAlerts({ unreadOnly: true }).some((x) => x.alertId === a1!.alertId), false);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("evaluateCaSnapshot emits data_quality and address_hit", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wl2-"));
  const store = new WatchlistAlertStore({ dataDir: dir });
  const mint = "H3GtwGSrYRVqp7dtjkaDfjE2inydLkHwFkFJSPzrpump";
  store.addWatch({ kind: "ca", subject: mint });
  const events = store.evaluateCaSnapshot(mint, {
    accountingEligible: false,
    concentrationEligible: false,
    liquidityUsd: 1000,
    addressHitCount: 2,
    mintAuthorityPresent: false,
  });
  assert.ok(events.some((e) => e.kind === "data_quality"));
  assert.ok(events.some((e) => e.kind === "liquidity_anomaly"));
  assert.ok(events.some((e) => e.kind === "address_hit"));
  fs.rmSync(dir, { recursive: true, force: true });
});
