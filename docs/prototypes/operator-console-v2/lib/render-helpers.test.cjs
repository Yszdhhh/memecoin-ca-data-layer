/**
 * Unit tests for shipped pure render helpers (real module path).
 * Run: node docs/prototypes/operator-console-v2/lib/render-helpers.test.cjs
 */
"use strict";

const path = require("path");
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

const EXPECT = R.NON_CONFIRMABLE; // 不可确认 via unicode escapes in module

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

assert(R.watermarkText() === "DESIGN PROTOTYPE / SYNTHETIC DATA", "watermark text exact");

const domains = ["Accounting", "Exclusion Coverage", "Concentration", "Market Data", "Wallet Intelligence"];
domains.forEach(function (d) {
  const lab = R.trustDomainLabel(d, "UNVERIFIED");
  assert(lab.domain === d, "trust domain " + d);
  assert(lab.status === "UNVERIFIED", "status uppercased for " + d);
});

const badge = R.stateBadge("credential_blocked");
assert(badge.text === "BLOCKED_CREDENTIAL", "credential blocked badge");
assert(badge.className.indexOf("bad") !== -1, "credential blocked is bad class");

if (failed) {
  console.error("\n" + failed + " assertion(s) failed");
  process.exit(1);
}
console.log("\nAll render-helper tests passed.");
process.exit(0);
