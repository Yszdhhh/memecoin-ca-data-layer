# Operator Console Component Contracts V1

**Document:** `OPERATOR_CONSOLE_COMPONENT_CONTRACTS_V1`  
**Scope:** TypeScript **pseudo-contracts** for Operator Console presentational components  
**Related:**

- `docs/product/OPERATOR_CONSOLE_UI_STATE_MACHINE_V1.md`
- `docs/contracts/OPERATOR_CONSOLE_DATA_SOURCE_V1.md`
- `docs/contracts/CA_SCAN_RESPONSE_V1.md`
- Shell reference: `apps/operator-console/src/**`

## Design axiom

```text
Frontend only CONSUMES backend (or fixture mapped 1:1 from backend-shaped DTOs):

  status
  verificationStatus
  warnings
  evidence / evidenceRefs
  ruleVersion
  observedAt
  sourceWatermark

+ task lifecycle fields (taskId, requestsUsed, requestBudget, failureReason, …)
+ trust gates already computed server-side
  (accountingEligible, exclusionCoverage, concentrationEligible)
```

### Global FORBIDDEN client-side business logic

| Forbidden | Why |
|-----------|-----|
| Derive `confirmed` / `CONFIRMED` from heuristics | Confirmation is Tier-A judgment authority |
| Recompute concentration ratios from raw balances | Constitution: no fake precision; ratios are server `RatioMetric` |
| Promote Tier-B → confirmed | Architecture trust tiers |
| Use `judgmentEligible` as concentration gate | Deprecated accounting alias |
| Map `ratio: null` → `0` or `"0%"` | Null means **不可确认 / Not confirmable** |
| Infer `BLOCKED_CREDENTIAL` vs `FAILED` without reason codes | Distinct states |
| Treat budget exhaustion as success | Incomplete terminal |
| Best-effort render unknown schema fields | Fail-closed |
| Hide stale / overwrite watermark to look “latest” | Freshness honesty |
| Call Live providers from components | Shell/hotpath boundary |

Components **may**: format strings, short mints, badge CSS class from **already labeled** strings, a11y wiring, open/close drawers, route links.

---

## Shared types (pseudo)

```ts
/** ISO-8601 from backend */
type IsoTimestamp = string;

type SourceTier = "A" | "B";

/** Field / metric verification — server authority */
type VerificationStatus = "unverified" | "confirmed";

/** Task-level or section-level coarse status strings as delivered by API/fixture */
type TrustLabel =
  | "CONFIRMED"
  | "UNVERIFIED"
  | "PARTIAL"
  | "UNAVAILABLE"
  | "COMPLETE"
  | "OK"
  | "FAILED"
  | "BLOCKED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "SUCCEEDED"
  | "EMPTY"
  | "STALE"
  | "SCHEMA_ERROR"
  | "BUDGET_EXHAUSTED"
  | "TIMED_OUT"
  | "CANCELLED"
  | string;

type ExclusionCoverage = "complete" | "partial" | "unavailable";

interface SourceProvenanceView {
  source: string;
  sourceTier: SourceTier;
  verificationStatus: VerificationStatus;
  observedAt: IsoTimestamp;
  watermarkRef?: string;
  evidenceRef?: string;
  ruleVersion?: string;
}

interface RatioMetricView {
  numerator: string;
  denominator: string;
  ratio: number | null;
  universeDefinition?: string;
  ruleVersion: string;
  completeness?: number;
  verificationStatus: VerificationStatus;
  provenance?: SourceProvenanceView;
}

interface EvidenceRefView {
  id: string;
  label?: string;
  /** Never secrets; path or opaque id only */
  href?: string;
}

interface WarningView {
  code: string;
  message?: string;
  severity?: "info" | "warn" | "error";
}

/**
 * UiState from OPERATOR_CONSOLE_UI_STATE_MACHINE_V1
 */
type CaUiState =
  | "IDLE"
  | "VALIDATING_INPUT"
  | "INVALID_INPUT"
  | "SUBMITTING"
  | "QUEUED"
  | "RUNNING"
  | "PARTIAL"
  | "SUCCEEDED"
  | "FAILED"
  | "BLOCKED_CREDENTIAL"
  | "BUDGET_EXHAUSTED"
  | "TIMED_OUT"
  | "STALE_RESULT"
  | "SCHEMA_ERROR"
  | "CANCELLED"
  | "EMPTY";
```

