# OutdoorAdvisor Agent Notes

This file is the quick-start context for any agent working in this repo.
Update it whenever the product, workflow, or important assumptions change.

## Project

OutdoorAdvisor is a Pakistan-focused outdoor decision app built with Expo / React Native and deployed on Vercel.

Production site:
- `https://outdooradvisor.vercel.app`

Brand domain:
- `outdooradvisor.app` has been purchased through Vercel on April 22, 2026
- treat it as the intended public-facing brand domain for About, contact, support, and feedback surfaces
- do not assume it is already fully connected/live unless the domain setup has been explicitly verified
- branded contact addresses to use by default:
  - `support@outdooradvisor.app`
  - `feedback@outdooradvisor.app`
  - `privacy@outdooradvisor.app`

Domain / email ops notes:
- current CLI project scope is `ahmadadnanone-6336s-projects`, but `vercel domains ls` there returns zero domains
- `outdooradvisor.app` could not be inspected from this scope, so the domain likely lives under a different Vercel scope/account than the linked project
- do not assume DNS or domain attachment can be managed from the current CLI scope until that ownership/scope mismatch is resolved
- if the goal is free branded email:
  - forwarding-only route: ImprovMX free is a strong fit for sending `support@`, `feedback@`, and `privacy@` into an existing Gmail inbox
  - real mailbox route: Zoho Mail free is the better fit if actual branded inboxes are preferred without paying
  - Google One by itself should not be treated as custom-domain business email; Google Workspace is the Google-hosted paid path if needed later

Current platform posture:
- the web app on Vercel is still live, working, and should not be treated as dead
- the web app is a bit outdated and has not been updated recently
- current product focus is iOS-first launch work
- do not remove or abandon the web project just because iOS is the current priority
- treat the repo as a shared codebase with an active web surface and an active iOS push

iOS launch direction:
- primary near-term goal is launching on iOS first
- Apple Developer Program enrollment is now complete
- the UI is being shifted toward a Liquid Glass feel
- keep that Liquid Glass direction inside Expo / React Native for now; do not assume a Swift / SwiftUI rewrite is in progress
- web can lag behind temporarily while iOS gets the main product/design attention
- unless the user explicitly asks for web work or a web deploy, default execution and verification to iPhone paths first

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
- About should now point users toward the brand domain `outdooradvisor.app` and the branded contact addresses `support@outdooradvisor.app`, `feedback@outdooradvisor.app`, and `privacy@outdooradvisor.app`

## Current Architecture

### Client
- Expo / React Native app with web export
- main screens live under `src/screens`
- hooks and data-fetch helpers under `src/hooks`, `src/utils`, and `src/config`
- Vercel web analytics is mounted from `@vercel/analytics` in `App.js`

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
- the brand domain `outdooradvisor.app` has been purchased via Vercel
- that domain is intended to strengthen brand trust and should be considered for About-page identity plus future contact / feedback / support email usage
- EAS is now initialized and linked for this repo under the Expo account `ahmadadnanone`
- production deploys have been triggered manually from this repo with `vercel deploy --prod --yes`
- do not assume Vercel is only relying on auto-deploy from GitHub; manual prod deploy has been the current workflow
- the Vercel web app is still active and should be preserved even if it is temporarily behind the latest iOS-focused work
- current strategy is iOS-first, not web-abandoned
- notifications, subscriptions, and privacy/legal hardening are not finished for full app-store readiness
- real App Store subscriptions are not implemented yet
- Apple Developer Program enrollment is complete, so app-store preparation is now a real active track
- NHMP source is not an API; it is scraped from:
  - `https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx`

## NHMP Notes

- NHMP is flaky and sometimes returns an ASP.NET timeout/error page instead of real advisory HTML
- current fix lives in `api/nhmp.js`
- the route now rejects NHMP error pages instead of treating them like valid content
- there is also a fallback snapshot in `api/_data/nhmpFallback.js`
- Travel screen should prefer server data on web so browser-side direct fetch does not dominate/fail first

## Official Travel / Weather Sources

- These PMD / NWFC links should be treated as official Pakistan government weather and travel-reference sources when working on Travel features, alerts, and route-safety ideas.
- Motorway fog update:
  - `https://weather.gov.pk/nwfc/motorway-fog-update`
  - official NWFC / PMD fog status source for motorway corridors and sector-level fog conditions
- Tourist forecast:
  - `https://nwfc.pmd.gov.pk/new/tourist.php`
  - official NWFC / PMD tourism-focused forecast source for destinations and hill-station planning
- Latest weather alerts:
  - `https://www.pmd.gov.pk/en/latest-weather-alerts.php`
  - official PMD severe-weather / CAP alert source for regional warnings and official alert language
