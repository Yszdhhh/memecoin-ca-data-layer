/**
 * Pure presentation helpers for Operator Console v2 prototype.
 * No network, no env keys, no business derivation of confirmed/ratio.
 * Works in browser (global OcRender) and Node (module.exports via .cjs).
 */
"use strict";

var NON_CONFIRMABLE = "\u4e0d\u53ef\u786e\u8ba4"; // 不可确认

function formatRatio(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) {
    return NON_CONFIRMABLE;
  }
  if (typeof ratio !== "number") {
    return NON_CONFIRMABLE;
  }
  return (ratio * 100).toFixed(2) + "%";
}

function isNonConfirmableRatio(ratio) {
  return ratio === null || ratio === undefined || Number.isNaN(ratio);
}

function trustDomainLabel(domain, status) {
  var s = String(status || "UNAVAILABLE").toUpperCase();
  return { domain: domain, status: s, text: domain + ": " + s };
}

function tierBLabel(label) {
  return {
    label: label || "external observation",
    display: "Tier-B \u00b7 unverified \u00b7 " + (label || "external observation"),
    confirmed: false,
  };
}

function forbiddenTradeCta(text) {
  var t = String(text || "").toLowerCase();
  var patterns = ["swap", "buy", "sell", "copy trade", "copytrade", "quick buy", "snipe"];
  for (var i = 0; i < patterns.length; i++) {
    if (t.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

function stateBadge(state) {
  var map = {
    success: { text: "SUCCEEDED", className: "badge ok" },
    partial: { text: "PARTIAL", className: "badge warn" },
    credential_blocked: { text: "BLOCKED_CREDENTIAL", className: "badge bad" },
    budget_exhausted: { text: "BUDGET_EXHAUSTED", className: "badge bad" },
    stale: { text: "STALE_RESULT", className: "badge warn" },
    schema_error: { text: "SCHEMA_ERROR", className: "badge bad" },
    empty: { text: "EMPTY", className: "badge muted" },
    running: { text: "RUNNING", className: "badge warn" },
    failed: { text: "FAILED", className: "badge bad" },
  };
  return map[state] || { text: String(state || "UNKNOWN").toUpperCase(), className: "badge muted" };
}

function concentrationCell(metric) {
  if (!metric) {
    return {
      ratioText: NON_CONFIRMABLE,
      verification: "unavailable",
      numerator: "\u2014",
      denominator: "\u2014",
      nonConfirmable: true,
    };
  }
  var ratio = metric.ratio;
  var nonConfirmable = isNonConfirmableRatio(ratio);
  return {
    ratioText: formatRatio(ratio),
    verification: metric.verificationStatus || "unverified",
    numerator: metric.numerator != null ? String(metric.numerator) : "\u2014",
    denominator: metric.denominator != null ? String(metric.denominator) : "\u2014",
    nonConfirmable: nonConfirmable,
  };
}

function watermarkText() {
  return "DESIGN PROTOTYPE / SYNTHETIC DATA";
}

function assertNoTradeCtas(uiStrings) {
  var hits = [];
  var list = uiStrings || [];
  for (var i = 0; i < list.length; i++) {
    if (forbiddenTradeCta(list[i])) hits.push(list[i]);
  }
  return hits;
}

var api = {
  formatRatio: formatRatio,
  isNonConfirmableRatio: isNonConfirmableRatio,
  trustDomainLabel: trustDomainLabel,
  tierBLabel: tierBLabel,
  forbiddenTradeCta: forbiddenTradeCta,
  stateBadge: stateBadge,
  concentrationCell: concentrationCell,
  watermarkText: watermarkText,
  assertNoTradeCtas: assertNoTradeCtas,
  NON_CONFIRMABLE: NON_CONFIRMABLE,
};

if (typeof module === "object" && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== "undefined") {
  globalThis.OcRender = api;
}
