import assert from "node:assert/strict";
import test from "node:test";
import { LarkCardKitPublisher, defaultLarkCliCommand, parseWindowsLarkShim, type LarkCommandExecutor } from "../src/infrastructure/lark/lark-cardkit-publisher.js";
import type { MacroDailyBrief } from "../src/domain/macro-daily.js";
import type { MacroDailyDynamics } from "../src/application/macro-daily-core-run-service.js";

const brief: MacroDailyBrief = { reportDay: "2026-07-19", globalMetrics: [], chainReports: [{ chain: "solana", metrics: [], hourlyProfiles: [] }, { chain: "bsc", metrics: [], hourlyProfiles: [] }, { chain: "robinhood", metrics: [], hourlyProfiles: [] }] };
const dynamics: MacroDailyDynamics = { global: {}, chain: {} };

test("keeps the logical Lark command and parses only the approved Windows Node shim", () => {
  assert.equal(defaultLarkCliCommand, "lark-cli");
  assert.equal(parseWindowsLarkShim('@echo off\r\nnode "C:\\Users\\example\\AppData\\Roaming\\npm\\node_modules\\@larksuite\\cli\\scripts\\run.js" %*\r\n'), "C:\\Users\\example\\AppData\\Roaming\\npm\\node_modules\\@larksuite\\cli\\scripts\\run.js");
  assert.equal(parseWindowsLarkShim('node "C:\\untrusted\\run.js" %*'), null);
});

test("does not invoke lark-cli during a dry run", async () => {
  let invoked = false;
  const execute: LarkCommandExecutor = async () => { invoked = true; };
  const result = await new LarkCardKitPublisher("", "lark-cli-test", execute).publish({ brief, dynamics }, true);

  assert.equal(result.deliveryMode, "dry_run");
  assert.match(result.payloadSha256, /^[0-9a-f]{64}$/);
  assert.equal(invoked, false);
});

test("sends a native interactive card through argument-array lark-cli invocation", async () => {
  let arguments_: readonly string[] | undefined;
  const execute: LarkCommandExecutor = async (_command, received) => { arguments_ = received; };
  const result = await new LarkCardKitPublisher("test-chat", "lark-cli-test", execute).publish({ brief, dynamics }, false);

  assert.equal(result.deliveryMode, "lark_card_sent");
  assert.match(result.payloadSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(arguments_?.slice(0, 8), ["im", "+messages-send", "--as", "bot", "--chat-id", "test-chat", "--msg-type", "interactive"]);
  const contentIndex = arguments_!.indexOf("--content");
  assert.equal(JSON.parse(arguments_![contentIndex + 1]!).schema, "2.0");
  assert.ok(arguments_!.includes("--idempotency-key"));
});