- Daily rainfall:
  - `https://nwfc.pmd.gov.pk/new/daily-rainfall.php`
  - official NWFC / PMD recent-rainfall reporting source that can help with flood, slip, and route-after-rain context
- Radar:
  - `https://nwfc.pmd.gov.pk/new/radar.php?type=islamabad`
  - official NWFC / PMD radar source that can help with short-window rain awareness and near-real-time weather checks

## UX Direction

- cleaner, calmer layout
- fewer always-open detail blocks
- use collapsible sections when data lists get too long
- keep weather detail secondary to decision-making
- avoid redundant location labels
- premium UI should feel subtle, not noisy

## UI Overhaul Status

- Canonical UI plan lives in `UI_OVERHAUL_BLUEPRINT.md`
- Current audited status of the overhaul:
  - phases 0–5 complete
  - phase 6 partial
  - phase 7 partial
  - phase 8 complete
- Do not assume the blueprint checklist is current unless you also read its Progress Log and latest audit notes
- The design-system foundation now exists in:
  - `src/design/`
  - `src/components/glass/`
  - `src/components/cards/`
  - `src/components/layout/`
- Important current gap: `RouteOptionCard` exists, but `RoutePlannerScreen` still uses the older route-results rendering path

## Workflow Notes

- use `apply_patch` for manual file edits
- do not touch unrelated `.claude/worktrees/*` files
- especially ignore `.claude/worktrees/relaxed-solomon`
- this repo is worked on by both Claude and Codex; handoff clarity matters more than agent-specific assumptions
- prefer targeted reads over repo-wide exploration when the task is narrow
- save tokens:
  - read only the files directly relevant to the task
  - do not re-scan the whole repo unless the task truly requires it
  - summarize existing context instead of re-deriving it repeatedly
  - update this file when strategy changes so the next agent does not waste tokens rediscovering context
