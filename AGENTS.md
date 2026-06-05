# OutdoorAdvisor Agent Notes

This file is the quick-start context for any agent working in this repo.
Update it whenever the product, workflow, or important assumptions change.

---

## 🔒 UI LOCK — DO NOT CHANGE WITHOUT EXPLICIT USER INSTRUCTION

The following UI elements are **approved and final** as of build 41 (2026-05-15). The user has confirmed the app looks correct. Do NOT touch these values for any reason — not for "cleanup", not for "consistency", not as part of another fix.

### Floating Tab Bar (LOCKED)
- **File:** `src/components/glass/GlassTabBar.js`
- `PILL_RADIUS = 30` — applied to all 4 corners via `floating` style
- `floating` style uses `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomLeftRadius`, `borderBottomRightRadius` all set to `PILL_RADIUS`
- Do NOT use `borderRadius` shorthand — it gets overridden by React Native style merging
- Do NOT add `borderTopLeftRadius`/`borderTopRightRadius` directly to `wrap` — it breaks the pill shape

### Tab Bar Shell / Scene Overlay (LOCKED)
- **File:** `App.js` — `GlassNavBar` component + `styles`
- `tabBarOuter`: `{ height: 0, overflow: 'visible' }` — zero height so React Navigation allocates no space in the tab slot; scenes extend full screen height
- `tabBarShell`: `{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' }` — overlays the scene
- Inner padding: `paddingBottom: insets.bottom + 18, paddingHorizontal: 32` — lifts pill above home indicator, insets from edges
- Do NOT add bottom padding to the tab navigator's `sceneStyle` — it creates the blue strip
- Do NOT change `height: 0` on `tabBarOuter` — it will push scenes up and create dead space

### Background Gradient (LOCKED)
- **File:** `App.js` — `App()` component root
- `LinearGradient` with `gradient.screen` colors fills `StyleSheet.absoluteFill` behind the entire app
- `StatusBar style="light" translucent backgroundColor="transparent"` — status bar blends into gradient
- Do NOT add `backgroundColor` to any screen root or navigator — it will create banding

### Glass Design System (LOCKED)
- **Files:** `src/design/` — colors, gradients, shadows, radius tokens
- `dc.bgTop / dc.bgMid / dc.bgBottom` gradient stops — do not alter
- `dc.accentCyan = #9BC8FF` — primary active/highlight colour
- `dc.cardGlass = rgba(255,255,255,0.11)` — standard glass surface
- `dc.cardStroke = rgba(255,255,255,0.24)` — card border
- `GlassCard`, `GlassPill`, `GlassButton`, `GlassTabBar` — do not restyle these primitives

### SynthesisCard Severity Logic (LOCKED)
- **File:** `src/components/home/SynthesisCard.js`
- Severity clamping: headline/summary/actions/window are ALL replaced when `clamped === true` — do not let Gemini copy bleed through when device severity is higher than synthesis severity
- `isStaleWindow()` suppresses window pills for past time-of-day — do not remove
- `clampedCopy` provides severity-matched fallback copy for both `danger` and `caution` — keep both branches

---

## Project

OutdoorAdvisor is a Pakistan-focused outdoor decision app built with Expo / React Native and deployed on Vercel.

Production site:
- `https://outdooradvisor.vercel.app`

Brand domain:
- `outdooradvisor.app` has been purchased through Vercel on April 22, 2026
- treat it as the intended public-facing brand domain for About, contact, support, and feedback surfaces
- `outdooradvisor.app` is now live and hosted on Vercel as the web app domain
- treat `https://outdooradvisor.app` as the current primary branded web surface alongside the older Vercel alias
- branded contact addresses to use by default:
  - `support@outdooradvisor.app`
  - `feedback@outdooradvisor.app`
  - `privacy@outdooradvisor.app`

