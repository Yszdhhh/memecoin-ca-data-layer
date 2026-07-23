# SOL-E2E-GAP-RESEARCH-002: Solana E2E Gap and Dispatch Research

## 1. Executive Summary
This research maps the remaining gaps between the currently accepted standalone Solana components (Pump decoding, Holder snapshots, Dev history) and the constitutionally required end-to-end (E2E) analysis. The analysis identifies missing integrations in the application layer and required Owner decisions before the `SOL-E2E-001` milestone can be achieved.

## 2. Current State vs. E2E Gap Analysis

### 2.1. Creator Evidence & Pump Decoding
* **Current State:** `PumpInstructionDecoder` is fully audited (`GREEN`) and properly extracts creator evidence from pinned fixtures.
* **Gap:** `HeliusSolanaAdapter.getToken()` explicitly omits `creatorAddress` (line 164: `// Creator is intentionally omitted`). Because of this, `AnalysisService` fails to invoke Dev metrics (`dev: null` and warning emitted: "未能从创建指令/工厂事件中确认 creator"). The decoder is not yet wired to the adapter.

### 2.2. Holder Snapshot Processing
* **Current State:** `SolanaHolderSnapshotService` is audited (`GREEN`), properly handling duplicate cursors, `finalizedSlot` boundaries, and low-confidence clusters.
* **Gap:** `HeliusSolanaAdapter.getHolders()` currently performs naive token account aggregation directly from RPC responses. It completely bypasses `SolanaHolderSnapshotService`. Similarly, `AnalysisService` directly calls `calculateRealHolderConcentration` without utilizing the validated snapshot service's completeness and boundary checks.

### 2.3. Dev History & Behavior
* **Current State:** `SolanaDevHistoryService` is audited (`GREEN`), guaranteeing fail-closed creator binding and rejecting completeness on gapped/unfinalized history.
* **Gap:** `AnalysisService` implements its own isolated `buildDevBehavior()` (lines 193-218) that directly calls the domain logic `calculateDevBehavior`. This bypasses the audited `SolanaDevHistoryService`'s strict coverage checks (e.g., `hasTrustedCreatorEvidence`, `assessCoverage`), negating the protections verified in `SOL-DEV-REPAIR-AUDIT-001`.

### 2.4. Live CA & Provider Authorization
* **Current State:** Constitution mandates E2E analysis using both a pinned fixture and an explicitly authorized live-CA.
* **Gap:** As outlined in `OWNER_DECISIONS_NEEDED.md`, no live CA, RPC endpoint (Helius plan/key), or payload retention policy has been authorized by the Owner yet. `SOL-E2E-001` is currently blocked by these decisions.

## 3. Subsequent Task Dispatch

To reach `SOL-E2E-001` GREEN, the remaining work should be split into the following tasks:

### Task 1: `SOL-ADAPTER-INTEGRATION-001` (Implementation)
**Objective:** Wire the audited data services into the application adapter.
* Inject `PumpInstructionDecoder` into `HeliusSolanaAdapter` to populate `token.creatorAddress`.
* Replace `HeliusSolanaAdapter.getHolders()` naive aggregation with `SolanaHolderSnapshotService`.
* Refactor `AnalysisService` to use `SolanaDevHistoryService` instead of its internal `buildDevBehavior()`.
* **Deliverable:** Updated `analysis-service.ts` and `helius-solana-adapter.ts` with passing unit tests.

### Task 2: `SOL-OWNER-DECISION-001` (Governance)
**Objective:** Unblock live E2E testing by securing Owner authorization.
* Select a production Helius RPC endpoint/key.
* Nominate and authorize a specific live Pump.fun CA for the acceptance manifest.
* Define the retention policy for live response payloads.
* **Deliverable:** Updated `OWNER_DECISIONS_NEEDED.md` with explicit owner sign-off.

### Task 3: `SOL-E2E-001` (Milestone Execution)
**Objective:** Execute the E2E analysis pipeline and generate the acceptance manifest.
* Implement `test/integration/solana/pump-analysis.e2e.test.ts` utilizing the fully integrated `AnalysisService`.
* Run analysis against the pinned fixture and the Owner-authorized live CA.
* **Deliverable:** `harness/reports/SOL-E2E-001/acceptance.md` containing source watermarks, hashes, cleaning evidence, and correct metrics.

## 4. Conclusion
**Verdict: PARK**
The gaps are isolated purely to the application adapter layer (wiring) and pending governance decisions. However, the verdict is `PARK` because the project's `node_modules` is populated for `win32-x64` (from the G: drive), causing `tsx` (via `esbuild`) to crash with a missing binary error on this Darwin/arm64 agent. I am restricted from using the network to run `npm install` to correct the environment, so the required acceptance commands (`npm run harness:task` and `npm test`) cannot be completed successfully without a pristine environment.
