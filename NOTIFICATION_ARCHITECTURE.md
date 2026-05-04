# OutdoorAdvisor Notification Architecture

Last updated: 2026-05-01

## Goal

OutdoorAdvisor must deliver high-value outdoor, weather, AQI, and travel alerts even when the iOS app is closed. Local notifications and iOS background tasks are useful backups, but they are not reliable enough to be the primary delivery path for timely alerts.

## Current Notification Types

- Local Outdoor Summaries: three daily advisory pushes (morning, afternoon, evening) based on the user's saved pin, AQI, WeatherKit-first weather, rain risk, heat, and wind.
- Smart Movement Nudges: Apple Health steps plus AQI/weather to suggest a walk or safer indoor alternative.
- PMD Severe/Extreme Alerts: official CAP/RSS weather warnings.
- Severe AQI Warnings: unhealthy air-quality threshold alerts.
- Smog Season Alerts: seasonal/high-risk smog conditions.
- Rain Alerts: active rain or near-term rain risk affecting plans and driving.
- Thunderstorm Alerts: lightning/severe storm risk.
- Wind Alerts: gusty conditions affecting activity or travel.
- High Pollen Alerts: allergy-heavy days.
- Extreme Heat Alerts: unsafe feels-like heat.
- Motorway Fog Warnings: corridor visibility risk.
- Major Route Closures: NHMP/motorway closures and serious route advisories.
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

- immediate in-app alerts,
- app-open smart advisor checks,
- Apple Health smart-walk nudges,
- fallback behavior if server push is unavailable,
- keeping the in-app inbox useful.

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
  - sends token, preferences, location, platform, timezone, and device id to Vercel,
  - syncs registration at startup/foreground.

- `api/push.js`
  - single Hobby-plan-friendly push API with `action=register`, `action=unregister`, `action=test`, and `action=cron`.

- `.github/workflows/push-cron.yml`
  - active GitHub Actions scheduler path. It runs every 15 minutes and calls the authenticated production cron route.

- `api/_lib/nativePush.js`
  - Expo Push API sender,
  - token storage helpers,
  - receipt-id storage and receipt checking.

- `api/_lib/alertEngine.js`
  - initial PMD critical alert sender,
  - severe AQI threshold sender,
  - WeatherKit-first wind, thunderstorm, and rain checks with Open-Meteo fallback,
  - WeatherKit/Open-Meteo near-term rain-risk checks,
  - morning, afternoon, and evening local outdoor summary sender,
  - dedupe and daily non-critical cap state.

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

Latest production check on 2026-05-01: authenticated `/api/push?action=cron&mode=codex-three-summary-check` returned `success: true`, `devices: 10`, `sent: 9`, with result `{ type: "outdoor-summary", sent: 9 }`.

## Next Hardening Steps

1. Add heat, pollen, smog season, and motorway-fog checks to the server alert engine.
2. Add a delivery dashboard: active tokens, sends, failures, last cron run, last summary window sent, last PMD alert key.
3. Add server-side notification inbox events for cross-device history.
4. Add receipt-based automatic token cleanup for permanent Expo/APNs failures.
5. Decide whether critical travel alerts should be free while premium keeps advanced/custom alerts.
