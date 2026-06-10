# OutdoorAdvisor Notification Architecture

Last updated: 2026-06-10

## Goal

OutdoorAdvisor must deliver high-value outdoor, weather, AQI, and travel alerts even when the iOS app is closed. Local notifications and iOS background tasks are useful backups, but they are not reliable enough to be the primary delivery path for timely alerts.

## Decision-First Design (2026-06 overhaul)

Every server push is built for decision-making, not just information:

- Each notification carries a **decision verdict** — `avoid`, `caution`, `go`, or `plan` — both as a body prefix ("Avoid outdoors — …", "Plan ahead — …") and in `data.decision` for client logic.
- Each notification carries a **severity tier** — `critical`, `important`, `helpful` — in `data.severity`. Criticals send as iOS **time-sensitive** interruptions; everything else is `active`.
- Non-critical pushes use the actionable category `oa-alert`, giving a long-press **"Mute alerts today"** button. The mute is stored on-device, synced to the server (`muteUntil` on the device record), and the engine skips non-critical sends until it expires. Criticals always break through.
- **Quiet hours (22:00–06:00 device-local)** suppress all non-critical pushes; criticals bypass.
- The dispatcher sends at most **one non-critical alert per cron run** per device (briefs exempt) so users never get stacked pushes from a single check.

## Current Notification Types

- Pakistan Morning Outdoor Brief (helpful, 06:00–10:00): saved-pin weather/AQI, a sampled national outlook, and the highest-priority PMD/NDMA warnings, ending in a verdict for the day.
- Evening Planner (helpful, 19:00–22:00): tomorrow's outlook (max temp, rain probability, UV, lingering AQI) with a plan-ahead verdict for the next day.
- Good Outdoor Window (helpful): after a rough stretch earlier the same day, a "conditions cleared — go now" push when AQI, temperature, rain, and wind all recover during daytime.
- Smart Movement Nudges (on-device only): Apple Health steps plus AQI/weather to suggest a walk or safer indoor alternative.
- PMD Severe/Extreme Alerts (critical): official CAP/RSS weather warnings.
- NDMA National Advisories (critical): official hazard advisories for GLOF, flash flood, heatwave, storm, and related disaster-risk alerts.
- Severe AQI Warnings (critical at hazardous, important otherwise): threshold-based air-quality alerts.
- Rain Alerts (heavy = critical, light = important) and Rain-Soon heads-up (helpful).
- Thunderstorm Alerts (critical): lightning/severe storm risk; supersedes rain pushes.
- Wind Alerts (severe = critical, threshold = important).
- Extreme Heat Alerts (critical well past threshold, else important) — now server-implemented.
- Cold Snap Alerts (important) — new, uses the existing `coldAlert` threshold.
- Local Fog Alerts (important) — new, visibility hazard at the user's pin.
- Major Route Closures / Motorway Route Alerts (closure = critical; fog/rain/reopen = important/go) — premium, per-route subscription.
- Smog Season & High Pollen Alerts: still pending dedicated server rules (covered today via PMD/NDMA matching in the morning brief).
- Notification Inbox: in-app history of local alerts and remote Expo pushes received/tapped on this device.

## Delivery Model

### Primary: Server-sent Native Push

The production path is:

1. iPhone grants notification permission.
2. App obtains an Expo push token with `Notifications.getExpoPushTokenAsync`.
3. App registers that token at `/api/push?action=register`.
4. Vercel stores token, device metadata, location snapshot, timezone, and alert preferences in KV.
5. GitHub Actions triggers `/api/push?action=cron` every 15 minutes using the `OA_CRON_SECRET` repo secret.
6. Server sends pushes through Expo Push Service.
7. Server stores Expo receipt IDs and later checks receipts to clean up delivery failures.
8. Build 20 client code saves received/tapped remote pushes into the local in-app Notification Center.

This is the only path that can reliably notify users when the app is closed.

Important iOS caveat: server pushes can be delivered while the app is closed because APNs/Expo handle delivery. App code cannot run arbitrary WeatherKit or Apple Health checks while fully closed; health-aware nudges remain best-effort app-open/background behavior unless the product later chooses to sync a privacy-reviewed health summary to the server.

### Secondary: Local Notifications

Local notifications remain for:

- app-open smart advisor checks,
- Apple Health smart-walk nudges,
- keeping the in-app inbox useful.

Weather, AQI, PMD, NDMA, rain, wind, and route alerts are server-owned so opening the app does not create a duplicate local warning after a remote push.

### Tertiary: Background Task

The existing Expo background task remains registered, but it must not be treated as the success-critical alert engine. iOS decides when background work runs and may delay or skip it.

## Priority Rules

### Critical, send immediately

- PMD Extreme/Severe weather alert.
- Flash flood, cyclone, heavy rain, thunderstorm, lightning, hail, or heatwave warning.
- Motorway closure or dangerous fog on a followed route.
- Hazardous AQI.
- Extreme heat above user threshold.

Critical alerts should bypass normal daily caps, but still dedupe by source alert key.

### Important, rate-limited

