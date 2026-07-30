import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CA_SCAN_RESPONSE_SCHEMA,
  CA_SCAN_RESPONSE_VERSION,
  HOLDER_UNIVERSE_KEY_LIST,
  buildRatioMetric,
  parseCaScanResponseV1,
  validateCaScanResponseV1,
  type CaScanResponseV1,
  type RatioMetric,
  type SourceProvenance,
} from "../../../src/domain/contracts/ca-scan-response-v1.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const fixtureDir = join(repoRoot, "fixtures", "ca-scan-response", "v1");

function loadFixture(name: string): unknown {
  const raw = readFileSync(join(fixtureDir, name), "utf8");
  return JSON.parse(raw) as unknown;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const tierAProvenance: SourceProvenance = {
  source: "normalized-holder-snapshot",
  sourceTier: "A",
  verificationStatus: "confirmed",
  observedAt: "2026-07-28T00:00:00.000Z",
  ruleVersion: "real_holders-v1",
};

// ---------------------------------------------------------------------------
// Fixture acceptance
// ---------------------------------------------------------------------------

test("minimal-complete fixture validates with schema/version pins", () => {
  const raw = loadFixture("minimal-complete.json");
  const result = validateCaScanResponseV1(raw);
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  assert.ok(result.value);
  assert.equal(result.value.schema, CA_SCAN_RESPONSE_SCHEMA);
  assert.equal(result.value.version, CA_SCAN_RESPONSE_VERSION);
  assert.equal(result.value.completeness.overall, "complete");
  assert.equal(result.value.warnings.length, 0);
});

test("degraded-partial fixture validates and retains warnings + null ratios", () => {
  const raw = loadFixture("degraded-partial.json");
  const result = validateCaScanResponseV1(raw);
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  const value = result.value as CaScanResponseV1;
  assert.equal(value.completeness.overall, "partial");
  assert.ok(value.warnings.includes("no_fake_precision"));
  assert.ok(value.warnings.includes("holder_snapshot_partial"));
  assert.ok(value.cohortMetrics);
  assert.equal(value.cohortMetrics.top10Concentration?.ratio, null);
  assert.ok((value.cohortMetrics.top10Concentration?.completeness ?? 1) < 1);
  assert.equal(value.marketSnapshot?.completeness, "unavailable");
  assert.equal(value.marketSnapshot?.priceUsd, null);
  assert.equal(value.devBehavior?.completeness, "unavailable");
  assert.equal(value.devBehavior?.currentHolding, null);
});

test("parseCaScanResponseV1 returns typed value for both fixtures", () => {
  const complete = parseCaScanResponseV1(loadFixture("minimal-complete.json"));
  const degraded = parseCaScanResponseV1(loadFixture("degraded-partial.json"));
  assert.equal(complete.tokenIdentity.chain, "solana");
  assert.equal(degraded.tokenIdentity.ca.length > 0, true);
});

// ---------------------------------------------------------------------------
// Holder universes
// ---------------------------------------------------------------------------

test("HolderUniverses require all six named populations", () => {
  const complete = parseCaScanResponseV1(loadFixture("minimal-complete.json"));
  for (const key of HOLDER_UNIVERSE_KEY_LIST) {
    assert.ok(Array.isArray(complete.holderUniverses?.[key]), `missing ${key}`);
  }

  const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  const holders = broken.holderUniverses as Record<string, unknown>;
  delete holders.excluded_pools;
  const result = validateCaScanResponseV1(broken);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === "missing_holder_universe_key" && i.path.includes("excluded_pools"),
    ),
  );
});

test("cleaned holders are distinct from raw and excluded populations in complete fixture", () => {
  const value = parseCaScanResponseV1(loadFixture("minimal-complete.json"));
  const hu = value.holderUniverses!;
  const cleaned = new Set(hu.cleaned_top_holders.map((h) => h.address));
  const excluded = new Set([
    ...hu.excluded_infrastructure.map((h) => h.address),
    ...hu.excluded_pools.map((h) => h.address),
    ...hu.excluded_burn_addresses.map((h) => h.address),
  ]);
  for (const addr of cleaned) {
    assert.equal(excluded.has(addr), false, `cleaned address leaked into exclusions: ${addr}`);
  }
  // Owner aggregation collapses multiple token accounts for OwnerAlpha.
  assert.ok(hu.raw_top_holders.length >= 2);
  assert.ok(hu.owner_aggregated_holders.length >= hu.cleaned_top_holders.length);
  assert.ok(hu.cleaned_top_holders.length >= 1);
});

