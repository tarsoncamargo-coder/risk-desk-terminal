# Risk Desk — Confluence Engine V1

## Status

Implementation branch: `riskdesk-implementation-v1`

This engine is context/research only.

Hard governance:
- probability_of_profit = false
- trade_signal = false
- entry_filter = false
- operational_authorized = false

## Purpose

Confluence V1 answers one question:

> Are the independent directional layers that are currently valid pointing in the same direction, or are they in conflict?

It does not estimate profit probability and does not create a weighted score.

## Anti-double-counting rule

Cross-asset inputs (NQ, DXY, rates, risk/volatility, Sigma) are already synthesized by Market State V2.

Therefore cross-asset is displayed as evidence, but it is not counted as a second independent directional vote.

## Directional layers counted

Only three layers can contribute a directional vote in V1:

1. Market State V2
   - RISK_ON -> UP
   - RISK_OFF -> DOWN
   - MIXED / NEUTRAL / WAITING / STALE / UNAVAILABLE -> no vote
   - only a LEITURA_DISPONIVEL is eligible

2. Structural Playbook
   - GOLDILOCKS / REFLATION -> UP
   - STAGFLATION / DISINFLATIONARY_RISK_OFF -> DOWN
   - TRANSITION_OR_INSUFFICIENT -> no vote
   - CONFIRMED and PARTIAL can supply context; PARTIAL prevents final HIGH

3. GEN2 Shadow
   - ALTA -> UP
   - BAIXA -> DOWN
   - only prospective_fresh=true and shadow_only=true is eligible

## Layers deliberately not converted into directional votes

### Event semantics

HAWKISH / DOVISH / MIXED describes the macro release, not automatically the Nasdaq direction.

The event layer is context-only in V1.

If the event has semantic conflict (MIXED or ConflitoSemantico=true), HIGH is capped to MODERATE.

### GEN1

GEN1 remains historical/contextual.

Range, MFE, MAE, PB50, PB70 and REV100 are shown to describe expected behavior/risk, not converted into a new directional vote.

If PB50_PB70_CONFLITO=true, HIGH is capped to MODERATE.

No probability threshold is invented for PB/REV.

## State machine

Let:
- A = number of valid directional layers
- U = layers pointing UP
- D = layers pointing DOWN

Rules:

- if U > 0 and D > 0 -> CONFLICT
- else if A = 3 -> HIGH
- else if A = 2 -> MODERATE
- else if A = 1 -> LOW
- else -> INDETERMINATE

Direction:
- U > 0 and D = 0 -> UP
- D > 0 and U = 0 -> DOWN
- otherwise -> NONE

HIGH is capped to MODERATE if any of these is true:
- event semantic conflict
- GEN1 PB50/PB70 conflict
- Playbook is not CONFIRMED

## Evidence coverage

- FULL = 3 directional layers
- PARTIAL = 2
- MINIMAL = 1
- NONE = 0

Coverage is not confidence and not probability.

## Risk Desk Analysis

Risk Desk Analysis V1 is deterministic text assembled from structured fields only:

- event semantics
- Market State V2
- Playbook
- GEN1 context
- GEN2 Shadow
- Confluence result
- main structured risk

It does not use free-form narrative generation in the live website.

## Current expected pre-event behavior

Before a fresh event, if:
- Market State is WAITING/STALE
- Playbook is transition/insufficient
- GEN2 is waiting POST5

then the correct result is:

- confluence_level = INDETERMINATE
- direction = NONE
- evidence_coverage = NONE

This is a valid fail-closed state, not an error.

## Future governance

Do not add weights or numeric confidence until prospective history is large enough to evaluate:
- GEN2 with/without Market State confirmation
- performance by Playbook
- conflict vs aligned states
- family-specific event behavior
- GEN1 reversal/pullback risk interaction

Any future change must become a new methodology version rather than rewriting V1 history.
