# OutdoorAdvisor Agent Notes

This file is the quick-start context for any agent working in this repo.
Update it whenever the product, workflow, or important assumptions change.

## Project

OutdoorAdvisor is a Pakistan-focused outdoor decision app built with Expo / React Native and deployed on Vercel.

Production site:
- `https://outdooradvisor.vercel.app`

Primary focus:
- outdoor decision guidance
- travel safety and route awareness
- activity suitability
- lightweight premium features

It is not meant to feel like a generic weather app.

## Current Product Areas

### Home
- Live conditions hero
- Outdoor decision card
- `What today means` summary card
- ranked activity advisory
- travel quick checks
- optional premium weather detail sections

### Travel
- National Highways & Motorway Police live advisories
- Pakistan Meteorological Department forecasts and alerts
- motorway and corridor route cards
- premium experimental route planner tab
- premium stop-by-stop route scan
- AI travel insight

### Activities
- ranked activity scores
- time-of-day aware scoring
- gym included as an activity
- nearby places integration is premium

### Settings
- thresholds
- notifications
- customize home layout
- about
- real Supabase auth UI

## Current Architecture

### Client
- Expo / React Native app with web export
- main screens live under `src/screens`
- hooks and data-fetch helpers under `src/hooks`, `src/utils`, and `src/config`

### Server Routes on Vercel
- Google weather, AQI, pollen, and geocode are proxied through Vercel API routes
- AI summaries are served through `/api/ai/briefing`
- NHMP and PMD are scraped/proxied through server routes

### AI
- Home and Travel use `src/hooks/useAiBriefing.js`
- AI route supports Gemini
- server-side env var for Gemini must be `GEMINI_API_KEY`
- do not reuse the public Maps / Weather browser key for Gemini

### Auth
- Supabase auth is wired in
- auth is intended to stay optional for now
- current env vars:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Premium
- premium gating logic lives in `src/lib/premium.js`
- some premium checks are UI-side and some are server-enforced
- known premium user allowlist exists for now as a temporary bridge before store subscriptions
- route planner is premium and experimental

## Important Current Truths

- GitHub remote is configured and working from this machine
- Vercel project is configured and linked from this machine
- production deploys have been triggered manually from this repo with `vercel deploy --prod --yes`
- do not assume Vercel is only relying on auto-deploy from GitHub; manual prod deploy has been the current workflow
- notifications, subscriptions, and privacy/legal hardening are not finished for full app-store readiness
- real App Store subscriptions are not implemented yet
- NHMP source is not an API; it is scraped from:
  - `https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx`

## NHMP Notes

- NHMP is flaky and sometimes returns an ASP.NET timeout/error page instead of real advisory HTML
- current fix lives in `api/nhmp.js`
- the route now rejects NHMP error pages instead of treating them like valid content
- there is also a fallback snapshot in `api/_data/nhmpFallback.js`
- Travel screen should prefer server data on web so browser-side direct fetch does not dominate/fail first

## UX Direction

- cleaner, calmer layout
- fewer always-open detail blocks
- use collapsible sections when data lists get too long
- keep weather detail secondary to decision-making
- avoid redundant location labels
- premium UI should feel subtle, not noisy

## Workflow Notes

- use `apply_patch` for manual file edits
- do not touch unrelated `.claude/worktrees/*` files
- especially ignore `.claude/worktrees/relaxed-solomon`
- after meaningful product changes:
  - build with `npx expo export -p web`
  - push to GitHub
  - deploy to production on Vercel
- for docs-only changes, build/deploy is optional
- **always update this AGENTS.md file after every repo change**
  - log what changed under `Recent Changes` below
  - update architectural sections if the change affects them
  - keep this file current so the next agent has accurate context

## Good First Checks Before Editing

1. Inspect `git status --short`
2. Confirm whether the change is user-facing or internal
3. Read the relevant screen or API route directly
4. Preserve recent UI tone and product direction
5. Update this file if the change materially affects future work

## Suggested Next Internal Updates

- keep this file current when premium rules change
- update it when auth, subscriptions, or app-store hardening starts
- update it when a new major route, AI behavior, or notification rule is added

## Recent Changes