---

## 1. `TrustStrip`

Primary trust overview: Accounting / Exclusion / Concentration gates side-by-side.

### Props

```ts
interface TrustStripProps {
  accountingEligible: boolean;
  accountingCompleteness?: string; // e.g. "complete" | "partial"
  exclusionCoverage: ExclusionCoverage;
  concentrationEligible: boolean;
  /** Optional preformatted labels from mapper — preferred over re-deriving */
  accountingLabel?: TrustLabel;
  exclusionLabel?: TrustLabel;
  concentrationLabel?: TrustLabel;
  warnings?: WarningView[] | string[];
  ruleVersion?: string;
  observedAt?: IsoTimestamp | null;
  loading?: boolean;
  error?: string | null;
}
```

### Allowed states

All result-bearing UI states; hidden on pure input (`IDLE` without prior result), `SCHEMA_ERROR` (fail-closed), `BLOCKED_CREDENTIAL` without payload.

### Null rules

| Prop | Null/missing |
|------|----------------|
| `observedAt` | Show `—`; do not invent clock |
| labels | Fall back to **display mapping only**: eligible→CONFIRMED else UNVERIFIED/PARTIAL from completeness string already provided — **not** a new judgment |

### Loading / error

- `loading`: three skeleton badges; no fake CONFIRMED  
- `error`: strip error text; no gate values  

### a11y

- Region `aria-label="Trust gates"` / `可信度门闩`  
- Each gate: `aria-label` includes name + label text  
- Do not rely on color alone (`TrustBadge` + text)

### Source display

Optional footer: `ruleVersion`, `observedAt` — no provider secrets.

### FORBIDDEN

- Computing eligibility from residual math  
- Setting concentration confirmed because accounting is confirmed  
- Using `judgmentEligibleDeprecated`

---

## 2. `TrustStatusCell`

Table cell for a single trust/status label.

### Props

```ts
interface TrustStatusCellProps {
  label: TrustLabel;
  title?: string; // tooltip / title attribute — explanatory, not a new judgment
  verificationStatus?: VerificationStatus;
  sourceTier?: SourceTier;
  loading?: boolean;
  emptyText?: string; // default "—"
}
```

### Allowed states

Any table/list context.

### Null rules

- Missing `label` → `emptyText`  
- `verificationStatus` only displayed if provided; never inferred from `label` string fuzzy match beyond CSS class helper  

### Loading / error

- loading: pulse placeholder  
- error: parent owns; cell shows `UNAVAILABLE` only if parent passes that label  

### a11y

- Expose text node; tooltip via `title` or accessible description  
- Icon `aria-hidden` if decorative

### Source display

If `sourceTier` provided, show `Tier-A` / `Tier-B` adjacent; Tier-B must not use “已确认” chrome even if mislabeled — if `sourceTier==="B"` && `verificationStatus==="confirmed"`, show **data error** badge (backend invariant broken), do not silently “fix”.

### FORBIDDEN

- Client “fixing” Tier-B confirmed  
- Mapping numeric scores to CONFIRMED

---

## 3. `EvidenceBadge`

Compact chip counting/linking evidence.

### Props

```ts
interface EvidenceBadgeProps {
  count: number;
  evidenceRefs?: EvidenceRefView[];
  onOpen?: () => void;
  loading?: boolean;
  disabled?: boolean;
}
```

### Allowed states

Result states with evidence; disabled when `count===0`.