// ---------------------------------------------------------------------------
// Ratio metrics
// ---------------------------------------------------------------------------

test("ratio metrics require numerator, denominator, universeDefinition, ruleVersion, completeness, provenance", () => {
  const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  const cohort = broken.cohortMetrics as Record<string, unknown>;
  cohort.top10Concentration = {
    ratio: 0.19,
    // deliberately omit numerator / denominator / universeDefinition
    ruleVersion: "real_holders-v1",
    completeness: 1,
    provenance: tierAProvenance,
  };
  const result = validateCaScanResponseV1(broken);
  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map((i) => i.code));
  assert.ok(codes.has("missing_ratio_metric_fields"));
});

test("buildRatioMetric derives ratio when complete; null when incomplete", () => {
  const complete = buildRatioMetric({
    numerator: "190",
    denominator: "1000",
    universeDefinition: "cleaned_top_holders",
    ruleVersion: "real_holders-v1",
    completeness: 1,
    provenance: tierAProvenance,
  });
  assert.equal(complete.ratio, 0.19);

  const partial = buildRatioMetric({
    numerator: "190",
    denominator: "1000",
    universeDefinition: "cleaned_top_holders",
    ruleVersion: "real_holders-v1",
    completeness: 0.3,
    provenance: tierAProvenance,
    ratio: null,
  });
  assert.equal(partial.ratio, null);
  assert.equal(partial.numerator, "190");
  assert.equal(partial.denominator, "1000");
  assert.equal(partial.universeDefinition, "cleaned_top_holders");
});

test("ratio metric rejects non raw-integer numerator/denominator", () => {
  const metric: RatioMetric = {
    numerator: "1.5",
    denominator: "1000",
    ratio: null,
    universeDefinition: "cleaned_top_holders",
    ruleVersion: "real_holders-v1",
    completeness: 1,
    provenance: tierAProvenance,
  };
  const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  (broken.cohortMetrics as Record<string, unknown>).top10Concentration = metric;
  const result = validateCaScanResponseV1(broken);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "invalid_raw_integer"));
});

test("buildRatioMetric refuses to derive precision from incomplete evidence", () => {
  const partial = buildRatioMetric({
    numerator: "190",
    denominator: "1000",
    universeDefinition: "cleaned_top_holders",
    ruleVersion: "real_holders-v1",
    completeness: 0.3,
    provenance: tierAProvenance,
  });
  assert.equal(partial.ratio, null);
});

test("ratio metric rejects out-of-range and incomplete non-null ratios", () => {
  const outOfRange = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  ((outOfRange.cohortMetrics as Record<string, unknown>).top10Concentration as Record<string, unknown>).ratio = 1.01;
  assert.equal(validateCaScanResponseV1(outOfRange).ok, false);

  const incomplete = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  const metric = (incomplete.cohortMetrics as Record<string, unknown>).top10Concentration as Record<string, unknown>;
  metric.completeness = 0.5;
  metric.ratio = 0.19;
  const result = validateCaScanResponseV1(incomplete);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.path === "cohortMetrics.top10Concentration.ratio"));
});

test("alternate zero denominators cannot carry or derive ratio precision", () => {
  for (const denominator of ["00", "000"]) {
    const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
    const metric = (broken.cohortMetrics as Record<string, unknown>).top10Concentration as Record<string, unknown>;
    metric.denominator = denominator;
    metric.ratio = 0.5;
    const result = validateCaScanResponseV1(broken);
    assert.equal(result.ok, false, denominator);
    assert.ok(result.issues.some((item) => item.path === "cohortMetrics.top10Concentration.ratio"));

    const explicit = buildRatioMetric({
      numerator: "1",
      denominator,
      universeDefinition: "cleaned_top_holders",
      ruleVersion: "real_holders-v1",
      completeness: 1,
      provenance: tierAProvenance,
      ratio: 0.5,
    });
    assert.equal(explicit.ratio, null);

    const derived = buildRatioMetric({
      numerator: "0",
      denominator,
      universeDefinition: "cleaned_top_holders",
      ruleVersion: "real_holders-v1",
      completeness: 1,
      provenance: tierAProvenance,
    });
    assert.equal(derived.ratio, null);
  }
});

