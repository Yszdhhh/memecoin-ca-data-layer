# Acceptance — HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001

## RED closure provenance

- Original independent audit manifest SHA-256: `f463bedd31caa991e890808798f5a1bade8413fe9e3265f6aa923cc782fe509f`; comment ID `5159384652`.
- Closed finding: `P1-FORBIDDEN-PATH-CASE-FAIL-CLOSED`.
- Base `fce42eeb560c85e4924399bdf08419f9ea7ba642`; starting HEAD `c7adf7376118e1c04fe139639a402940cc6b6559`; audited code anchor `d5230971b98539989e0c8cad427b92ddddbc6661`.
- Repair code anchor `d167e2d72b964ef9513e2bb8614250d781db7352` (parent `3b9dbaaca0b153c897f7f910774c4799fba33685`); evidence commit parent `d167e2d72b964ef9513e2bb8614250d781db7352`.
- Evidence commit SHA and post-push delivery HEAD are intentionally not predicted here; delivery HEAD must be fetched with authenticated `gh` after push.

## Repair semantics

- Normalize separators to `/`; apply the three documented scrubbed public artifact paths as an exact, case-sensitive allowlist.
- Case-fold only forbidden pattern matching inside `forbiddenTrackedFileMatches`; derive basename from normalized POSIX paths; leave global `globMatches` and write-set semantics unchanged.
- Dot-relative, traversal, extra-prefix/suffix, case-variant, raw/private, chainfm_out, and unrelated wallet-like paths remain rejected.
- Six exact `harness/tasks/WALLET-SHADOW-*.json` task-spec paths are excluded only from the doctor wallet-pattern scan because they are governed metadata rather than wallet artifacts; direct matcher coverage rejects a wallet-named task path.

## Path-boundary matrix

| Category | Cases | Expected | Result |
|---|---:|---|---|
| canonical allowlist cases | 3 | allowed | PASS |
| separator variants | 3 | allowed | PASS |
| filename case variants | 7 | rejected | PASS |
| directory case variants | 7 | rejected | PASS |
| dot-relative cases | 2 | rejected | PASS |
| traversal cases | 2 | rejected | PASS |
| private/raw cases | 6 | rejected | PASS |
| chainfm_out cases | 2 | rejected | PASS |
| unrelated wallet-like cases | 6 | rejected | PASS |

Two deterministic runs: identical output; all categories PASS.

## Formal validation

| Command | Started | Finished | Exit | Key result | Raw output SHA-256 |
|---|---|---|---:|---|---|
| `npm run harness:task -- validate harness/tasks/HARNESS-DOCTOR-FORBIDDEN-PATH-RULE-REPAIR-001.json` | 2026-08-03T10:44:36.5619907+08:00 | 2026-08-03T10:44:37.2264515+08:00 | 0 | PASS | `2d900bd1916afd7ecd3e7af9898f283cf4514f3f3da87a29b3cdc4588ea62011` |
| `npm run harness:doctor` | 2026-08-03T10:44:37.2399613+08:00 | 2026-08-03T10:44:38.6978771+08:00 | 0 | PASS | `2022c9b6796ce9f0156e4a999a71572fd1886161523f50d54de795f38e5cda4b` |
| `npm run typecheck` | 2026-08-03T10:44:38.7008757+08:00 | 2026-08-03T10:44:41.0866254+08:00 | 0 | PASS | `3abae08db5b04132f88cfa1814daa7b750b82c4a0b0a1370a54137a8b27afab8` |
| `npm test` | 2026-08-03T10:44:41.0886249+08:00 | 2026-08-03T10:44:44.5570547+08:00 | 0 | PASS | `5041d4980da13a8c9fac839661af34b3c2bccbe2f89c39e8f86d733f970f74b7` |
| `npm run build` | 2026-08-03T10:44:44.5630564+08:00 | 2026-08-03T10:44:47.1511953+08:00 | 0 | PASS | `6239db9cd264411159f68be40e450c93c143cb151f53d693a731ba58facd021f` |
| `npm run security:scan` | 2026-08-03T10:44:47.1531954+08:00 | 2026-08-03T10:44:47.7624486+08:00 | 0 | PASS | `8923f62f27a05ed5b801c4a8ebfa6fa154613dd2666317bd9fcafba0cf203eb1` |
| `git diff --check` | 2026-08-03T10:44:47.7644485+08:00 | 2026-08-03T10:44:47.8049592+08:00 | 0 | PASS | `f01a374e9c81e3db89b3a42940c4d6a5447684986a1296e42bf13f196eed6295` |
| `npm exec -- tsx path-boundary-test.ts` | 2026-08-03T10:46:09.9828559+08:00 | 2026-08-03T10:46:11.0230480+08:00 | 0 | all categories PASS | `30834b6f087643b1e09bba02302b42fa35e19f474174bb89197ac18d0506e883` |
| `npm exec -- tsx path-boundary-test.ts` | 2026-08-03T10:46:11.0350481+08:00 | 2026-08-03T10:46:12.0603284+08:00 | 0 | all categories PASS | `30834b6f087643b1e09bba02302b42fa35e19f474174bb89197ac18d0506e883` |

## Scope and privacy

- Implementation/test changes: `harness/cli.ts`, `test/harness.test.ts`; evidence changes only in the existing report directory.
- `harness/config/project.json` byte-for-byte unchanged; no product runtime, wallet business logic, dependencies, package scripts, or global glob/write-set changes.
- Security scan PASS with `classifiedLeaks=0`; no real wallet addresses, transaction hashes, raw provider output, private paths, credentials, or key material added.
- P0: none. P1: none after repair. P2: independent re-audit required before PR readiness/merge.
- Status: `GREEN_WITH_ADVISORY` for the repair, not merge-authorizing until independent re-audit completes on post-push delivery HEAD.