- deployment preference:
  - default to iOS run/build flows
  - only deploy or verify the web app when the user specifically asks for web
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
- 2026-04-22 — Deployed new liquid glass icon to Vercel production. `LaunchAnimation.js` now uses `icon.png` (was `android-icon-foreground.png`) so the launch animation shows the new icon. Native iOS splash will update on next `expo prebuild` + build.
- 2026-04-22 — Created a new liquid glass app icon matching the app's Tide Guide-inspired palette. Source SVG lives at `assets/icon-source.svg` — edit this file and re-run the generation script (needs `NODE_PATH` pointing to global sharp) to regenerate `assets/icon.png`, `favicon.png`, `android-icon-foreground.png`, and `splash-icon.png`. Icon features: dark navy gradient background (#151F30 → #2E4260), atmospheric cyan/teal blobs, glass mountain with lit right face (#C8E6FF → #9BC8FF), shadow left face, bright ridge specular line, peak glow, horizon shimmer with inverted reflection, and liquid glass top sheen + squircle border.
- 2026-04-22 — Reworked the startup animation to use the real app icon artwork as part of the launch composition. `src/components/launch/LaunchAnimation.js` now places a large low-opacity version of `assets/icon.png` in the background and morphs into a centered glassy icon plate with a slower wordmark reveal, keeping the motion aligned with the app’s wallpaper palette and a smoother liquid-glass feel. Verified with `npx expo export -p web`.
- 2026-04-22 — Retuned the startup animation for smoother motion and less borrowed visual styling. `src/components/launch/LaunchAnimation.js` now uses a slower, softer sequence with simpler geometry, cleaner easing, and a less abrupt wordmark reveal so the intro feels calmer and more native to OutdoorAdvisor rather than like a direct design echo. Verified with `npx expo export -p web`.
- 2026-04-22 — Added an iPhone-first animated startup handoff after the native splash. `App.js` now uses `expo-splash-screen` to keep the native splash visible briefly and then overlays `src/components/launch/LaunchAnimation.js`, which plays a short centered logo/wordmark reveal over the app’s main wallpaper gradient before fading into the main UI. Verified with `npx expo export -p web` and `npx expo run:ios`.
- 2026-04-22 — Confirmed the refreshed brand logo asset is now the current cross-platform icon set. `app.json` already points iOS and the general Expo app icon to `assets/icon.png`, Android adaptive icon foreground to `assets/android-icon-foreground.png`, and web favicon to `assets/favicon.png`, so future agents should treat those files as the current active logo assets unless explicitly replaced again.
- 2026-04-22 — Documented the current domain-ops blocker and free email recommendation path. The repo CLI is linked to the Vercel team `ahmadadnanone-6336s-projects`, but that scope currently shows no domains and cannot inspect `outdooradvisor.app`, so future agents should assume the purchased domain may live under another Vercel scope/account. Also noted the preferred low-cost email paths: ImprovMX free for forwarding into Gmail, or Zoho Mail free for actual branded inboxes.
- 2026-04-22 — Locked in the branded contact email set for future work: `support@outdooradvisor.app`, `feedback@outdooradvisor.app`, and `privacy@outdooradvisor.app`. The About/legal copy in `src/components/settings/AboutTab.js` now uses `privacy@outdooradvisor.app` for privacy-policy contact while keeping support and feedback on their own dedicated addresses.
- 2026-04-22 — Updated the in-app About section to reflect the new public brand identity. `src/components/settings/AboutTab.js` now uses `outdooradvisor.app` as the website, switches support/legal contact copy to `support@outdooradvisor.app`, and switches feedback/bug contact to `feedback@outdooradvisor.app`.
- 2026-04-22 — Recorded the new brand-domain decision in this file. `outdooradvisor.app` has been purchased through Vercel and should be treated as the intended public brand domain for About, contact, support, and feedback usage, while avoiding any assumption that DNS / live attachment is already fully verified.
- 2026-04-22 — Enabled Vercel Analytics for the web app. Installed `@vercel/analytics`, mounted the analytics component in `App.js` on web only, and prepared the Vercel site to start reporting page visits in the Analytics dashboard after fresh traffic hits production.
- 2026-04-22 — Added official PMD / NWFC source links to this file so future agents have the core government weather/travel reference pages handy. Included motorway fog, tourist forecast, latest weather alerts, daily rainfall, and radar links, and marked them as official sources for Travel-related work.
- 2026-04-22 — Rebalanced activity ranking so indoor-friendly options, especially `gym`, hold up better when outdoor AQI, heat, rain, or storms are poor. `src/utils/activityScoring.js` now gives sheltered indoor activities a lower penalty profile and preserves stronger scores under bad outdoor conditions. `src/screens/ActivitiesScreen.js` now also advises users to prefer gyms, studios, courts, and halls with air purifiers or strong filtration when indoor activity is the smarter choice.
- 2026-04-20 — Tightened the iPhone web-shell full-height fix in `App.js`. The web document, body, and `#root` now explicitly use `100dvh` and `-webkit-fill-available` sizing so mobile Safari/Chrome are less likely to leave unused space and the app feels more truly full-screen.
- 2026-04-20 — Improved the mobile web shell to feel full-screen on iPhone. `App.js` now applies a web-only document fix that adds `viewport-fit=cover`, sets the browser `theme-color` to the app’s dark top tone, and forces the HTML/body background to match the app so the white strip near the notch/camera area is removed.
- 2026-04-20 — Adjusted the Home live-conditions night icon logic so clear sky at night now shows only the moon. The moon-plus-cloud composite is now reserved for partly cloudy night codes only (`1–3`) instead of also affecting clear sky (`0`).
- 2026-04-20 — Removed the small Home header refresh pill from the web/Vercel UI so the header now shows only the location pill beneath the greeting. Native refresh behavior and other refresh paths remain unchanged.
- 2026-04-20 — Fixed Vercel deployment configuration for the web app. Added `vercel.json` so Vercel builds the Expo web bundle with `npx expo export -p web` and serves the generated `dist/` output instead of exposing the repo root files like `index.js` as plain text in the browser.
- 2026-04-20 — iPhone build workflow was pushed further toward release readiness. `npx expo run:ios` completed successfully and launched the app on the booted iPhone simulator. `npx eas-cli@latest init --non-interactive --force` linked the repo to Expo/EAS, creating `eas.json` and writing the EAS project ID into `app.json`. A follow-up `npx eas-cli@latest build --platform ios` reached Apple credential setup, but the cloud build could not be completed without logging into the Apple Developer account interactively on this machine.
- 2026-04-20 — Clarified default platform priority for future agents: iPhone is now the default run/build/deploy path, and the web app should only be deployed or verified when the user asks for web specifically.
- 2026-04-20 — Refined smart notification tone to feel more like a gentle outdoor coach instead of a technical alert system. `src/services/smartAdvisor.js` now uses warmer, shorter motivational copy for good-weather walk nudges and can also suggest alternatives when walking conditions are poor, including a heat-driven “too hot for a walk right now” message that can suggest swimming or waiting for a cooler window. `src/screens/AlertsScreen.js` notification labels were updated from AQI/walk-only wording toward broader outdoor-summary and movement-coaching language.
- 2026-04-20 — Updated agent handoff guidance to reflect current strategy: the Vercel web app is still live and should be preserved, but the main focus is now iOS-first launch work. Added explicit notes that Apple Developer Program enrollment is complete, Liquid Glass UI work is happening inside Expo / React Native rather than a Swift rewrite, and both Claude and Codex should save tokens by reading only the files relevant to each task.
- 2026-04-20 — Added an iPhone-first smart notification layer tied to Health + weather + AQI. New files: `src/hooks/useHealthData.js`, `src/services/notificationService.js`, `src/services/smartAdvisor.js`, `src/services/backgroundTask.js`, `src/utils/locationSnapshot.js`, and `src/components/home/HealthStatsSection.js`. `App.js` now initializes notification permission, HealthKit authorization, best-effort background registration, and a foreground smart-advisor check. `useLocation.js` now persists the last known location to AsyncStorage so background checks can still resolve the user’s city. `AlertsScreen.js` has a new `smartWalkNudges` toggle, and the old `dailySummary` preference now has a real delivery path through `smartAdvisor`. Native config updated in `app.json` with `expo-background-task` and `@kingstinct/react-native-healthkit` plugins. Verified with `npx expo export -p web`, `npx expo prebuild --platform ios --no-install`, `pod install`, and `npx expo run:ios`.
- 2026-04-19 — Removed the extra Home header settings button, made the global FAB overlay visually transparent so the app no longer darkens on open, and retuned the fan-out to overshoot slightly before settling on device.
- 2026-04-19 — Adjusted `FABMenu` on iPhone to animate along a wider quarter-arc with more spacing between satellites and a slower stagger so the plus menu feels smoother on real devices.
- 2026-04-18 — Removed the circular ring/orb wallpaper treatment from `ScreenGradient` and made `GlassTabBar` denser/less transparent for a cleaner iPhone-first look.