### Null rules

- `evidenceRefs` null/undefined → badge uses `count` only  
- `count === 0` → muted “无证据 / No evidence”, not an error  

### Loading / error

- loading: “…”  
- error opening drawer: toast; badge stays  

### a11y

- `button` when clickable: `aria-label={`证据 ${count}`}`  
- Not a button when count 0  

### Source display

None beyond count; details in `EvidenceDrawer`.

### FORBIDDEN

- Fabricating evidence rows  
- Embedding raw provider payloads

---

## 4. `SourceBadge`

Shows source id + tier.

### Props

```ts
interface SourceBadgeProps {
  source: string;
  sourceTier: SourceTier;
  verificationStatus?: VerificationStatus;
  compact?: boolean;
}
```

### Allowed states

Any place provenance exists.

### Null rules

- Missing `source` → do not render badge (or `source=unknown` only if backend sent it)

### Loading / error

Parent-owned.

### a11y

- Text includes source name and tier  

### Source display

```text
{source} · Tier-{sourceTier} · {verificationStatus?}
```

### FORBIDDEN

- Renaming Tier-B sources to look first-hand  
- Dropping tier to save space in concentration headers (tier must remain visible near market/borrowed fields)

---

## 5. `VerificationBadge`

Explicit verification chip.

### Props

```ts
interface VerificationBadgeProps {
  verificationStatus: VerificationStatus;
  /** If true, parent already blocked confirmation (e.g. concentrationEligible=false) */
  forceUnverifiedDisplay?: boolean;
}
```

### Allowed states

Metrics, labels, clusters as provided.

### Null rules

- If status missing → render nothing or `UNAVAILABLE` only when parent passes explicit fallback prop (prefer parent pass-through)

### Loading / error

N/A.

### a11y

- ZH: `已确认` / `未核实`  
- EN: `Confirmed` / `Unverified`

### Source display

None.

### FORBIDDEN

- `forceUnverifiedDisplay` must **not** invent `confirmed`  
- If `forceUnverifiedDisplay`, always show unverified styling **even if** prop says confirmed (defensive display when gate fails) — log `ui.invariant.verification_gate_mismatch` for ops; do not recompute status into store

---

## 6. `WarningList`

### Props

```ts
interface WarningListProps {
  warnings: Array<string | WarningView>;
  maxVisible?: number;
  loading?: boolean;
  emptyMode?: "hide" | "show-empty"; // default hide
}
```

### Allowed states

All; especially PARTIAL, BUDGET_EXHAUSTED, FAILED.

### Null rules

- `warnings == null` → treat as `[]`  
- empty + `hide` → render null  

### Loading / error

- loading: skeleton lines  
- do not parse warning free text into new statuses  

### a11y

- `role="list"`; each item `role="listitem"`  
- Prefer `aria-live="polite"` when list replaces on poll  

### Source display

Warning codes only; no secret redaction needed if backend allowlists codes.

### FORBIDDEN

- Filtering out `credential_*` to look healthier  
- Translating codes into SUCCESS

---

## 7. `ObservedAt`

### Props

```ts
interface ObservedAtProps {
  observedAt: IsoTimestamp | null | undefined;
  label?: string; // default "observedAt"
  stale?: boolean; // from backend freshness or parent STALE_RESULT
}
```

### Allowed states

All result states.

### Null rules

- null/undefined → `—` / `unknown`  
- **Never** substitute `Date.now()` as observation time  

### Loading / error

- loading: placeholder  
- invalid ISO from backend → show raw string + warn (do not crash); parent may escalate SCHEMA if contract requires valid ISO  

### a11y

- Use `<time dateTime={observedAt}>` when valid  

### Source display

Clock only; pair with `SourceWatermark` nearby.

### FORBIDDEN

- Quietly updating timestamp on client poll without new payload  
- Labeling stale time as “just now” without stale flag

---

## 8. `SourceWatermark`