- AQI crosses unhealthy threshold.
- Smog season risk.
- Rain expected around a commute/travel window.
- High pollen.
- Strong wind.

Default cap: 2 non-critical alerts per device per day.

### Helpful, low frequency

- Morning advisory.
- Good outdoor window.
- Smart walk nudge.

Default behavior: once per day unless user explicitly asks for more.

## Implemented Backbone

- `src/services/pushRegistration.js`
  - registers Expo native push tokens,
  - sends token, preferences, location, platform, timezone, device id, and premium entitlement to Vercel,
  - syncs registration at startup/foreground.

- `api/push.js`
  - single Hobby-plan-friendly push API with `action=register`, `action=unregister`, `action=test`, and `action=cron`.

- `.github/workflows/push-cron.yml`
  - active GitHub Actions scheduler path. It runs every 15 minutes and calls the authenticated production cron route.

- `api/_lib/nativePush.js`
  - Expo Push API sender with iOS `interruptionLevel` (time-sensitive for criticals) and `categoryId` (actionable "Mute alerts today"),
  - token storage helpers including the per-device `muteUntil` field,
  - receipt-id storage keyed to tokens; `DeviceNotRegistered` receipts automatically remove the dead device record.

- `api/_lib/alertEngine.js` — rewritten 2026-06-10 as a snapshot → rules → dispatcher pipeline:
  - shared feeds fetched once per run (PMD CAP every run; NDMA hourly; NHMP every ~30 min and only when someone is subscribed; national overview only when a morning brief is due),
  - ONE weather snapshot + ONE AQI snapshot per device per run, shared across devices pinned to the same rounded coordinates (previously each alert type re-fetched weather per device — up to 5x duplicate fetches),
  - 14 rules emit candidates tagged with severity + decision: PMD, NDMA, motorway, thunderstorm, heavy/light rain, extreme heat, cold snap, wind, fog, rain-soon, severe AQI, good-window, morning brief, evening planner,
  - dispatcher applies quiet hours (22:00–06:00 local), server-side mute-today, unified per-type cooldowns, the 2-per-day non-critical cap, max 3 criticals + 1 non-critical per run, then sends,
  - legacy dedupe state (PMD/NDMA/brief send records) is migrated on first run so a deploy never re-sends alerts users already received,
  - state is pruned every run (cooldowns >14 days, stale day counters) so KV records stay bounded,
  - `getAlertEngineStatus()` powers the `/api/push?action=status` delivery dashboard (devices, last run, feed check times, last 25 sends).

- `src/context/LocationContext.js`
  - refreshes the native push registration after device-location refreshes and manual pin changes so the server uses the latest exact lat/lon for closed-app pushes.

- `src/services/nativeNotificationInbox.js`
  - listens for native Expo pushes received while the app is foregrounded,
  - captures the last tapped notification when the app opens from a push,
  - stores remote push entries in `src/utils/notificationInbox.js` so the in-app Notification Center reflects what the user tapped.

- `vercel.json`
  - keeps Vercel serving the web app and API routes. Vercel Hobby does not support sub-daily cron, so the timely scheduler must live outside Vercel unless the project upgrades to Vercel Pro.

## Required Vercel Environment Variables

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `CRON_SECRET`
- optional: `PUSH_TEST_SECRET`
- GitHub secret `OA_CRON_SECRET` should match Vercel `CRON_SECRET`

`CRON_SECRET` should be a random string of at least 16 characters. Whatever external scheduler is used should send it as a bearer token to `/api/push?action=cron`.

## Immediate Test Flow

1. Install a fresh TestFlight build on a real iPhone.
2. Allow notifications when prompted.
3. Open Settings -> Notifications and toggle one alert on.
4. Confirm `/api/push?action=register` receives the token in production logs.
5. Send a protected test push through `/api/push?action=test`.
6. Lock the phone and confirm the notification arrives while the app is closed.
7. Confirm the GitHub Actions scheduler runs `/api/push?action=cron` and does not require the app to open.
8. Tap a remote push and confirm it appears in the Home Notification Center after the app opens.

Do not manually trigger the production cron merely to test summary copy: it can send real alerts. Verify copy builders locally, then observe the scheduled morning delivery.

## Next Hardening Steps

1. Improve NDMA attachment parsing so PDF/DOCX advisory bodies can enrich district targeting beyond title-based/default hazard regions.
2. Add dedicated pollen and smog-season rules to the server engine (heat, cold, and local fog landed 2026-06-10; official PMD/NDMA smog/pollen warnings already surface via matching).
3. ~~Delivery dashboard~~ — done: `/api/push?action=status` (test-secret protected).
4. Add server-side notification inbox events for cross-device history.
5. ~~Receipt-based automatic token cleanup~~ — done: `DeviceNotRegistered` receipts now remove the device record.
6. Decide whether critical travel alerts should be free while premium keeps advanced/custom alerts.
7. Consider the iOS Time Sensitive Notifications capability (`com.apple.developer.usernotifications.time-sensitive`) on the next native build so the `time-sensitive` interruption level actually breaks through Focus; without it APNs downgrades it to `active` (current pushes still deliver normally).