### 2026-04-18 — Tide Guide-inspired atmosphere + tap feedback polish
- Lightened the design gradient in `src/design/colors.js` from the earlier heavier navy into a softer slate/blue Tide Guide-inspired backdrop
- `src/components/layout/ScreenGradient.js` now defaults to showing background graphics with dark circular rings/orbs and softer atmospheric blobs
- Strengthened outlined glass styling and pressed/highlight feedback in `src/components/glass/GlassCard.js`, `src/components/glass/GlassButton.js`, `src/components/glass/GlassPill.js`, and `src/components/glass/GlassTabBar.js`
- Haptic defaults are now more consistently applied across shared glass controls so taps feel more intentional on iPhone
- Verified with `npx expo export -p web`, deployed to production on Vercel, and rebuilt/launched the iOS simulator app

### 2026-04-18 — Blueprint and agent docs synced to actual overhaul state
- Audited the repo against `UI_OVERHAUL_BLUEPRINT.md` after Claude handoff review
- Confirmed phases 0–5 are implemented in code, phase 6 is partial, phase 7 is partial, and phase 8 is implemented
- Updated `UI_OVERHAUL_BLUEPRINT.md` phase checklist and progress log to match reality instead of the older planned state
- Added a dedicated `UI Overhaul Status` section here so future agents do not confuse the design-system branch progress with the older app notes

### 2026-04-17 — Motorbike alternates (N-5), scooter toggle, signed-in card fix
- `src/data/cities.js`: added **N-5 GT Road** (`id: 'N5'`, `kind: 'highway'`) — Peshawar → Nowshera → Attock → Rawalpindi → Islamabad → Jhelum → Kharian → Gujrat → Gujranwala → Lahore. Gives motorbike/scooter users a legal corridor across the M-1/M-2 axis. Adds Rawalpindi, Jhelum, Gujrat as new planner cities via the auto-merge in `getPlannerCityOptions`
- `src/components/VehicleToggle.js`: scooter 🛵 option now available via optional `showScooter` prop (hidden by default to keep the main toggle tidy). `VEHICLES_BANNED_FROM_MOTORWAY` now includes `scooter` so motorway bans apply to both two-wheelers
- `src/context/SettingsContext.js`: new `showScooterVehicle: false` default, persists via same AsyncStorage key
- `src/screens/AlertsScreen.js`: (1) fixed the **enlarged Signed-in card** — the `accountCopy` flex:1 inside the column-flex card was stretching the entire card; wrapped the signed-in branch in a new `accountSignedInRow` (flexDirection: row), so copy and Sign-out button sit on one line. (2) Added a "Route Planner Vehicles" section to the Customize tab with a Scooter on/off toggle. New `rowToggle` / `rowToggleSwitch` / `rowToggleThumb` styles — animation is a simple translateX, not a spring
- `src/screens/RoutePlannerScreen.js`: reads `showScooterVehicle` from settings and passes through to `VehicleToggle`. Rephrased the **"Best route right now"** card when `bestPlan.motorwayBlocked` — eyebrow becomes "No legal match on the mapped network" and body suggests "Consider GT Road (N-5) or local city streets instead". Non-blocked case unchanged
- With N-5 added, Lahore → Islamabad on Motorbike now ranks **N-5 as the best route** (kind: highway, no motorway penalty) with M-2 appearing below at red "Not allowed" — instead of only red cards
- Verified with `npx expo export -p web` — bundles cleanly
- **Deferred to next turn**: EV charging / POI overlays (need a `/api/poi/chargers` endpoint; filter brand=="BMW destination" server-side)

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