### Props

```ts
interface SourceWatermarkProps {
  sourceWatermark: string | null | undefined;
  watermarkRef?: string | null;
  title?: string;
}
```

### Allowed states

CA detail / task result.

### Null rules

- null → `—`  
- empty string → `—`  

### Loading / error

Parent-owned.

### a11y

- `aria-label="source watermark"`  
- mono font ok  

### Source display

Exact server string (e.g. `pagination_complete`, slot/cursor refs). No reinterpretation as “fresh”.

### FORBIDDEN

- Overwriting watermark client-side  
- Inferring freshness solely from watermark string without policy fields

---

## 9. `TaskLifecycle`

### Props

```ts
interface TaskLifecycleProps {
  uiState: CaUiState;
  taskId?: string | null;
  parentTaskId?: string | null;
  lineageRootId?: string | null;
  apiStatus?: string | null;
  failureReason?: string | null;
  startedAt?: IsoTimestamp | null;
  endedAt?: IsoTimestamp | null;
  mint?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  retryAllowed?: boolean;
  cancelAllowed?: boolean;
  loading?: boolean;
}
```

### Allowed states

All CA flow states (maps badge/copy from state machine doc).

### Null rules

- No `taskId` in IDLE/VALIDATING → hide id row  
- `failureReason` only when failed/blocked/timeout/budget  

### Loading / error

- SUBMITTING/QUEUED/RUNNING: progress semantics without fake %  
- error path: show reason code string as delivered  

### a11y

- Status text in heading live region on change: `aria-live="polite"`  
- Actions labeled: 取消 / 重试  

### Source display

Show `apiStatus` and `uiState` both if they differ (debug honesty).

### FORBIDDEN

- Collapsing `BLOCKED_CREDENTIAL` into `FAILED`  
- Retry that reuses same taskId as “continue” without API contract  
- Auto-retry loops

---

## 10. `TaskBudgetMeter`

### Props

```ts
interface TaskBudgetMeterProps {
  requestBudget: number;
  requestsUsed: number;
  /** When true, force exhausted chrome even if used < budget (backend status) */
  exhausted?: boolean;
  uiState?: CaUiState;
  loading?: boolean;
}
```

### Allowed states

SUBMITTING → terminal; emphasis on `BUDGET_EXHAUSTED`.

### Null rules

- If budget unknown (`null` from API) → show `预算未知 / Budget unknown`, not 0/0 success  

### Loading / error

- loading: indeterminate bar  
- used > budget (invariant break) → show as exhausted + warning, do not clamp silently without flag  

### a11y

- `role="progressbar"` with `aria-valuenow={used}` `aria-valuemax={budget}`  
- Text alternative: `{used}/{budget}`  

### Source display

Numbers only from props.

### FORBIDDEN

- Client estimating remaining RPC calls  
- Treating `used===budget` + incomplete as SUCCEEDED  
- Hiding meter on budget exhausted

---

## 11. `HolderUniverseTable`

### Props

```ts
interface HolderUniverseRow {
  address: string;
  balanceRaw: string;
  rank?: number;
  ownerAddress?: string;
  exclusionReason?: string;
  clusterId?: string;
  confidence?: number;
  ruleVersion?: string;
}

interface HolderUniverseTableProps {
  universeKey:
    | "raw_top_holders"
    | "owner_aggregated_holders"
    | "cleaned_top_holders"
    | "excluded_infrastructure"
    | "excluded_pools"
    | "excluded_burn_addresses"
    | string;
  rows: HolderUniverseRow[] | null | undefined;
  ruleVersion?: string;
  completeness?: string;
  verificationStatus?: VerificationStatus;
  provenance?: SourceProvenanceView;
  warnings?: string[];
  loading?: boolean;
  error?: string | null;
  /** UI state gate: hide confirmed chrome in PARTIAL etc. */
  uiState?: CaUiState;
}
```