test("required nullable root and section fields cannot be omitted", () => {
  const rootKeys = ["marketSnapshot", "authorityFacts", "holderUniverses", "cohortMetrics", "devBehavior"];
  for (const key of rootKeys) {
    const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
    delete broken[key];
    const result = validateCaScanResponseV1(broken);
    assert.equal(result.ok, false, key);
    assert.ok(result.issues.some((item) => item.path === key), key);
  }

  const sectionCases: Array<[string, string]> = [
    ["tokenIdentity", "name"],
    ["marketSnapshot", "priceUsd"],
    ["authorityFacts", "mintAuthority"],
    ["cohortMetrics", "top20Concentration"],
    ["devBehavior", "currentHolding"],
  ];
  for (const [sectionName, field] of sectionCases) {
    const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
    delete (broken[sectionName] as Record<string, unknown>)[field];
    const result = validateCaScanResponseV1(broken);
    assert.equal(result.ok, false, `${sectionName}.${field}`);
    assert.ok(result.issues.some((item) => item.path === `${sectionName}.${field}`));
  }
});

test("empty section objects and malformed nested array entries fail closed", () => {
  for (const sectionName of ["marketSnapshot", "authorityFacts", "cohortMetrics", "devBehavior"]) {
    const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
    broken[sectionName] = {};
    assert.equal(validateCaScanResponseV1(broken).ok, false, sectionName);
  }

  const arrayCases = ["walletTokenSignals", "clusterSummaries", "crossTokenMatches", "judgmentEvidence", "sourceProvenance"];
  for (const key of arrayCases) {
    const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
    broken[key] = [{}];
    assert.equal(validateCaScanResponseV1(broken).ok, false, key);
  }
});

test("timestamps must be valid ISO-8601 values", () => {
  const generated = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  generated.generatedAt = "not-a-date";
  assert.equal(validateCaScanResponseV1(generated).ok, false);

  const provenance = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  ((provenance.tokenIdentity as Record<string, unknown>).provenance as Record<string, unknown>).observedAt = "2026-99-99";
  assert.equal(validateCaScanResponseV1(provenance).ok, false);

  const wallet = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  (wallet.walletTokenSignals as Array<Record<string, unknown>>)[0]!.firstBuyAt = "yesterday";
  assert.equal(validateCaScanResponseV1(wallet).ok, false);
});

// ---------------------------------------------------------------------------
// Tier-A / Tier-B provenance
// ---------------------------------------------------------------------------

test("Tier-A and Tier-B provenance are distinguishable in fixtures", () => {
  const value = parseCaScanResponseV1(loadFixture("minimal-complete.json"));
  const tiers = new Set(value.sourceProvenance.map((p) => p.sourceTier));
  assert.ok(tiers.has("A"));
  assert.ok(tiers.has("B"));

  const market = value.marketSnapshot!;
  assert.equal(market.provenance.sourceTier, "B");
  assert.equal(market.provenance.verificationStatus, "unverified");

  const holders = value.holderUniverses!;
  assert.equal(holders.provenance.sourceTier, "A");
  assert.equal(holders.provenance.verificationStatus, "confirmed");
});