### 2026-04-17 — Route planner: explicit Plan-route button + motorbike restriction
- `src/screens/RoutePlannerScreen.js`: added `hasSearched` state + a primary "Plan route" button. Auto-fetch of NHMP/PMD/AQI now only fires after the user taps the button; changing From/To/Vehicle invalidates the prior search. New copy ("Ready when you are…") replaces results area until first tap. Button disables to "Pick two different cities" when From === To
- `src/components/VehicleToggle.js`: consolidated to `Car · EV · Motorbike` (dropped the duplicated bicycle-emoji `bike` and `motorcycle` options). Exports `VEHICLES_BANNED_FROM_MOTORWAY = new Set(['motorbike'])` for scoring reuse
- `src/utils/routePlanner.js`: `scorePlannerCandidates(candidates, nhmpData, pmdAlerts, stopConditions, { vehicleType })` — when vehicle is motorbike and any leg is `routeKind: 'motorway'` (M-1..M-9), adds +220 risk, flips tone to red with recommendation "Not allowed", and prepends a reason like "Motorbikes are not permitted on M2 Islamabad-Lahore — Pakistan motorway rules". Non-motorway alternates (N-series highways, E-35 expressway, N-15 mountain) rank above motorway options naturally via the risk penalty
- Verified with `npx expo export -p web` — 685 modules bundled, no errors

### 2026-04-16 — Night-aware hero banner (no more sun at night)
- `src/utils/weatherCodes.js`: added `isNight(when, sunrise?, sunset?)` helper and an optional `{ isNight }` option to `getWeatherDescription`. When night, clear-sky `0` maps to 🌙, partly cloudy `1–3` maps to ☁️
- `src/screens/HomeScreen.js`: computes `nightMode` from current time + today's sunrise/sunset (falls back to 6am–6:30pm window). Passes it into `AQIHeroCard`
- `src/components/AQIHeroCard.js`: `getHeroTheme` now takes `isNight` and returns a deep indigo (#1F2A44) / slate (#2A3552) palette for clear and partly-cloudy nights so the orange sunny background no longer shows at night
- Only the Home hero is night-aware so far — forecast strips still use day icons. Can be extended later by threading `isNight` through `ForecastStrip` / `HourlyForecastStrip`
- Verified with `npx expo export -p web` — bundles cleanly

### 2026-04-16 — Route Planner declutter + vehicle toggle
- Replaced the supported-cities chip grid (~24 chips) on `RoutePlannerScreen` with two tap-to-open pickers
- New component `src/components/CityPicker.js`: tappable field → bottom-sheet modal with searchable city list. Works on iOS, Android, and Web (no Google SDK needed — unlike `PlacesAutocomplete.js` which is web-only)
- New component `src/components/VehicleToggle.js`: pill-style single-select row (Car · EV · Bike · Moto). Exports `VEHICLE_OPTIONS` for reuse
- `RoutePlannerScreen.js` now has: hero → From/Swap/To picker row → Vehicle toggle → Quick pairs → results. Removed `selectorHeader`, `selectorColumn`, `selectorValue`, `swapBtn*`, `cityGrid`, `cityChip*` styles (replaced by `pickerRow` + `swapCircle` + `swapArrow`)
- `vehicleType` state added (default `car`). **Not yet wired into scoring** — planner still ranks routes by NHMP/PMD/AQI. Vehicle-aware scoring (EV range, bike elevation, moto weather sensitivity) is the next follow-up
- Verified with `npx expo export -p web` — 685 modules bundled (2 new), no errors
- Known limitation to address in a follow-up: **login screen shows "not configured" placeholder** in Settings tab when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env vars are missing locally. In production (Vercel) they are set. For local dev / simulator runs, add a `.env` file at repo root with both keys, then restart Metro

### 2026-04-16 — Bottom tab bar label polish
- Fixed wrapping tab labels ("Hom e", "Trave l", "Plann er", "Activi ties", "Setti ngs")
- Edits applied in `App.js`:
  - `TabIcon` `<Text>` now uses `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.85}`
  - `tabIconContainer` gains `width: '100%'` and `paddingHorizontal: 2`
  - `tabLabel` font sized to 10.5, `textAlign: 'center'`, `includeFontPadding: false`, `letterSpacing: 0.1`
  - `tabBarStyle` height / paddingBottom now platform-aware (iOS 78/18, else 68/8) so iOS safe-area is respected
- Verified with `npx expo export -p web` — 683 modules bundled, no errors
- Next candidate polish: remove duplicate AQI display in `AQIHeroCard` (shown in both info row and bottom snapshot card)