Domain / email ops notes:
- current CLI project scope is `ahmadadnanone-6336s-projects`, but `vercel domains ls` there returns zero domains
- `outdooradvisor.app` is confirmed live on Vercel, but the current CLI scope still may not be the domain-owning scope
- do not assume DNS or domain attachment can be managed from the current CLI scope until that ownership/scope mismatch is resolved
- **Email setup (confirmed working 2026-06-05 via live reset-email test → `Delivered`):**
  - **Inbound forwarding:** ImprovMX free — `support@`, `feedback@`, `privacy@outdooradvisor.app` all forward into `ahmadadnanone@gmail.com`. Confirmed working (ImprovMX alias test email received April 22, 2026).
  - **Outbound SMTP (Supabase auth):** Resend — domain `outdooradvisor.app` verified, region us-east-1. Supabase project `qhygkrwekdacvpaqhkcf` SMTP: host `smtp.resend.com`, port `465`, username `resend`, sender `support@outdooradvisor.app` / "OutdoorAdvisor".
  - **Auth emails are 6-digit codes (not magic links).** Confirm-signup + Reset-password templates send `{{ .Token }}`. **Email OTP Length = 6** (Auth → Providers → Email; was 8, which broke the app's 6-digit code box). The app verifies via `supabase.auth.verifyOtp` (types `signup` / `recovery`).
  - **Apple provider:** enabled in Supabase (Client IDs = bundle ID `com.ahmadadnanone.OutdoorAdvisor`, native flow, no secret).
  - Resend API key name: "Supabase OutdoorAdvisor". ⚠️ **The literal key was committed in plaintext in this file's git history — rotate it in Resend and update the Supabase SMTP password.**

Current platform posture:
- the web app on Vercel is still live, working, and should not be treated as dead
- the web app is a bit outdated and has not been updated recently
- current product focus is iOS-first launch work
- do not remove or abandon the web project just because iOS is the current priority
- treat the repo as a shared codebase with an active web surface and an active iOS push

**iOS App Store status — 🟢 LIVE (verified 2026-06-03):**
- App name (App Store display): **OutdoorAdvisor: AQI & Smog** — keyword-led ASO name shipped in 1.0.4 (the underlying app record / brand is still "OutdoorAdvisor Pakistan"). App Store Connect app ID `6763982833`.
- **The app is LIVE on the public App Store.** Version **1.0.4 / build `46`** — App Store Connect status **Ready for Distribution** (released 2026-06-03). Previous live: 1.0.3 / build 44.
- Public listing: `https://apps.apple.com/us/app/id6763982833` — Free · In-App Purchases · Age 4+ · Category Weather · iPhone/iPad · Developer "Ahmed Adnan"
- Apple Team: `X6TA54T858`, EAS project: `0b8b92b0-0722-4ab1-b4c4-34df3ba8e956`
- The app went through earlier review rounds (build 31 → rejected/resubmitted → build 41 → build 44) before being approved and released. Submission ID history: `785fa048-fdd4-4d36-8d9b-5e90f012bdf4`.
- **Now that 1.0 is live, master is the public production line.** Any change merged to master that triggers an OTA `eas update --branch production` ships to real users immediately. Treat master as production: only merge ship-ready work, and use a new build number for native changes.
- **In TestFlight (not yet released to App Store): build `53` (v1.0.5)** — rebuilt auth (6-digit email codes + password reset/resend), sudden wind-storm/thunderstorm alerts, and **Sign in with Apple** (native). Provisioning profile `U2TTKC66T4`. The auth + wind fixes also shipped to live 1.0.4 users via production OTA on 2026-06-05; Apple sign-in needs this binary, so it'll go live with the next App Store submission of 1.0.5.

iOS launch direction:
- primary near-term goal is launching on iOS first — **build 31 now in Apple review**
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
- NHMP, PMD, and NDMA advisories are scraped/proxied through server routes
- Native iOS push registration and delivery now use the single Hobby-plan-friendly `/api/push` route with `action=register`, `action=unregister`, `action=test`, and `action=cron`

### Notifications
- Full notification plan and implementation notes live in `NOTIFICATION_ARCHITECTURE.md`
- Native iOS push is the primary timely-alert path: the app registers Expo push tokens through `src/services/pushRegistration.js`, and Vercel sends through Expo Push Service from server routes
- Local notifications and the existing Expo background task remain as fallback/app-open helpers; do not treat iOS background tasks as reliable for success-critical timely alerts
- The authenticated cron endpoint `/api/push?action=cron` is live in production. `.github/workflows/push-cron.yml` currently calls it every 15 minutes using `OA_CRON_SECRET`.
- Push token, preference, location, and receipt state use the existing Vercel KV helpers under `api/_lib/kv.js`
- Required production env vars for the push backend: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET`; optional `PUSH_TEST_SECRET` can protect manual test sends separately. If GitHub Actions scheduling is restored later, `OA_CRON_SECRET` should match `CRON_SECRET`
- Server alert engine now covers: PMD severe/extreme CAP alerts, NDMA national advisory checks, severe AQI threshold alerts, wind alerts, thunderstorm alerts, rain alerts (heavy and light), motorway closure alerts, and outdoor summaries. Weather condition checks use WeatherKit as primary source (via `/api/weatherkit` Vercel proxy) with Open-Meteo as fallback. Remaining hardening follow-ups: NDMA attachment parsing, motorway fog, extreme heat, smog season, pollen, route-specific alerts, and delivery dashboard

### AI
- Home and Travel use `src/hooks/useAiBriefing.js`
- AI route supports Gemini
- Home synthesis now pulls recent NDMA advisories into the official-alert context when they match the user's area or a national/broad hazard layer
- server-side env var for Gemini must be `GEMINI_API_KEY`
- do not reuse the public Maps / Weather browser key for Gemini

### Auth
- Supabase auth is wired in
- auth is intended to stay optional for now
- current env vars:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Premium & StoreKit Subscriptions
- premium gating logic lives in `src/lib/premium.js`, with StoreKit state coming from `src/hooks/useStoreKitSubscriptions.js`
- StoreKit product IDs live in `src/config/subscriptions.js`:
  - monthly: `com.ahmadadnanone.outdooradvisor.premium.monthly`
  - yearly: `com.ahmadadnanone.outdooradvisor.premium.yearly`
- Public premium access should come from an active Apple auto-renewable subscription. Internal allowlist/Supabase metadata can still grant admin/test premium.
- The old device-started 7-day trial no longer grants production premium. Public trials are Apple-managed introductory offers: monthly should have a 15-day free trial; yearly should have a 1-month free intro offer.
- Users who do not subscribe stay on the free tier. Core weather, AQI, activities, and travel advisories remain free; AI/detail/weather-depth/route-planner style features are premium-gated.
- `AuthContext` now composes premium from StoreKit subscription state plus internal entitlement; it no longer composes `isPremium` from local `trial.inTrial`.
- `HomeScreen` shows a StoreKit subscribe card for free users with monthly/yearly buttons and restore purchases.
- All Gemini/AI features are premium-only as of 2026-05-27. Free users may still see local rule-based guidance, but the app should not call Gemini or label non-premium content as AI. `/api/ai/briefing` also checks premium before Gemini for `home`, `travel`, and `synthesize`.
- `EXPO_PUBLIC_TESTFLIGHT_PREMIUM` was removed from EAS profiles on 2026-05-26 so TestFlight/App Review builds exercise the real StoreKit/free-tier path.
- entitlement premium: user email in `SEEDED_PREMIUM_EMAILS` or `EXPO_PUBLIC_PREMIUM_EMAILS`, or Supabase user metadata has `plan/tier/subscription_status = premium/active`
- route planner is premium and experimental
- Adding `expo-iap` requires a full native EAS build. OTA is not enough for the subscription implementation.

## Important Current Truths

- GitHub remote is configured and working from this machine
- Vercel project is configured and linked from this machine
- the brand domain `outdooradvisor.app` has been purchased via Vercel
- `outdooradvisor.app` is live and serving the web app on Vercel
- that domain is intended to strengthen brand trust and should be considered the main About-page identity plus contact / feedback / support website surface
- EAS is now initialized and linked for this repo under the Expo account `ahmadadnanone`
- production deploys have been triggered manually from this repo with `vercel deploy --prod --yes`
- do not assume Vercel is only relying on auto-deploy from GitHub; manual prod deploy has been the current workflow
- the Vercel web app is still active and should be preserved even if it is temporarily behind the latest iOS-focused work
- current strategy is iOS-first, not web-abandoned
- notifications and privacy/legal hardening still need ongoing review for full app-store readiness
- StoreKit subscription client wiring is now implemented with `expo-iap`, but App Store Connect products/prices/offers and a new native build are still required before release
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

## Shipping Changes — OTA vs Full Build

**EAS Production plan is active** (purchased 2026-05-14). This unlocks EAS Update for over-the-air JS patches.

### When to use OTA (EAS Update) — fast path, no App Store review
Use `eas update --branch production --message "description"` for any change that is **JavaScript only**:
- UI tweaks, copy changes, color/style fixes
- Logic fixes in `.js` files (hooks, utils, services, components, screens)
- Vercel API route changes (those deploy via `vercel deploy --prod --yes` anyway)
- Examples of queued changes that qualify: tab bar scene overlay fix (`App.js`), SynthesisCard contradiction fix, stale "Morning" window pill suppression

OTA updates land on users' devices within minutes, without going through App Store review or the EAS build queue.

### When a full EAS build is required
A new `eas build --platform ios --profile production` is **required** when:
- Adding or changing native modules (anything in `package.json` with native code)
- Changing `app.json` / `app.config.js` (plugins, permissions, bundle ID, version)
- Changing `ios/` native files (entitlements, Info.plist, `AppDelegate`)
- Bumping the Expo SDK version
- Changing `eas.json` build profiles

### OTA quick-ship workflow
```bash
# 1. Make JS changes, push to GitHub
git add <files> && git commit -m "fix: description" && git push

# 2. Ship OTA update to production channel
eas update --branch production --message "fix: description"

# Users on the live app get the update on next launch (usually within minutes)
```

---

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

## Cross-Agent Coordination Snapshot

- Claude and Codex both work in this repo. Treat the worktree as shared active work; inspect the latest diff before editing broad files (`App.js`, `app.json`, `TravelScreen.js`, `activities.js`, `activityScoring.js`, `SettingsContext.js`) and coordinate intent in the handoff notes.
- `AGENTS.md` is the coordination source of truth. `CLAUDE.md` / `CLAUDE_CHEAT_SHEET.md` are orientation notes, stale in places (e.g. older iOS-only/no-web framing).
- Production endpoints live: `https://outdooradvisor.app/privacy` (privacy page) and `/api/weatherkit` (WeatherKit data). Production `WEATHERKIT_SERVICE_ID` must be `com.ahmadadnanone.outdooradvisor.weatherkit`.
- Standing audit notes:
  - WeatherKit is a server-side Vercel proxy (`api/weatherkit.js`); clients fall back to Open-Meteo if unavailable.
  - Google Maps/Places keys still exist as client/server fallbacks — keep them tightly restricted in Google Cloud; prefer routing lookups through Vercel.
  - `TravelScreen` uses static PMD tourist station links (PMD blocks server scraping); `useTouristWeather`/`/api/tourist` were removed.
  - Activities nearby-place lookup is premium UI-gated but native fallback can still hit Google Places directly — revisit before hardening server enforcement.

## Launch Readiness (audited 2026-04-27)

Use this section as the cross-platform handoff checklist for both Claude and Codex. Keep it current after every meaningful change.

### ✅ Done
- EAS production build #10 `FINISHED` — `.ipa` artifact ready (`ed9a25dd-7048-4eeb-93b1-70e0aea2fff0`)
- Apple Developer enrollment complete
- Distribution Cert `453DC55A7F5C91BB39B8FF07974CC1FB` + Provisioning Profile `7P8B63YYN9` — both active until April 2027
- Bundle ID `com.ahmadadnanone.OutdoorAdvisor` registered; HealthKit, WeatherKit, Push capabilities enabled on Apple portal
- About tab: privacy policy text, terms, disclaimer, and branded emails all complete (`src/components/settings/AboutTab.js`)
- `outdooradvisor.app` live on Vercel — treat as primary brand domain
- Premium gating: StoreKit subscription state plus email/Supabase allowlist bridge in place (`src/lib/premium.js`, `src/hooks/useStoreKitSubscriptions.js`)

### 🟢 LIVE on the App Store (verified 2026-06-03)
- **Approved and released** — version **1.0.4 / build `46`**, App Store Connect status **Ready for Distribution** (ASO release; previous live was 1.0.3 / build 44).
- Public listing live: `https://apps.apple.com/us/app/id6763982833`
- Privacy Policy URL set: `https://gist.github.com/ahmadadnanone-hue/51b5f2db7f89bce2724dc57bdfd1f2c2`
- StoreKit auto-renewable subscriptions replaced the old device-based trial; the live build ships with the real StoreKit/free-tier path and an internal premium allowlist.
- App name is **OutdoorAdvisor Pakistan** (original "OutdoorAdvisor" was taken on the App Store)
- Post-launch posture: ship JS-only fixes via OTA (`eas update --branch production`); reserve new EAS builds + App Store review for native/config changes.

### ⚠️ Ongoing / known gaps
- Native push: production `/api/push?action=cron` is live with a valid Expo/EAS APNs key (`ZQ96CMG8QN`); `.github/workflows/push-cron.yml` calls it every 15 min. Keep monitoring on-device receipt while the app is closed and scheduled cron delivery.
- StoreKit auto-renewable subscription products/offers/prices in App Store Connect still depend on Apple processing/review state.
- UI Blueprint phases 6, 7, 9, 10 not fully complete (Route Planner results card, motion polish, safety copy pass).
- `npm audit --audit-level=high` exits cleanly; moderate Expo-toolchain transitive warnings remain — do not `--force`-fix without a deliberate SDK decision.
- `expo-doctor` reports a false-positive Metro-config warning (no `metro.config.js` exists) plus patch-level package mismatches; align with `npx expo install --check` on the next native build.

### Next steps (post-launch)
The path to launch (builds #10 → #44, TestFlight, App Review, two rejections fixed) is **complete** — the app is live. Remaining ongoing work:
1. **ASO** — keep App Store listing (title/subtitle/keywords/description/screenshots) optimized; paste-ready copy lives in `APP_STORE_METADATA.md`. Metadata-only edits can ship without a new binary; keyword/subtitle/description changes still go through Apple review attached to a version.
2. **Ship fixes via OTA** (`eas update --branch production`) for JS-only changes; reserve new EAS builds + review for native/config changes.
3. Ensure `GEMINI_API_KEY` is set in Vercel so premium SynthesisCard shows full Gemini synthesis.
4. Monitor StoreKit subscription approval/processing in App Store Connect and scheduled push-cron delivery.

## Suggested Next Internal Updates

- keep this file current when premium rules change
- update it when auth, subscriptions, or app-store hardening starts
- update it when a new major route, AI behavior, or notification rule is added

## Recent Changes
- 2026-06-05 — **Auth system rebuilt + Sign in with Apple + wind-storm alerts; shipped to prod OTA + TestFlight.** Big multi-part session (branch `auth-system-rebuild`, fast-forward merged to `master`, commits `d42bba2`→`84a81aa`).
  - **Auth rebuild (the "account creation / no confirmation email" fix).** Root cause was NOT email delivery — Resend logs showed confirmation emails were `Delivered` all along. The breakage was (a) the confirmation email used a **magic link** pointing at the dead `outdooradvisor.vercel.app` redirect with no deep link back into the app, and (b) there was **no password reset and no resend**. Rebuilt on Supabase with **6-digit email codes** (no deep-linking): `AuthContext` gained `verifyCode` (signup OTP), `resendCode`, `requestPasswordReset` + `confirmPasswordReset` (recovery OTP → `updateUser`), `signInWithApple`, and `mapAuthError`; removed the broken `emailRedirectTo` path. New self-contained `src/components/auth/AuthFlow.js` (sign in / sign up / verify / forgot / reset + Apple button, validation, resend cooldown) replaced the cramped inline form in `AlertsScreen`. Helper views render as **inline function calls, not nested components** (RN focus-loss pitfall).
  - **Supabase email templates → 6-digit codes.** Confirm-signup + Reset-password templates rewritten to send `{{ .Token }}` instead of `{{ .ConfirmationURL }}`. ⚠️ **Email OTP Length was set to 8** in Supabase (Auth → Providers → Email) — the app's code box hard-caps input at 6, so 8-digit codes were unenterable. **Fixed to 6** (server-side, no rebuild). If the app's code input is ever made variable-length this can change.
  - **Sudden wind-storm + thunderstorm alerts (were never firing).** `smartAdvisor.js` only checked daily summary, PMD CAP feed, and walk nudges — nothing read live wind data, despite `windAlerts`/`thunderstormAlerts` toggles existing. Added `maybeSendWeatherHazardAlert()` (thunderstorm codes 95/96/99 + wind gusts ≥ threshold, gated by toggles, 3h cooldown, runs before the Health gate), a `windAlert` threshold (default 40 km/h gusts, both providers report km/h) + a Wind Gust slider in Settings → Thresholds, and fixed a pre-existing per-tier smart-state clobber.
  - **Sign in with Apple (native iOS).** `expo-apple-authentication` → `supabase.auth.signInWithIdToken`. Enabled the `com.apple.developer.applesignin` entitlement + `app.json usesAppleSignIn`; enabled "Sign in with Apple" on the App ID; configured the **Supabase Apple provider** (enabled, Client IDs = bundle ID `com.ahmadadnanone.OutdoorAdvisor`, no secret for native). Enabling the App ID capability **invalidated** the provisioning profile — had to regenerate it via interactive `eas credentials` + Apple ID login (old `7P8B63YYN9` → new **`U2TTKC66T4`**); EAS will NOT regenerate non-interactively even with the ADMIN ASC API key. `APPLE_SIGNIN_ENABLED` flag + a native-module-present guard so the Apple button stays hidden on builds/OTA without the native module.
  - **Builds & shipping.** `ITSAppUsesNonExemptEncryption=false` added to native `Info.plist` (kills the recurring "Missing Compliance" from build 48+). Builds: **47 & 49** (1.0.5, email+wind, Apple hidden) → TestFlight; 50/51/52 failed/cancelled on the stale profile; **build 53 (1.0.5)** is the Apple-enabled build now on TestFlight. **Production OTA shipped** (`eas update --branch production`, runtime 1.0.0, update group `5eb216ed`) delivering the auth + wind fixes to live 1.0.4 users.
  - ⚠️ **SECURITY — rotate the Resend API key.** It was committed in plaintext in this file (now redacted, but it's in git history). Rotate in Resend → update Supabase SMTP password.
  - ⚠️ **OTA wiring note.** The `production` build profile in `eas.json` has **no `channel`** (builds report `channel: none`, `channel:list` is empty), yet `eas update --branch production` is the established ship path. Delivery has worked historically via the `production` branch; if a future OTA doesn't land, add `"channel": "production"` to the production build profile (only affects new builds).
- 2026-06-03 — **ASO release 1.0.4 is LIVE.** Shipped a full App Store Optimization pass + new build, now `Ready for Distribution` on the public App Store (replaces 1.0.3 / build 44). Changes: (1) **App Name** → `OutdoorAdvisor: AQI & Smog` (keyword-led, was "OutdoorAdvisor Pakistan"); **Subtitle** → `Pakistan Weather & Travel` (was "Weather & Air for Pakistan"); **Keywords** rewritten to a zero-duplication 3-field allocation → `air,quality,pollen,allergy,forecast,UV,Lahore,Islamabad,Karachi,Murree,motorway,fog,traffic,heat` (96/100); refreshed **Promotional Text**, **Description**, **What's New**, and **App Review Notes** — all entered/saved in App Store Connect on version 1.0.4. (2) Version bump `1.0.3 → 1.0.4` in **both** `app.json` and `ios/OutdoorAdvisor/Info.plist` (commits `d00c767`, `b68afdf`, pushed to master). (3) EAS production build `56ee5414` (1.0.4 / **build 46**) from commit `b68afdf`, auto-submitted + attached + released through review. ⚠️ **Build-version gotcha discovered:** because a native `ios/` dir exists, EAS reads `ios/OutdoorAdvisor/Info.plist` `CFBundleShortVersionString` for the marketing version, **not** `app.json` — the first attempt (`90dd110f`) came out as 1.0.3 and had to be cancelled until the plist was bumped. Bump both files next time. (4) Docs precised: AGENTS.md condensed ~61%, CLAUDE.md StoreKit section refreshed, APP_STORE_METADATA.md rewritten as the ASO source of truth (commit `d00c767`). Local disk freed by deleting regenerable build artifacts (Pods/dist/.expo/ios build).
- 2026-05-31 — **Post-launch audit + repo cleanup (app is now LIVE on the App Store).** Verified in App Store Connect that version 1.0 / build 44 (v1.0.3) is **Ready for Distribution** and the public listing `https://apps.apple.com/us/app/outdooradvisor-pakistan/id6763982833` is live (Free · IAP · Age 4+ · Weather · 43.1 MB · Developer "Ahmed Adnan"). Git: working tree clean and in sync with origin/master. Cleanup performed: (1) removed `node.pkg` — a stray 69MB Node.js macOS installer that was the single largest tracked file (commit `83c0fd0`); added `node.pkg` + `*.pkg` to `.gitignore` (was already in `.easignore`/`.vercelignore`, so it never shipped to builds). (2) Deleted 3 fully-merged stale local branches (`claude/recursing-keller`, `claude/relaxed-solomon`, `claude/vigorous-grothendieck`); kept `RouteAdvisor` (separate project, 22 commits ahead) and active worktree branches. Expo health: `expo-doctor` reports 17/19 passing; the 2 failures are (a) a **false-positive Metro-config warning** — no `metro.config.js` exists anywhere in the repo, an expo-doctor quirk in `expo@~55.0.18`, harmless, and (b) 14 patch-level package mismatches (e.g. `expo 55.0.18` vs expected `~55.0.26`) — minor, did not block the live build; align with `npx expo install --check` on the next native build. Worktree note: `/Users/ahmedadnan/OutdoorAdvisor-main` is a git worktree of `/Users/ahmedadnan/OutdoorAdvisor/.git`, where `RouteAdvisor` is checked out at the root.
- 2026-05-30 — Removed the remaining visible "calm" wording from notification settings (`src/screens/AlertsScreen.js`), removed stale open-source wording from the About tab file header, cleaned matching wording in the App Store metadata source pack, and renamed the internal Travel snapshot neutral state from `calm` to `normal`. JS/docs-only; ship with EAS Update, not a native EAS build.
- 2026-05-30 — Tightened premium purchase flow after live App Store testing showed a subscription could be purchased while signed out. Home paywall now requires a signed-in OutdoorAdvisor account before Apple subscribe/restore actions, shows a sign-in CTA that navigates to Settings, disables plan buttons while signed out, and refreshes StoreKit entitlement after Supabase sign-in so existing Apple purchases can unlock premium once the user logs in. JS-only; ship with EAS Update, not a native EAS build.
- 2026-05-29 — Updated the in-app About tab copy without running an EAS build. Removed the word "calm" from the About hero/tagline copy and removed the full Open Source card/banner from `src/components/settings/AboutTab.js`. This is JS-only and should ship by OTA/EAS Update only after explicit user approval.
- 2026-05-28 — Fixed auth email links opening localhost instead of the real site. (1) Supabase project `qhygkrwekdacvpaqhkcf` → Authentication → URL Configuration: Site URL changed from `http://localhost:3000` to `https://outdooradvisor.app`; Redirect URLs allowlist now includes `https://outdooradvisor.app/**`. (2) Supabase "Confirm sign up" email template body updated: link now points to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (was using `{{ .ConfirmationURL }}` which redirected to root). (3) Created `public/auth/confirm.html` — a branded Liquid Glass activation status page. Handles all three Supabase confirmation flows: OTP `token_hash` (new), PKCE `code` exchange, and implicit `access_token` hash fragment. Shows success with email badge + "Open OutdoorAdvisor App" deep-link (`outdooradvisor://`), or expired-link error with 3-step recovery guide. Uses Supabase JS CDN. (4) `vercel.json` rewrite added: `/auth/confirm` → `/auth/confirm.html`. Commit `1f97fae` pushed to `master`; Vercel auto-deploy triggered from GitHub push.
- 2026-05-28 — Configured Resend as Supabase custom SMTP so auth emails (sign-up, password reset, magic links) now send from `support@outdooradvisor.app` branded as "OutdoorAdvisor" instead of Supabase's default address. Steps completed: (1) Created Resend account (GitHub login, username `ahmadadnanone`). (2) Added domain `outdooradvisor.app` in Resend with region `North Virginia (us-east-1)` — Resend auto-configured DNS records directly on Vercel via OAuth; DNS verified and domain status turned `Verified` within minutes. (3) Created Resend API key named "Supabase OutdoorAdvisor" (full access, all domains) — key `re_REDACTED` (⚠️ the literal key was previously committed here in plaintext; rotate it in Resend and update the Supabase SMTP password. Never commit API keys). (4) In Supabase project `qhygkrwekdacvpaqhkcf` → Authentication → Emails → SMTP Settings: enabled custom SMTP, set Host `smtp.resend.com`, Port `465`, Username `resend`, Password = Resend API key, Sender email `support@outdooradvisor.app`, Sender name `OutdoorAdvisor`. Saved successfully. Email forwarding via ImprovMX remains active for inbound mail to `support@`, `feedback@`, `privacy@outdooradvisor.app` → Gmail.
- 2026-05-28 — Resubmitted iOS App 1.0 to Apple App Review with build 41 (v1.0.2) after previous rejection. Removed build 31 from the submission, added build 41, saved, and clicked Update Review. App Review Notes (2,274 chars) address both rejection reasons: (1) Guideline 2.1.0 — all features are free, no paid content, email allowlist was internal-only and is removed in build 41; (2) Guideline 5.1.1(v) — account deletion is at Settings → About → bottom for signed-in users (direct delete) and signed-out users (mailto: link). Current status: 🟡 **Ready for Review** — build 1.0.2 (41), submission ID `785fa048-fdd4-4d36-8d9b-5e90f012bdf4`.
- 2026-05-28 — Hardened the StoreKit paywall after TestFlight showed `SKU not found` for the premium subscription buttons. `useStoreKitSubscriptions` now converts raw StoreKit SKU errors into reviewer/tester-friendly setup guidance and refuses to call `requestPurchase` until Apple has returned the subscription product. `HomeScreen` now marks unavailable subscription rows as pending instead of allowing a dead purchase tap. Commit `f114d99` was pushed to `master`; EAS Update group `820f8f67-1179-4d30-a03f-90e0cd474973` was published to production for iOS runtime `1.0.0`, and Vercel prod deploy `dpl_6i1NKS4LatbeFwqjSUJ8znpXGckk` is live on `https://outdooradvisor.app`. The underlying Apple product availability still depends on App Store Connect subscription processing/review state.
- 2026-05-27 — Created and uploaded iOS production/TestFlight build `1.0.3 (44)` after centralizing the premium allowlist. EAS build `8ff74e17-bac4-47a0-8379-c8c005c85c58` was built from commit `c731392`, IPA `https://expo.dev/artifacts/eas/iM6Dm6vxm2oJoiL8Bcnt5d.ipa`, and auto-submit uploaded the binary to App Store Connect. Apple processing is pending; once it finishes, build 44 should appear under TestFlight and can be selected for review instead of rejected build 41.
- 2026-05-27 — Moved the seeded premium allowlist into `src/config/premiumAllowlist.js` so internal/TestFlight premium users can be maintained in one obvious place. `src/lib/premium.js` now imports that config and still merges it with `EXPO_PUBLIC_PREMIUM_EMAILS`.
- 2026-05-27 — Added `tipu0002017@gmail.com` and `jameelayesha86@gmail.com` to the seeded internal premium allowlist in `src/lib/premium.js`.
- 2026-05-27 — Made all AI/Gemini features premium-only. Home synthesis now only fetches when `isPremium`, cached synthesis is cleared when disabled, the server-side `kind: 'synthesize'` path checks premium before calling Gemini, and the Home Outdoor Brief no longer shows an AI badge or refresh action for free users; free users get local rule-based guidance plus a premium unlock hint instead. Commit `f9065f7` was pushed to `master`, Vercel prod deploy `dpl_8abTJBzQqqstR3GJaP3qWV7NgCo1` is live on `https://outdooradvisor.app`, and EAS Update group `3ef66075-6175-464c-ad15-25d2f5fc85ed` was published to production for iOS runtime `1.0.0`.
- 2026-05-27 — Fixed why TestFlight did not offer build `42` on the phone: build 42 was uploaded under App Store version `1.0.0`, while the currently installed TestFlight build is `1.0.2 (41)`, so TestFlight treats 42 as an older app-version line. Root cause: the repo has an `ios/` directory, so EAS ignores `app.json`'s `expo.version` for the native IPA and uses the native Xcode project / Info.plist version, which still said `1.0` / `1.0.0`. Updated `app.json` to `1.0.3` and locally bumped ignored native iOS version files to marketing version `1.0.3`; EAS production build `27c6a9cb-5590-43cd-88b5-109d509f4442` finished as `1.0.3 (43)` from commit `4450c66`, IPA `https://expo.dev/artifacts/eas/5UT1fNFUwZD6zzwGRjHbr9.ipa`. EAS Submit `076ba915-6356-46b0-861c-82e56004d0bf` uploaded it to App Store Connect; wait for Apple processing, then build 43 should appear as a real TestFlight upgrade over `1.0.2 (41)`.
- 2026-05-26 — Started real StoreKit subscription implementation after Apple questioned how premium works after the trial. Added `expo-iap` plus `expo-iap` config plugin, new subscription product config (`src/config/subscriptions.js`), StoreKit subscription hook (`src/hooks/useStoreKitSubscriptions.js`), and rewired `AuthContext` so premium now comes from active StoreKit subscription state or internal allowlist/Supabase entitlement instead of the old device-started trial. `HomeScreen` now shows a premium subscribe card for free users with monthly/yearly subscription buttons and restore purchases. App Store Connect still needs the matching auto-renewable subscription products created: monthly `com.ahmadadnanone.outdooradvisor.premium.monthly` with 15-day intro trial and yearly `com.ahmadadnanone.outdooradvisor.premium.yearly` with 1-month intro/free offer. Commit `65c4352` was pushed to `master`; Vercel prod deploy `dpl_HUnRPRWQTnxDTQh3KwnPaBeW7idF` is live on `https://outdooradvisor.app`. EAS iOS production build `6a67eb36-d1d3-4204-b5d1-ae05a3bd9bb7` finished as build number `42`, IPA `https://expo.dev/artifacts/eas/e968YnVRj5VJsKRfuxXu8H.ipa`, and EAS Submit `cb6aa4c4-67b7-4d35-8583-1a6c0d18471c` uploaded it to App Store Connect for Apple processing. OTA cannot ship this native IAP change.
- 2026-05-25 — Addressed App Review rejection after build 41 resubmission. Apple rejected build `1.0.2 (41)` on iPad Air 11-inch (M3), iPadOS 26.5, asking what happens after the 7-day trial and saying the delete-account feature was inaccessible. `src/components/settings/AboutTab.js` now shows a prominent Account Management card near the top of About with a full-width Delete account button for signed-in users (and request-deletion fallback for signed-out users), while keeping the footer link as backup. `src/screens/HomeScreen.js` now clarifies after trial expiry that no payment is taken and no purchase is required. `APP_STORE_METADATA.md` review notes now directly answer the 7-day trial question and explain the new in-app delete-account path for reviewers. Commit `c68986c` was pushed to `master`, EAS Update group `0e312d7a-7ef8-4645-bfc1-a294d85da87f` was published to the production branch for iOS runtime `1.0.0`, Vercel prod deploy `dpl_1LKi5kGAxXzQSqgbeX9BVmycVf9U` went live on `https://outdooradvisor.app`, and App Store Connect was updated/replied/resubmitted at 2026-05-25 3:25 PM PKT. Current App Store review status: **Waiting for Review**.

---

### Earlier history digest (2026-04-18 → 2026-05-18)
The verbose per-commit changelog for this window was condensed on 2026-05-31. Key durable facts:

- **App Store path:** iOS builds progressed #10 → #41 via EAS (`production` / `testflight-preview` profiles, `distribution: STORE`). Build 31 (v1.0.0) was the first App Store submission (2026-05-11); builds 41/43/44 followed after the version line was bumped to `1.0.3` (the native `ios/` Info.plist version, not `app.json`, governs the IPA marketing version). App Review rejected twice — Guideline 2.1.0 (paid-content question; fixed by removing the internal email allowlist from prod) and 5.1.1(v) (account deletion accessibility; fixed by adding a prominent Delete-account card in About). Privacy policy hosted at a GitHub Gist; `aps-environment` set to `production` in entitlements.
- **EAS Production plan** activated 2026-05-14 → OTA via `eas update --branch production` for JS-only fixes. Build 41 (2026-05-15) was the first with `expo-updates` wired.
- **Push/notifications backend:** single Hobby-friendly `/api/push` route (`action=register|unregister|test|cron`); Expo Push delivery + receipt checking in `api/_lib/nativePush.js`; alert engine `api/_lib/alertEngine.js` covers PMD CAP, NDMA, AQI, wind, thunderstorm, rain, motorway-closure, and 3×-daily outdoor summaries. WeatherKit-first (`/api/weatherkit`) with Open-Meteo fallback. APNs key `ZQ96CMG8QN`. GitHub Actions cron every 15 min (`OA_CRON_SECRET`). NDMA push gated to advisories <72h old and region-matched. Dedup/anti-stacking added to the in-app notification inbox.
- **NDMA layer:** `api/_lib/ndmaAdvisories.js` scrapes ndma.gov.pk, classifies GLOF/landslide/flood/heatwave/storm, region-targets, and surfaces in Travel + Home synthesis (`/api/ndma`).
- **WeatherKit:** moved from client-side signing to server-side Vercel proxy `api/weatherkit.js` (env: `WEATHERKIT_TEAM_ID/KEY_ID/SERVICE_ID/PRIVATE_KEY`); hardened to return structured errors on Apple HTML 502s.
- **StoreKit/premium:** `expo-iap` + `src/config/subscriptions.js` + `src/hooks/useStoreKitSubscriptions.js`; `AuthContext` composes premium from StoreKit state + internal allowlist (`src/config/premiumAllowlist.js`), replacing the old device 7-day trial. All Gemini/AI features made premium-only (2026-05-27). Subscribe card on Home with restore-purchases.
- **Brand/domain/email:** `outdooradvisor.app` purchased via Vercel (2026-04-22), live serving the web app; Vercel Analytics mounted. Resend custom SMTP for Supabase auth mail from `support@outdooradvisor.app`; ImprovMX forwards `support@`/`feedback@`/`privacy@` → Gmail. New liquid-glass app icon (`assets/icon-source.svg` → generated icon set) + post-splash `LaunchAnimation`.
- **Travel overhaul:** unified NHMP/PMD/NDMA sources card, live `TouristStationsCard` (11 stations, WeatherKit/Open-Meteo), premium motorway closure alerts, fixed false rain/storm pushes (DEFINITE vs AREA condition codes + `precipitationIntensity` gate).
- **UI/UX:** Tide Guide-inspired slate/blue gradient; floating glass tab bar; shared animated glass weather icons (replaced emoji); FAB hidden (logic preserved); Home greeting de-personalized; full-screen web shell fixes. Activity scoring tuned (swimming/gym/indoor profiles; `padel` default-enabled).
