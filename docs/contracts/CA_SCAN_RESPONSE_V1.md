# CaScanResponse v1

**Task:** `CA-SCAN-RESPONSE-V1-001`
**Layer:** `judgment_layer`
**Schema:** `ca-scan-response`
**Version:** `v1`
**Module:** `src/domain/contracts/ca-scan-response-v1.ts`

## Purpose

Provider-neutral, versioned, fixture-driven **domain output contract** for a CA
scan card. The judgment layer composes already-normalized data and judgment
evidence into this shape. It does **not**:

- fetch live data;
- implement or import providers (Helius, DexScreener, Birdeye, GMGN, Rugcheck, Hotsniper, …);
- change the current Helius-only provider boundary;
- run LLM judgment;
- promote Tier-B labels to confirmed conclusions.

## Design axioms

| Axiom | Application |
|---|---|
| Constitution #1 raw integers | Balances / supplies / numerators / denominators are decimal-digit **strings** |
| Constitution #3 owner aggregation | `raw_top_holders` ≠ `owner_aggregated_holders` ≠ `cleaned_top_holders` |
| Constitution #4 reversible exclusion | Exclusions live in dedicated universes with reason / confidence / ruleVersion |
| Constitution #7 market ≠ chain fact | Market snapshot is typically Tier-B + `unverified` |
| Constitution #8 no fake precision | Partial → `completeness` + `warnings`; ratios may be `null` |
| Architecture §3 trust tiers | Tier-A first-hand vs Tier-B borrowed; Tier-B never `confirmed` alone |
| Architecture §2 judgment layer | Pure composition; no network I/O in this module |

## Root envelope

```text
schema: "ca-scan-response"
version: "v1"
generatedAt: ISO-8601
tokenIdentity
marketSnapshot | null
authorityFacts | null
holderUniverses | null
cohortMetrics | null
walletTokenSignals[]
clusterSummaries[]
devBehavior | null
crossTokenMatches[]
judgmentEvidence[]
sourceProvenance[]
completeness
warnings[]
```

## Holder universes (required keys)

When `holderUniverses` is non-null, all six populations are mandatory:

| Key | Meaning |
|---|---|
| `raw_top_holders` | Pre-aggregation token-account rows (may include `ownerAddress`) |
| `owner_aggregated_holders` | Balances summed by owner (constitution #3) |
| `cleaned_top_holders` | Eligible ranked owners after exclusions |
| `excluded_infrastructure` | Bonding curve / official proxy / similar infra |
| `excluded_pools` | Liquidity pool vaults |
| `excluded_burn_addresses` | Burn / dead addresses |

## RatioMetric (required fields)

Every concentration or share metric must carry:

- `numerator` (raw integer string)
- `denominator` (raw integer string)
- `ratio` (`number | null` — null under incomplete or zero denom)
- `universeDefinition` (non-empty string naming the population)
- `ruleVersion`
- `completeness` ∈ [0, 1]
- `provenance` (`SourceProvenance`)

Helper: `buildRatioMetric(...)`.

## JudgmentEvidence (required fields)

- `judgmentCode`
- `humanReadableSummary`
- `evidenceRefs[]`
- `confidence`
- `ruleVersion`
- `sourceTier` (`"A"` \| `"B"`)
- `completeness` (`complete` \| `partial` \| `unavailable`)
- `warnings[]`
- optional `status` (`unverified` \| `confirmed`)

**Invariant:** `sourceTier === "B"` and `status === "confirmed"` is rejected.
The same rule applies to cluster `confirmed`, wallet label verification, and
provenance verification.

## SourceProvenance

```text
source
sourceTier: A | B
verificationStatus: unverified | confirmed
observedAt
watermarkRef?
evidenceRef?
ruleVersion?
```

Tier-B + `confirmed` is invalid.

## Fixtures

| Path | Role |
|---|---|
| `fixtures/ca-scan-response/v1/minimal-complete.json` | Full, valid, complete card |
| `fixtures/ca-scan-response/v1/degraded-partial.json` | Partial/unavailable sections; null ratios; retained warnings |

## Validation API

```ts
import {
  validateCaScanResponseV1,
  parseCaScanResponseV1,
  CA_SCAN_RESPONSE_SCHEMA,
  CA_SCAN_RESPONSE_VERSION,
} from "../../src/domain/contracts/ca-scan-response-v1.js";

const result = validateCaScanResponseV1(json);
// result.ok, result.issues, result.value

const value = parseCaScanResponseV1(json); // throws on invalid
```

Validation is pure (no I/O). It rejects unknown object fields via strict
allowlists, scans both field names and string values for Hotsniper / cookie /
API-key / bearer / private-key leak patterns, and fails closed so fixtures cannot
smuggle secrets or private provider fields through undeclared keys.

Runtime validation is fail-closed: required nullable keys must still be present,
every declared nested section and array entry is checked, and timestamps must be
valid ISO-8601 values. Ratio values are bounded to `[0, 1]`; incomplete evidence
or a zero denominator requires `ratio: null`. When a non-null ratio is present,
it must match `numerator/denominator` within 1e-6 fixed-point precision.
`buildRatioMetric` derives a ratio only when completeness is exactly `1`.

## Out of scope (this task)

- Provider adapters, network clients, API servers, workers
- DB migrations, UI, wallet scoring changes
- GMGN parser / master-table-builder / wallet-data-quality repairs
- Directory-wide repository migration
- New npm dependencies or `package.json` edits