### Allowed states

PARTIAL, SUCCEEDED, STALE_RESULT, BUDGET_EXHAUSTED (if partial payload), RUNNING (if stream).

### Null rules

- `rows == null` → section unavailable message (not empty success)  
- `rows == []` → empty table inside universe (may be valid); pair with EMPTY only if page-level empty policy  
- balances always strings; never Number() for chain math display beyond formatting  

### Loading / error

- loading: skeleton rows  
- error: error row; no placeholder holders  

### a11y

- Table headers required  
- Address cells `mono`; copy button labeled  

### Source display

Header: universe key + `SourceBadge` / provenance + `ObservedAt` if in provenance.

### FORBIDDEN

- Merging universes client-side  
- Re-ranking by client balance parse  
- Treating `raw_top_holders` as cleaned investors

---

## 12. `ConcentrationTable`

### Props

```ts
interface ConcentrationTableProps {
  /** Server map e.g. top1, top5, top10, … or cohort metrics */
  metrics: Record<string, RatioMetricView | null | undefined>;
  universeDefinition: string;
  concentrationEligible: boolean;
  concentrationWarnings?: string[];
  ruleVersion?: string;
  loading?: boolean;
  error?: string | null;
  uiState?: CaUiState;
}
```

### Ratio display contract

```ts
function formatRatioDisplay(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) {
    return "暂不可确认"; // EN locale: "Not confirmable"
  }
  return `${(ratio * 100).toFixed(2)}%`;
}
```

### Allowed states

Same as holder tables; **confirmed styling** only when:

```text
concentrationEligible === true
AND metric.verificationStatus === "confirmed"
AND ratio !== null
AND uiState not in {PARTIAL, BUDGET_EXHAUSTED, SCHEMA_ERROR, BLOCKED_CREDENTIAL}
  // PARTIAL: may still show number as observational IF ratio non-null AND unverified badge forced
```

In `PARTIAL` / non-eligible: show numerator/denominator if present; ratio column uses formatRatioDisplay; badge UNVERIFIED.

### Null rules

| Case | UI |
|------|-----|
| metric object null | row UNAVAILABLE / — |
| `ratio: null` | **暂不可确认**, never 0% |
| missing verificationStatus | treat as unverified display |

### Loading / error

Standard.

### a11y

- Column headers: Metric, Numerator, Denominator, Ratio, Verification  
- Announce “not confirmable” as text, not color only  

### Source display

`universeDefinition` + per-metric `ruleVersion` / provenance if present.

### FORBIDDEN

- `numerator/denominator` division in UI to fill null ratio  
- Labeling as “已清洗投资者控盘率” when `concentrationEligible === false`  
- Promoting borrowed hotpath top10Pct to confirmed

---

## 13. `DataQualityTable`

### Props

```ts
interface DataQualityIssueView {
  code: string;
  severity: string;
  affectedRecordCount?: number;
  affectedBalance?: string;
  whetherManualReviewRequired?: boolean;
  evidence?: string[];
}

interface DataQualityTableProps {
  issues: DataQualityIssueView[] | null | undefined;
  loading?: boolean;
  error?: string | null;
}
```

### Allowed states

Result states.

### Null rules

- null/[] → empty quality message (not error)  
- `whetherManualReviewRequired` only from field — surface 人工复核 tag  

### Loading / error

Standard.

### a11y

Table with severity text, not color-only.

### Source display

`evidence[]` as refs into EvidenceDrawer.

### FORBIDDEN

- Dropping issues client-side  
- Auto-clearing manual review flags

---

## 14. `AddressHitTable`

Library / wallet hits against CA holders.

### Props

```ts
interface AddressHitRow {
  address: string;
  labels: string[];
  verificationStatus: VerificationStatus | "verified" | "unverified";
  sourceTier?: SourceTier;
  alphaScoreTier?: string | null;
  confidence?: number;
}

interface AddressHitTableProps {
  hits: AddressHitRow[] | null | undefined;
  loading?: boolean;
  error?: string | null;
  emptyReason?: string;
}
```

