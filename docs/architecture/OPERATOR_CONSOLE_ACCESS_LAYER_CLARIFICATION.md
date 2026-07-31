# ARCH-CONSOLE-CLARIFICATION-001

**Status:** binding clarification (does not change the four-layer architecture)  
**Date:** 2026-07-30  
**Depends:** GOAL-ENTRY-GATE-001

## Clarification

`PROJECT_ARCHITECTURE.md` states the product is **not a UI**. That sentence remains true.

The **Operator Console** (`apps/operator-console`) is an **access layer** only:

| Owns | Does not own |
| --- | --- |
| Browser presentation of view models | Provider credentials or provider I/O |
| Local API consumption over loopback | Domain rules / pure-function judgments |
| User input validation (mint shape) | Confirmed labels, Alpha branding, trade advice |
| Display of trust badges / PARTIAL / unavailable | Re-interpretation of Tier-A accounting |

Core barriers remain: **data contracts, Tier-A evidence, versioned pure rules, address sedimentation, and judgment evidence trails.**

## Required reading update

Agents must treat this note as part of required architecture reading after `PROJECT_ARCHITECTURE.md`. UI logic must not be written into `src/domain` or provider adapters. Domain/providers must not import React or console modules.

## Acceptance

- Four layers unchanged.
- Console never receives `HELIUS_API_KEY` or raw sensitive provider payloads.
- Judgment layer still does not fetch live data.
