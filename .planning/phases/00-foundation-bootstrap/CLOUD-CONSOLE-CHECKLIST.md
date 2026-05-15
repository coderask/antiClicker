# Phase 0 — Google Cloud Console Setup Checklist

**Status:** NOT REQUIRED for v1
**Decision Date:** 2026-05-15
**Plan:** 00-07 (originally pending user action; superseded by stack decision)

## Why This Is Not Required

The v1 stack ships **MapLibre GL JS + EOX S2cloudless satellite tiles** as the only basemap. Neither requires a Google Maps JavaScript API key. The Google Maps opt-in path was originally scoped as a future enhancement; per the 2026-05-15 decision, it is now explicitly **out of scope for v1** and the corresponding Cloud Console setup is therefore not required.

The `googleMapsApiKey: string | null` slot in `electron-store` (defined in `src/main/config-store.ts`) stays in the schema but remains unused in v1. A future minor version can add the opt-in surface without schema migration — the existing default of `null` is the "no key" sentinel.

## What This Means for Pitfalls 4 and 5

- **Pitfall 4** (HTTP-referrer restriction): not applicable — no key to restrict.
- **Pitfall 5** (billing surprise from unrestricted key): not applicable — no Google billing relationship.

Both pitfalls are closed by **not using Google Maps**, which is a stronger guarantee than capping a key after the fact.

## What's Still in the Repo

- `src/main/config-store.ts` still declares the `googleMapsApiKey` field. Untouched in v1; reserved for future opt-in. Acceptance criteria around the field stay as-is.
- This file remains as a historical record of the decision and as a pointer for the v1.x or v2 milestone if the Google Maps path is later revisited.

## If You Later Decide to Add the Google Maps Opt-In

The original four-step Cloud Console procedure is preserved below. Do these steps **only** if a future version reintroduces the Maps JavaScript API path:

1. Enable the Maps JavaScript API on a Google Cloud project. (Console → APIs & Services → Library → Maps JavaScript API → Enable)
2. Set a Queries Per Day (QPD) quota cap (~1000 req/day for personal use). (Console → APIs & Services → Quotas → Maps JavaScript API → Edit)
3. Set up budget alerts at $5, $20, $50 thresholds. (Console → Billing → Budgets & alerts → Create budget)
4. Create an API key restricted to HTTP-Referrers `http://localhost/*` and `http://127.0.0.1/*`. The key value goes through the in-app settings UI at runtime; never into version control.

These mitigations close Pitfall 4 and Pitfall 5 from `research/PITFALLS.md`. They are documented here for completeness but are not required for the v1 ship.
