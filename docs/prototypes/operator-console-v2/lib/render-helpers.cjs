/**
 * Pure presentation helpers for Operator Console v2 prototype.
 * No network, no env keys, no business derivation of confirmed/ratio.
 * Works in browser (global OcRender) and Node (module.exports via .cjs).
 */
"use strict";

var NON_CONFIRMABLE = "\u4e0d\u53ef\u786e\u8ba4"; // 不可确认
var WATERMARK = "DESIGN PROTOTYPE / SYNTHETIC + SCRUBBED PUBLIC FIXTURE";

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

/**
 * Map Hotpath backend task DTO → UI derived state.
 * Raw status stays queued|running|completed|partial|failed|blocked.
 * Derived UI labels only from status + failureReason + warnings + flags.
 */
function mapTaskStatusToUi(task) {
  var t = task || {};
  var status = String(t.status || "").toLowerCase();
  var reason = String(t.failureReason || "").toLowerCase();
  var warnings = Array.isArray(t.warnings) ? t.warnings.map(String) : [];
  var exhausted =
    t.providerBudgetExhausted === true ||
    reason === "request_budget_exhausted" ||
    reason.indexOf("request_budget_exhausted") !== -1 ||
    warnings.indexOf("request_budget_exhausted") !== -1 ||
    warnings.indexOf("helius_request_budget_exhausted") !== -1;

  if (status === "blocked" || reason.indexOf("credential") !== -1) {
    return {
      rawStatus: status || "blocked",
      uiState: "BLOCKED_CREDENTIAL",
      badgeKey: "credential_blocked",
    };
  }
  if (exhausted) {
    return {
      rawStatus: status || "partial",
      uiState: "BUDGET_EXHAUSTED",
      badgeKey: "budget_exhausted",
    };
  }
  if (warnings.indexOf("result_stale_relative_to_policy") !== -1 || reason.indexOf("stale") !== -1) {
    return {
      rawStatus: status || "completed",
      uiState: "STALE_RESULT",
      badgeKey: "stale",
    };
  }
  if (reason.indexOf("schema") !== -1 || warnings.indexOf("schema_unknown_fail_closed") !== -1) {
    return {
      rawStatus: status || "failed",
      uiState: "SCHEMA_ERROR",
      badgeKey: "schema_error",
    };
  }
  if (warnings.indexOf("empty_result_not_error") !== -1 || status === "empty") {
    return {
      rawStatus: status || "completed",
      uiState: "EMPTY",
      badgeKey: "empty",
    };
  }
  if (status === "completed") {
    return { rawStatus: "completed", uiState: "SUCCEEDED", badgeKey: "success" };
  }
  if (status === "partial") {
    return { rawStatus: "partial", uiState: "PARTIAL", badgeKey: "partial" };
  }
  if (status === "running") {
    return { rawStatus: "running", uiState: "RUNNING", badgeKey: "running" };
  }
  if (status === "queued") {
    return { rawStatus: "queued", uiState: "QUEUED", badgeKey: "running" };
  }
  if (status === "failed") {
    return { rawStatus: "failed", uiState: "FAILED", badgeKey: "failed" };
  }
  return {
    rawStatus: status || "unknown",
    uiState: String(status || "UNKNOWN").toUpperCase(),
    badgeKey: status || "unknown",
  };
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
  return WATERMARK;
}

function assertNoTradeCtas(uiStrings) {
  var hits = [];
  var list = uiStrings || [];
  for (var i = 0; i < list.length; i++) {
    if (forbiddenTradeCta(list[i])) hits.push(list[i]);
  }
  return hits;
}

function fiveTrustDomains() {
  return [
    "Accounting",
    "Exclusion Coverage",
    "Concentration",
    "Market Data",
    "Wallet Intelligence",
  ];
}

var api = {
  formatRatio: formatRatio,
  isNonConfirmableRatio: isNonConfirmableRatio,
  trustDomainLabel: trustDomainLabel,
  tierBLabel: tierBLabel,
  forbiddenTradeCta: forbiddenTradeCta,
  mapTaskStatusToUi: mapTaskStatusToUi,
  stateBadge: stateBadge,
  concentrationCell: concentrationCell,
  watermarkText: watermarkText,
  assertNoTradeCtas: assertNoTradeCtas,
  fiveTrustDomains: fiveTrustDomains,
  NON_CONFIRMABLE: NON_CONFIRMABLE,
  WATERMARK: WATERMARK,
};

if (typeof module === "object" && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== "undefined") {
  globalThis.OcRender = api;
}
