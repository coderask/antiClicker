# Phase 0 — Google Cloud Console Setup Checklist

**Status:** OPTIONAL — enables Google Maps satellite (higher zoom). Without it, the app uses Esri World Imagery (free, lower zoom). Required only if you want building-level satellite imagery.
**Updated:** 2026-05-15 (v0.0.5)
**Plan:** 00-07 (originally NOT REQUIRED for v1; reinstated as optional in v0.0.5)

## Background

In v0.0.5, AntiClicker gained support for Google Maps JavaScript API as an optional higher-resolution satellite backend. The `googleMapsApiKey` slot in `electron-store` (defined in `src/main/config-store.ts`) is now actively used when a key is configured.

**Without a key:** The app uses Esri World Imagery via MapLibre (free, no account required, maxes out around zoom 17).

**With a key:** The app uses Google Maps hybrid view (satellite + labels), which supports zoom 21+ including building-level imagery. The key is stored in electron-store (OS user-data dir) and never committed to source control.

## Google Cloud Console Setup (do these steps only to enable Google Maps)

1. **Enable the API.** Console → APIs & Services → Library → search "Maps JavaScript API" → Enable.

2. **Set a quota cap.** Console → APIs & Services → Quotas → Maps JavaScript API → Edit → set Queries Per Day to ~1000 for personal use. This closes Pitfall 5 (billing surprise from runaway usage).

3. **Set up budget alerts.** Console → Billing → Budgets & alerts → Create budget → set thresholds at $5, $20, $50. Belt-and-suspenders against Pitfall 5.

4. **Create and restrict the API key.** Console → APIs & Services → Credentials → Create credentials → API key. Click the new key and add:
   - Application restrictions → HTTP referrers
   - Add `http://localhost/*` and `http://127.0.0.1/*`
   This closes Pitfall 4 (unrestricted key usable from any domain).

5. **Copy the key into the app.** Two paths:
   - **Option A (production):** Click the ⚙ cog in the AntiClicker bottom bar, paste the key, press Save. Stored in electron-store — survives app restarts.
   - **Option B (development):** Copy `.env.template` → `.env.local`, fill in `GOOGLE_MAPS_API_KEY=AIza...`, run `npm run dev`. The main process reads it on startup and writes to electron-store.

## Pitfalls Addressed

- **Pitfall 4** (HTTP-referrer restriction): Mitigated by step 4 above — key restricted to `localhost/*` only.
- **Pitfall 5** (billing surprise): Mitigated by steps 2 and 3 above — QPD cap + budget alerts.

Both pitfalls are still fully closed by **not using Google Maps** (when no key is configured, the Esri/MapLibre path runs with zero Google billing relationship).

## What's in the Repo

- `src/main/config-store.ts` — `googleMapsApiKey` field in ConfigSchema (string | null, default null)
- `src/main/load-env-key.ts` — inline .env.local parser (reads GOOGLE_MAPS_API_KEY without dotenv)
- `src/renderer/src/map/GoogleMapView.tsx` — Google Maps backend component
- `.env.template` — template for `.env.local` (safe to commit, contains no secrets)
- `.gitignore` — `.env.local` is gitignored
