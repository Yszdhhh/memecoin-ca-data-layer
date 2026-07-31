/**
 * Unit tests for shipped pure render helpers (real module path).
 * Run: node docs/prototypes/operator-console-v2/lib/render-helpers.test.cjs
 */
"use strict";

const path = require("path");
const fs = require("fs");
const vm = require("vm");
const R = require(path.join(__dirname, "render-helpers.cjs"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const EXPECT = R.NON_CONFIRMABLE;

assert(R.formatRatio(null) === EXPECT, "null ratio is non-confirmable label");
assert(R.formatRatio(undefined) === EXPECT, "undefined ratio is non-confirmable label");
assert(R.formatRatio(NaN) === EXPECT, "NaN ratio is non-confirmable label");
assert(R.formatRatio(0) === "0.00%", "zero ratio may render 0.00% only when truly 0");
assert(R.formatRatio(0.1234) === "12.34%", "numeric ratio formats percent");
assert(R.isNonConfirmableRatio(null) === true, "null is non-confirmable");
assert(R.isNonConfirmableRatio(0) === false, "0 is confirmable numeric value");

const cell = R.concentrationCell({
  numerator: "1",
  denominator: "2",
  ratio: null,
  verificationStatus: "unverified",
});
assert(cell.ratioText === EXPECT, "concentration cell null ratio text");
assert(cell.nonConfirmable === true, "concentration cell nonConfirmable");
assert(cell.ratioText !== "0%" && cell.ratioText !== "0.00%", "must not show 0% for null");

const tb = R.tierBLabel("gmgn_smart_money_style_tag");
assert(tb.confirmed === false, "Tier-B never confirmed");
assert(/unverified/i.test(tb.display), "Tier-B display includes unverified");
assert(/Tier-B/i.test(tb.display), "Tier-B display includes Tier-B");

assert(R.forbiddenTradeCta("Swap now") === true, "detect Swap CTA");
assert(R.forbiddenTradeCta("Copy Trade") === true, "detect Copy Trade");
assert(R.forbiddenTradeCta("Open evidence") === false, "allow research CTA");

const hits = R.assertNoTradeCtas(["Rescan", "Evidence", "Create task"]);
assert(hits.length === 0, "research CTAs clean");
const hits2 = R.assertNoTradeCtas(["Buy", "Sell"]);
assert(hits2.length === 2, "trade CTAs flagged");

assert(
  R.watermarkText() === "DESIGN PROTOTYPE / SYNTHETIC + SCRUBBED PUBLIC FIXTURE",
  "watermark text exact"
);

const domains = R.fiveTrustDomains();
assert(domains.length === 5, "five trust domains present");
domains.forEach(function (d) {
  const lab = R.trustDomainLabel(d, "UNVERIFIED");
  assert(lab.domain === d, "trust domain " + d);
  assert(lab.status === "UNVERIFIED", "status uppercased for " + d);
});

const badge = R.stateBadge("credential_blocked");
assert(badge.text === "BLOCKED_CREDENTIAL", "credential blocked badge");
assert(badge.className.indexOf("bad") !== -1, "credential blocked is bad class");

// --- Load synthetic scenarios (shipped data module) ---
const synthPath = path.join(__dirname, "..", "data", "synthetic.js");
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(synthPath, "utf8"), sandbox);
const Oc = sandbox.OcSynthetic || sandbox.globalThis.OcSynthetic;
assert(!!Oc && !!Oc.SCENARIOS, "synthetic scenarios load from shipped path");

const budget = Oc.SCENARIOS.budget_exhausted;
assert(budget.task.status === "partial", "budget exhausted raw task status = partial");
assert(
  budget.task.failureReason === "request_budget_exhausted",
  "failureReason = request_budget_exhausted"
);
assert(budget.task.providerBudgetExhausted === true, "providerBudgetExhausted = true");
assert(budget.task.paginationComplete === false, "budget paginationComplete = false");
assert(budget.task.accountingEligible === false, "budget accountingEligible = false");
assert(budget.task.concentrationEligible === false, "budget concentrationEligible = false");
assert(budget.ca.concentration.top10.ratio === null, "budget concentration ratio = null");

const mappedBudget = R.mapTaskStatusToUi(budget.task);
assert(mappedBudget.rawStatus === "partial", "mapped raw status remains partial");
assert(mappedBudget.uiState === "BUDGET_EXHAUSTED", "UI derived BUDGET_EXHAUSTED banner state");
assert(mappedBudget.badgeKey === "budget_exhausted", "badge key budget_exhausted");

const success = Oc.SCENARIOS.success;
assert(
  /accounting complete/i.test(success.title) && /concentration eligible/i.test(success.title),
  "success scenario title consistent with eligibility"
);
assert(success.ca.accountingEligible === true, "success accountingEligible true");
assert(success.ca.exclusionCoverage === "complete", "success exclusion complete");
assert(success.ca.concentrationEligible === true, "success concentrationEligible true");
assert(success.ca.concentration.top10.ratio === 0.5, "success ratio numeric when eligible");
assert(success.task.status === "completed", "success task completed");
assert(success.task.providerBudgetExhausted === false, "success not budget exhausted");

const cred = Oc.SCENARIOS.credential_blocked;
assert(cred.task.status === "blocked", "credential blocked status");
assert(cred.task.failureReason === "credential_unavailable", "credential failureReason");
assert(cred.task.requestsUsed === 0, "credential zero requests");
const mappedCred = R.mapTaskStatusToUi(cred.task);
assert(mappedCred.uiState === "BLOCKED_CREDENTIAL", "UI BLOCKED_CREDENTIAL");

// Default demo remains partial
assert(Oc.SCENARIOS.partial.task.status === "partial", "default partial demo status");

if (failed) {
  console.error("\n" + failed + " assertion(s) failed");
  process.exit(1);
}
console.log("\nAll render-helper tests passed.");
process.exit(0);