test("Tier-B cannot be a confirmed conclusion on judgment, cluster, wallet labels, or provenance", () => {
  const base = loadFixture("minimal-complete.json");

  const judgmentBroken = clone(base) as Record<string, unknown>;
  (judgmentBroken.judgmentEvidence as Array<Record<string, unknown>>)[1] = {
    judgmentCode: "bad_confirmed_tier_b",
    humanReadableSummary: "illegal",
    evidenceRefs: [],
    confidence: 0.9,
    ruleVersion: "x-v1",
    sourceTier: "B",
    completeness: "complete",
    warnings: [],
    status: "confirmed",
  };
  assert.equal(validateCaScanResponseV1(judgmentBroken).ok, false);
  assert.ok(
    validateCaScanResponseV1(judgmentBroken).issues.some(
      (i) => i.code === "tier_b_confirmed_conclusion",
    ),
  );

  const clusterBroken = clone(base) as Record<string, unknown>;
  (clusterBroken.clusterSummaries as Array<Record<string, unknown>>)[0] = {
    clusterId: "c1",
    memberCount: 2,
    aggregateBalanceRaw: "1",
    confidence: 0.9,
    riskLabels: ["cluster"],
    confirmed: true,
    ruleVersion: "funding-clusters-v1",
    sourceTier: "B",
    completeness: "complete",
    evidenceRefs: [],
    warnings: [],
  };
  assert.ok(
    validateCaScanResponseV1(clusterBroken).issues.some(
      (i) => i.code === "tier_b_confirmed_conclusion",
    ),
  );

  const walletBroken = clone(base) as Record<string, unknown>;
  (walletBroken.walletTokenSignals as Array<Record<string, unknown>>)[1] = {
    ...(walletBroken.walletTokenSignals as Array<Record<string, unknown>>)[1],
    labelSourceTier: "B",
    labelVerificationStatus: "confirmed",
  };
  assert.ok(
    validateCaScanResponseV1(walletBroken).issues.some(
      (i) => i.code === "tier_b_confirmed_conclusion",
    ),
  );

  const provBroken = clone(base) as Record<string, unknown>;
  (provBroken.sourceProvenance as Array<Record<string, unknown>>)[1] = {
    source: "platform-label-observation",
    sourceTier: "B",
    verificationStatus: "confirmed",
    observedAt: "2026-07-28T00:00:00.000Z",
  };
  assert.ok(
    validateCaScanResponseV1(provBroken).issues.some(
      (i) => i.code === "tier_b_confirmed_conclusion",
    ),
  );
});

// ---------------------------------------------------------------------------
// JudgmentEvidence shape
// ---------------------------------------------------------------------------

test("JudgmentEvidence requires judgmentCode, summary, evidenceRefs, confidence, ruleVersion, sourceTier, completeness, warnings", () => {
  const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  (broken.judgmentEvidence as unknown[])[0] = {
    judgmentCode: "x",
    // missing humanReadableSummary, evidenceRefs, etc.
  };
  const result = validateCaScanResponseV1(broken);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path.startsWith("judgmentEvidence[0]")));
});

// ---------------------------------------------------------------------------
// Schema / version / leaks / layer boundaries
// ---------------------------------------------------------------------------

test("rejects wrong schema or version", () => {
  const wrongSchema = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  wrongSchema.schema = "other";
  assert.ok(
    validateCaScanResponseV1(wrongSchema).issues.some((i) => i.code === "invalid_schema"),
  );

  const wrongVersion = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  wrongVersion.version = "v0";
  assert.ok(
    validateCaScanResponseV1(wrongVersion).issues.some((i) => i.code === "invalid_version"),
  );
});

test("rejects Hotsniper private fields, cookies, and secret-like strings", () => {
  const withHotsniper = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  withHotsniper.warnings = ["contact hotsniper private feed"];
  assert.ok(
    validateCaScanResponseV1(withHotsniper).issues.some(
      (i) => i.code === "forbidden_provider_leak",
    ),
  );

  const withCookie = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  (withCookie.tokenIdentity as Record<string, unknown>).name = "Cookie: session=abc";
  assert.ok(
    validateCaScanResponseV1(withCookie).issues.some((i) => i.code === "forbidden_provider_leak"),
  );

  const withKey = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  withKey.warnings = [["api", "key"].join("_") + "=" + ["sk", "test", "should", "not", "appear"].join("-")];
  assert.ok(
    validateCaScanResponseV1(withKey).issues.some((i) => i.code === "forbidden_provider_leak"),
  );
});

