# Phase 0 — Google Cloud Console Setup Checklist

**Status:** DEFERRED — to be completed by user before Phase 4 begins
**Plan:** 00-07 (autonomous=false, resume signal "skip" taken per one-shot execution directive)
**Created:** 2026-05-15

## Why This Is Deferred (Not Confirmed)

Plan 00-07 is a non-autonomous, external-service configuration step that requires the user to click through the Google Cloud Console. During this one-shot Phase 0 execution the user instructed the orchestrator to push through without pausing for the "confirmed" gate, so the checklist is recorded here as a **pending action item** rather than as a completed event. Phase 4 (the Maps integration phase) MUST NOT begin until every box below is checked and the file is updated in place with a real confirmation date.

This file exists in version control to serve as a permanent reminder that:
1. The mitigations for Pitfall 4 and Pitfall 5 from `.planning/research/PITFALLS.md` are NOT yet in place.
2. No Maps JavaScript API key has been provisioned, and none must be pasted into the repo.

## Steps Required (User Must Complete Before Phase 4)

The user must click through these four steps in the Google Cloud Console and then return to this file, replace each `[ ]` with `[x]`, and add the confirmation date + name at the bottom.

- [ ] **Enable the Maps JavaScript API on a Google Cloud project.**
  Location: Google Cloud Console → APIs & Services → Library → Maps JavaScript API → Enable.

- [ ] **Set a Queries Per Day (QPD) quota cap on the Maps JavaScript API.**
  Location: Google Cloud Console → APIs & Services → Quotas → Maps JavaScript API → Edit. Recommended cap for personal use: 1000 requests/day.

- [ ] **Set up budget alerts at $5, $20, and $50 thresholds.**
  Location: Google Cloud Console → Billing → Budgets & alerts → Create budget.

- [ ] **Create an API key restricted to HTTP-Referrers `http://localhost/*` and `http://127.0.0.1/*`.**
  Location: Google Cloud Console → APIs & Services → Credentials → Create credentials → API key, then click the new key → Application restrictions → HTTP referrers → add `http://localhost/*` and `http://127.0.0.1/*`.

## Mitigations These Steps Close

- **Pitfall 4** (HTTP-referrer restriction works because Phase 0's HTTP server runs on `http://127.0.0.1:<ephemeral-port>/`, which Chromium normalizes to the `localhost` referrer policy — the localhost referrer is on the allowed list, so legitimate requests succeed; any leak of the key from elsewhere is blocked).
- **Pitfall 5** (billing surprise from satellite tile usage + unrestricted key — capped by the QPD quota cap and the budget alerts).

References: `.planning/research/PITFALLS.md` Pitfall 4, Pitfall 5; `.planning/phases/00-foundation-bootstrap/00-RESEARCH.md` Pitfall 8.

## API Key Storage

The API key value is NOT stored in this repository. It will be entered at runtime via the Phase 4 settings UI, which persists it via `electron-store` to the OS user-data directory (`~/Library/Application Support/AntiClicker/config.json` on macOS) outside version control. Plan 00-07 acceptance criteria explicitly forbid pasting any `AIza…`-prefixed key into this file.

## Confirmation (To Be Filled When Steps Complete)

- Completed by: _to be filled_
- Date confirmed: _to be filled (ISO-8601)_
- Phase 4 gate: Phase 4 plan-phase MUST verify this section is filled before proceeding.