### Allowed states

Result / wallet / address pages.

### Null rules

- null → unavailable  
- [] → EmptyState-ish row: empty ≠ error  

### Loading / error

Standard.

### a11y

Labels listed as list inside cell.

### Source display

Per-label source if available; default unverified for library borrowed tags.

### FORBIDDEN

- Client scoring / re-tiering alpha  
- Confirmed from label text heuristics

---

## 15. `EvidenceDrawer`

### Props

```ts
interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  evidenceRefs: EvidenceRefView[];
  /** Optional preloaded allowlisted snippets from API — never secrets */
  snippets?: Array<{ ref: string; text: string }>;
  warnings?: string[];
  ruleVersion?: string;
  observedAt?: IsoTimestamp | null;
  sourceWatermark?: string | null;
  loading?: boolean;
  error?: string | null;
}
```

### Allowed states

When parent has refs; blocked on SCHEMA_ERROR for judgment evidence.

### Null rules

- empty refs → drawer body EmptyState  

### Loading / error

- loading: spinner  
- error: fail message; do not show stale secrets  

### a11y

- `role="dialog"` `aria-modal="true"`  
- focus trap; Escape closes  
- initial focus close button or title  

### Source display

Show watermark + observedAt in header.

### FORBIDDEN

- Fetching provider APIs from drawer  
- Displaying DPAPI paths, API keys, cookies  

---

## 16. `EmptyState`

### Props

```ts
interface EmptyStateProps {
  title: string;
  description?: string;
  /** Must not look like error */
  tone?: "neutral" | "info";
  actionLabel?: string;
  onAction?: () => void;
  code?: string; // e.g. result.empty
}
```

### Allowed states

`EMPTY`, empty tables, empty lists.

### Null rules

N/A.

### Loading / error

Do not reuse for load errors (use error panel).

### a11y

- Not `role="alert"` (alert implies error)  
- Use `status` or plain region  

### Source display

Optional meta line.

### FORBIDDEN

- Red error styling  
- Equating empty with FAILED

---

## 17. `BlockedState`

Credential / policy block full panel.

### Props

```ts
interface BlockedStateProps {
  kind: "credential" | "policy" | "other_block";
  title?: string;
  message: string;
  failureReason?: string | null;
  taskId?: string | null;
  runbookHref?: string; // docs only, no secrets
  onRetry?: () => void;
  retryAllowed?: boolean;
}
```

### Allowed states

`BLOCKED_CREDENTIAL` (kind=`credential`); other blocks if product expands.

### Null rules

- missing reason → still show credential blocked generic copy  

### Loading / error

N/A.

### a11y

- `role="alert"` appropriate for block  
- Distinct from generic failed region labeling  

### Source display

Reason code only.

### FORBIDDEN

- Using Failed illustration/copy  
- Rendering env keys or “paste your API key” into console storage without Owner-approved flow (out of scope for V1 shell)

---

## 18. `PartialBanner`

### Props

```ts
interface PartialBannerProps {
  warnings?: string[];
  completeness?: string | number | null;
  message?: string;
}
```

### Allowed states

`PARTIAL`, partial stream under `RUNNING`, partial under `BUDGET_EXHAUSTED`.

### Null rules

Default message from state machine if message missing.

### Loading / error

Always visible when parent mounts it — not dismissible without audit trail (optional dismiss is session-only, must not remove warnings list).

### a11y

- `role="status"` or `alert` if severity high  
- Bilingual default: 部分结果 / Partial result  

### Source display

Completeness figure if server-provided.

### FORBIDDEN

- Dismiss forever that hides PartialBadge on tables  
- Claiming concentration confirmed while banner visible

---

## 19. `StaleBanner`

### Props