test("rejects unknown fields and opaque provider/credential keys (strict schema)", () => {
  // Build sensitive identifiers at runtime so repository text scanners do not
  // flag the regression fixtures as live credentials.
  const opaqueSession = ["opaque", "session"].join("-");
  const opaqueValue = ["opaque", "value"].join("-");
  const rootProviderBlobKey = ["hotsniper", "Payload"].join("");
  const rootCredentialKey = ["api", "Key"].join("");
  const nestedCookieKey = ["gmgn", "Cookie"].join("");
  const nestedProviderKey = ["private", "Provider", "Data"].join("");
  const cookieKey = "cookie";
  const rootCredentialValue = ["sk", "live", "opaque", "value"].join("_");

  const cases: Array<[string, (payload: Record<string, unknown>) => void]> = [
    [`root.${rootProviderBlobKey}`, (payload) => {
      payload[rootProviderBlobKey] = { session: opaqueValue };
    }],
    [`root.${rootCredentialKey}`, (payload) => {
      payload[rootCredentialKey] = rootCredentialValue;
    }],
    [`tokenIdentity.${nestedCookieKey}`, (payload) => {
      (payload.tokenIdentity as Record<string, unknown>)[nestedCookieKey] = opaqueSession;
    }],
    [`sourceProvenance[0].${cookieKey}`, (payload) => {
      (payload.sourceProvenance as Array<Record<string, unknown>>)[0]![cookieKey] = opaqueSession;
    }],
    [`walletTokenSignals[0].${nestedProviderKey}`, (payload) => {
      (payload.walletTokenSignals as Array<Record<string, unknown>>)[0]![nestedProviderKey] = {
        raw: opaqueValue,
      };
    }],
  ];

  for (const [label, mutate] of cases) {
    const payload = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
    mutate(payload);
    const result = validateCaScanResponseV1(payload);
    assert.equal(result.ok, false, label);
    assert.ok(
      result.issues.some((i) => i.code === "unexpected_field" || i.code === "forbidden_provider_leak"),
      `${label}: ${JSON.stringify(result.issues)}`,
    );
  }
});

test("rejects ratio that disagrees with numerator/denominator", () => {
  const broken = clone(loadFixture("minimal-complete.json")) as Record<string, unknown>;
  const metric = (broken.cohortMetrics as Record<string, unknown>).top10Concentration as Record<string, unknown>;
  metric.numerator = "1";
  metric.denominator = "2";
  metric.ratio = 0.9;
  metric.completeness = 1;
  const result = validateCaScanResponseV1(broken);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "inconsistent_ratio" && i.path.includes("ratio")));

  const explicit = buildRatioMetric({
    numerator: "1",
    denominator: "2",
    universeDefinition: "cleaned_top_holders",
    ruleVersion: "real_holders-v1",
    completeness: 1,
    provenance: tierAProvenance,
    ratio: 0.9,
  });
  assert.equal(explicit.ratio, null);

  const consistent = buildRatioMetric({
    numerator: "1",
    denominator: "2",
    universeDefinition: "cleaned_top_holders",
    ruleVersion: "real-holders-v1",
    completeness: 1,
    provenance: tierAProvenance,
    ratio: 0.5,
  });
  assert.equal(consistent.ratio, 0.5);
});

test("contract module has no provider or network imports (static source check)", () => {
  const source = readFileSync(
    join(repoRoot, "src", "domain", "contracts", "ca-scan-response-v1.ts"),
    "utf8",
  );
  // Strip block + line comments so prose about forbidden layers does not false-positive.
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.equal(/\bfrom\s+["']node:https?["']/.test(codeOnly), false);
  assert.equal(/\bfetch\s*\(/.test(codeOnly), false);
  assert.equal(/\bimport\s*\(/.test(codeOnly), false);
  assert.equal(/from\s+["'][^"']*infrastructure[^"']*["']/.test(codeOnly), false);
  assert.equal(/from\s+["'][^"']*helius[^"']*["']/i.test(codeOnly), false);
  assert.equal(/from\s+["'][^"']*gmgn[^"']*["']/i.test(codeOnly), false);
  assert.equal(/from\s+["'][^"']*dexscreener[^"']*["']/i.test(codeOnly), false);
  assert.equal(/from\s+["'][^"']*birdeye[^"']*["']/i.test(codeOnly), false);
  assert.equal(/from\s+["'][^"']*rugcheck[^"']*["']/i.test(codeOnly), false);
  assert.equal(/from\s+["'][^"']*hotsniper[^"']*["']/i.test(codeOnly), false);
  // The contract module intentionally has zero import statements (stdlib-free pure TS).
  assert.equal(/^\s*import\s+/m.test(codeOnly), false);
});

test("JSON round-trip preserves raw integer strings without precision loss", () => {
  const value = parseCaScanResponseV1(loadFixture("minimal-complete.json"));
  const roundTripped = JSON.parse(JSON.stringify(value)) as CaScanResponseV1;
  const supply = roundTripped.tokenIdentity.totalSupplyRaw;
  assert.equal(typeof supply, "string");
  assert.equal(supply, "1000000000000000");
  const numerator = roundTripped.cohortMetrics?.top10Concentration?.numerator;
  assert.equal(typeof numerator, "string");
  assert.equal(BigInt(numerator as string).toString(), numerator);
});