```ts
interface StaleBannerProps {
  observedAt?: IsoTimestamp | null;
  sourceWatermark?: string | null;
  message?: string;
  onRefresh?: () => void;
}
```

### Allowed states

`STALE_RESULT` always; may stack with PartialBanner.

### Null rules

Still show “过期 / Stale” without times if missing.

### Loading / error

N/A.

### a11y

- `role="status"`  
- Must remain visible while data shown  

### Source display

`observedAt` + watermark mandatory fields in banner body when present.

### FORBIDDEN

- “Latest” wording  
- Auto-hide after timeout  
- Refresh that mutates old task row into new without new id

---

## 20. `SchemaErrorBoundary`

### Props

```ts
interface SchemaErrorBoundaryProps {
  schema?: string | null;
  version?: string | null;
  issues?: string[];
  taskId?: string | null;
  children?: React.ReactNode; // only non-judgment chrome
}
```

### Behavior

```text
ON schema mismatch OR validate fail-closed:
  DO NOT render children judgment trees
  DO render error panel + task meta
```

### Allowed states

`SCHEMA_ERROR`.

### Null rules

Unknown schema string still blocks.

### Loading / error

This component **is** the error UX.

### a11y

- `role="alert"`  
- List issues  

### Source display

schema + version only.

### FORBIDDEN

- Rendering `children` judgment sections “anyway”  
- Stripping unknown keys and displaying remainder as valid v1

---

## 21. `FixtureLiveIndicator`

### Props

```ts
interface FixtureLiveIndicatorProps {
  mode: "fixture" | "http";
  live: boolean;
  note: string;
}
```

Maps from `getDataSourceMeta()`.

### Allowed states

Global layout (all pages).

### Null rules

If meta missing → fail-closed note `unknown data source` + treat as non-live.

### Loading / error

Always show something; never blank that could be mistaken for Live.

### a11y

- Banner region labeled 数据源 / Data source  

### Source display

```text
fixture + live=false → "Fixture / scrubbed · Live 未接入"
http + live=false → note (e.g. not_configured)
live=true → explicit Live indicator (Owner-gated product only)
```

### FORBIDDEN

- Setting `live=true` in frontend config without backend meta  
- Hiding fixture banner in shell phase

---

## Cross-component composition rules

```text
Layout
  FixtureLiveIndicator
  page
    TaskLifecycle
    TaskBudgetMeter
    BlockedState | SchemaErrorBoundary | EmptyState
    PartialBanner?
    StaleBanner?
    TrustStrip
    HolderUniverseTable*
    ConcentrationTable
    DataQualityTable
    AddressHitTable
    WarningList
    ObservedAt + SourceWatermark
    EvidenceBadge → EvidenceDrawer
```

### Data flow

```text
DataSource / HTTP adapter
  → page view-model (pass-through map)
    → components (display only)
```

No component imports domain cleaners, ratio builders, or provider SDKs.

---

## Mapper allowlist (page-level, still not “business judgment”)

Allowed in thin mappers:

- shortMint  
- formatRatio null → 暂不可确认  
- trustClass CSS from label string  
- accountingLabel(eligible, completeness) **display helper only if backend did not send label** — must match shell `format.ts` semantics  
- UI state from API status table in state machine doc  

Disallowed in mappers:

- eligibility boolean invention  
- ratio math  
- Tier promotion  

---

## Acceptance checks (components)

1. ConcentrationTable never prints `0%` for null ratio.  
2. TrustStrip concentration never uses judgmentEligible.  
3. BlockedState copy ≠ Failed copy.  
4. TaskBudgetMeter exhausted state ≠ success color.  
5. SchemaErrorBoundary blocks children judgment.  
6. StaleBanner visible whenever stale data shown.  
7. FixtureLiveIndicator always mounted in shell.  
8. No component fetches Helius/GMGN/RPC.  

## Document control

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2026-07-31 | Pseudo-contracts for Operator Console V1 components |
