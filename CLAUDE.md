# OutdoorAdvisor — Project Reference

> Everything a developer (or Claude) needs to understand this codebase in one place.

---

## What is OutdoorAdvisor?

A **premium iOS-only app** that gives people in Pakistan a calm, practical read on outdoor conditions before they step outside. It combines weather, air quality, pollen, road advisories, and activity scoring into a single daily-driver app with a Liquid Glass aesthetic.

**Target market:** Pakistan — specifically urban commuters, families planning trips to hill stations (Murree, Swat), and highway travellers (M2, N-5).

**App Store only. No web. No Android.**  
(Web and Android are separate projects, not in this repo.)

---

## Hosting & Repositories

### This app (iOS)
- **Source:** GitHub → `https://github.com/ahmadadnanone-hue/OutdoorAdvisor`
- **Branch:** `master`
- **Local path:** `/Users/ahmedadnan/OutdoorAdvisor-main/`
- **Distribution:** Apple App Store via EAS Build / Xcode
- **Current status (2026-05-31): 🟢 LIVE on the App Store.** Version 1.0 / build **44** (v1.0.3), App Store Connect status **Ready for Distribution**. App name: **OutdoorAdvisor Pakistan**. Public listing: `https://apps.apple.com/us/app/outdooradvisor-pakistan/id6763982833`. (Earlier review rounds: build 31 → 41 → 44.)
- **App Store Connect app ID:** `6763982833`
- **EAS project ID:** `0b8b92b0-0722-4ab1-b4c4-34df3ba8e956`
- **Apple Team ID:** `X6TA54T858` (Ahmed Adnan, Individual)
- **No server** — the app calls external APIs directly from the device

### Old Vercel web app
- **Repo:** Same GitHub repo (`ahmadadnanone-hue/OutdoorAdvisor`) — the web code was **deleted** from `master` during the iOS-only cleanup
- **Vercel project:** `outdooradvisor` at `https://outdooradvisor.vercel.app`
- **API base URL** hardcoded in `src/config/api.js` → `https://outdooradvisor.vercel.app`
- **Status:** The Vercel deployment is stale/frozen. The iOS app still calls `outdooradvisor.vercel.app` for:
  - `/api/aqi` — proxies AQICN  
  - `/api/pollen` — pollen data  
  - `/api/ai-briefing` — Gemini AI weather summary  
  - `/api/nhmp` — NHMP road advisories (web fallback; iOS uses direct fetch)
- **Can we update Vercel with latest changes?** No — the web source was deleted. The Vercel app is API-routes only now; the frontend doesn't exist. The API routes in `/api/` still work independently and the iOS app depends on them. **Do not delete the Vercel project.** If you want to update those API routes, you'd need to restore a `/api/` directory and redeploy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.83.4 + Expo SDK 55 |
| Language | JavaScript (no TypeScript) |
| Navigation | React Navigation 7 (bottom tabs) |
| Animations | React Native Reanimated 4.2 |
| Glass/blur | expo-blur 55.0.14 (BlurView) |
| Icons | @expo/vector-icons → Ionicons |
| Backend | Supabase (auth + optional account sync) |
| Weather | WeatherKit REST API (primary) → Open-Meteo (fallback) |
| JWT signing | @noble/curves 2.2 (ES256, pure JS) |
| AQI | AQICN via Vercel proxy `/api/aqi` |
| Pollen | via Vercel proxy `/api/pollen` |
| AI briefing | Gemini via Vercel proxy `/api/ai-briefing` |
| Road data | NHMP direct fetch (iOS) + Vercel proxy (fallback) |
| Health | @kingstinct/react-native-healthkit (steps, distance, energy) |
| Notifications | expo-notifications (local + background task) |
| Background | expo-background-task + expo-task-manager |
| Storage | AsyncStorage (preferences) + in-memory cache (weather/AQI) |
| Maps | react-native-maps (TravelScreen) |

---

## Build & Run

```bash
# Install deps
npm install

# Run in iOS Simulator (requires Xcode)
npx expo run:ios

# Run on physical iPhone
npx expo run:ios --device "iPhone Name"

# Build for App Store (EAS)
eas build --platform ios --profile production
```

**Bundle ID:** `com.ahmadadnanone.OutdoorAdvisor`  
**iOS deployment target:** 15.1  
**Minimum Xcode:** 16+

---

## Project Structure

```
OutdoorAdvisor-main/
├── App.js                          Root — providers, tab navigator, FAB
├── app.json                        Expo config (bundle ID, permissions, plugins)
├── ios/                            Native Xcode project (managed by Expo)
│   └── OutdoorAdvisor/
│       └── OutdoorAdvisor.entitlements   WeatherKit + HealthKit + Push
├── src/
│   ├── config/          External service config
│   ├── context/         React Context providers
│   ├── data/            Static datasets
│   ├── design/          Design tokens (colors, type, spacing, shadows)
│   ├── hooks/           Data-fetching React hooks
│   ├── lib/             SDK clients (Supabase)
│   ├── screens/         Full-page screens (4 tabs)
│   ├── services/        Background logic + WeatherKit client
│   ├── components/      Reusable UI components
│   │   ├── glass/       Core Liquid Glass primitives
│   │   ├── cards/       Domain-specific cards
│   │   ├── home/        HomeScreen section components
│   │   ├── settings/    Settings tab components
│   │   └── layout/      Screen wrappers
│   └── utils/           Pure helpers, parsers, cache
└── assets/              App icon, splash screen
```

---

## Screens (4 tabs)

### 1. Home (`src/screens/HomeScreen.js`)
The main daily-driver screen. A container-only file (~315 lines) that holds all hooks and passes data down to section components.

**Sections (rendered via `settings.homeSections` order):**
| Component | What it shows |
|---|---|
| `HomeHeader` | Greeting, city pill, settings gear |
| `DecisionSection` | OutdoorDecisionCard + AI briefing |
| `AqiSection` | Live conditions card (temp, AQI, wind, humidity) |
| `WindSection` | Wind speed / gusts / direction |
| `DetailsSection` | Feels like, PM2.5, UV, pressure grid |
| `PollenSection` | Pollen level banner |
| `ForecastSection` | ForecastStrip (7-day) + HourlyForecastStrip (24h) |
| `ActivitySection` | Activity cards with scoring |
| `HealthStatsSection` | Steps, distance, calories from HealthKit |
| `TravelSection` | Quick links to Murree & M2 checks |

**Modals on HomeScreen:**
- `CityPickerModal` — search city or use device GPS
- `InsightModal` — tapping AQI/pollen banners opens detail text
- `ForecastDetailModal` — tap a day in ForecastStrip → full day breakdown

### 2. Travel (`src/screens/TravelScreen.js`)
Road intelligence screen. Fetches NHMP advisories (direct on iOS, proxy on web) and PMD official forecasts. Shows road closures, motorway status, and route-specific weather.

### 3. Outdoors / Activities (`src/screens/ActivitiesScreen.js`)
Activity scoring for running, cycling, walking, cricket, hiking, football. Each activity gets a score (0–100) and colour based on current AQI + weather + time of day.

### 4. Settings (`src/screens/AlertsScreen.js`)
Four sub-tabs:
- **Thresholds** — AQI, PM2.5, wind alert levels (custom sliders)
- **Notifications** — toggle local alert types; smart advisor settings
- **Customize** — reorder/show/hide home sections
- **About** — full App Store-compliant about page (see below)

---

## Global UI

### FAB (`src/components/FABMenu.js`)
Floating action button, bottom-right corner. Tapping opens a quarter-circle spring-animated fan (-180° → -90°, radius 118px, stagger 55ms).

5 actions: Refresh (green) · Location (cyan) · Share (blue) · Travel (orange) · Alerts (yellow)

All satellite icons use Ionicons (Liquid Glass-compatible vector, no emoji).

### GlassTabBar (`src/components/glass/GlassTabBar.js`)
Floating pill-shaped bottom nav. BlurView + LinearGradient + glass tint. Active tab gets `tabBarActive` pill highlight.

---

## Design System (`src/design/`)

Import everything from the barrel:
```js
import { colors, typography, spacing, radius, shadows } from '../design';
// or aliased:
import { colors as dc } from '../design';
```

### Key color tokens
```js
dc.bgTop / dc.bgMid / dc.bgBottom  // gradient stops (#2A3343 → #3B4E68 → #58739A)
dc.cardGlass                        // rgba(255,255,255,0.11) — standard glass surface
dc.cardGlassStrong                  // rgba(255,255,255,0.18) — elevated glass
dc.cardStroke                       // rgba(255,255,255,0.24) — border
dc.textPrimary                      // #F5F8FA
dc.textSecondary                    // rgba(245,248,250,0.72)
dc.textMuted                        // rgba(245,248,250,0.56)
dc.accentCyan                       // #9BC8FF — primary accent
dc.accentGreen / Yellow / Orange / Red / Blue  // semantic accents
dc.accentCyanBg                     // rgba(155,200,255,0.22) — tinted backgrounds
```

### Glass primitives
| Component | Use |
|---|---|
| `GlassCard` | Raised card with BlurView + press feedback + haptics |
| `GlassPill` | Compact inline pill (city selector, settings badge) |
| `GlassButton` | Full-width tappable button |
| `GlassTabBar` | Bottom navigation |
| `LiquidGlassView` | Generic BlurView wrapper for custom surfaces |
| `ScreenGradient` | Full-screen LinearGradient wrapper for every screen |

---

## Data Hooks

### `useWeather(lat, lon)` → `src/hooks/useWeather.js`
**Primary:** WeatherKit REST API (when credentials set in `src/config/weatherkit.js`)  
**Fallback:** Open-Meteo (free, no key)

Returns:
```js
{
  current: { temp, feelsLike, humidity, windSpeed, windDirection, windGusts,
             weatherCode, uvIndex, pressure, visibility, conditionCode, daylight },
  hourly: [{ time, temp, humidity, weatherCode, precipProbability, conditionCode }], // 24 items
  daily:  [{ date, maxTemp, minTemp, weatherCode, precipSum, precipProbability,
             uvIndex, windSpeed, windGusts, windDirection, sunrise, sunset,
             moonPhase, feelsLikeMax, feelsLikeMin, humidityMax, humidityMin,
             precipitation, conditionCode }],  // 7 items
  loading, error, isUsingCache, updatedAt, refresh, source
}
```

### `useAQI(lat, lon)` → `src/hooks/useAQI.js`
Fetches from AQICN via Vercel proxy. Returns `{ aqi, pm25, pm10, o3, no2, history, loading, error }`. Cache: 30 min.

### `useLocation()` → `src/hooks/useLocation.js`
`expo-location` GPS or falls back to selected city from `CITIES`. Returns `{ lat, lon, city, displayName, loading, refresh }`.

### `usePollen(lat, lon)` → `src/hooks/usePollen.js`
Pollen index via Vercel proxy. Returns `{ level, category, loading, error }`. Cache: 6 hours.

### `useHealthData()` → `src/hooks/useHealthData.js`
HealthKit integration (iOS only). Reads steps, walking distance, active energy for today. Returns `{ steps, distance, calories, loading, authorized }`.

### `useAiBriefing(...)` → `src/hooks/useAiBriefing.js`
Calls Gemini via Vercel `/api/ai-briefing`. Returns a 2-sentence outdoor summary. Cache: 20 min. Falls back to rule-based text.

---

## Services

### `src/services/weatherKit.js`
WeatherKit REST API client. Generates ES256 JWT on-device (no backend needed):
- `getWeatherKitToken()` — builds + signs JWT, caches for 25 min
- `fetchWeatherKit(lat, lon)` — calls `weatherkit.apple.com/api/v1/weather/...`
- `normalizeWeatherKit(json)` — maps Apple response to the `useWeather` shape

### `src/services/smartAdvisor.js`
Runs on app start + foreground + background task. Checks conditions and sends smart local notifications (morning summary, walk nudge, AQI alert). 4h cooldown on walk nudges.

### `src/services/backgroundTask.js`
Registers `OUTDOOR_ADVISOR_CHECK` with `expo-background-task`. Calls `runSmartAdvisorCheck` periodically in the background.

### `src/services/notificationService.js`
Wrapper around `expo-notifications`. Sends local notifications; manages inbox in AsyncStorage.

---

## WeatherKit Setup (action required)

Credentials template: `src/config/weatherkit.js` (gitignored — never commit)

```js
export const WK = {
  TEAM_ID:    'XXXXXXXXXX',   // Apple Developer Team ID
  SERVICE_ID: 'com.ahmadadnanone.weatherkit',
  KEY_ID:     'XXXXXXXXXX',   // from AuthKey_KEYID.p8 filename
  KEY_P8: `-----BEGIN PRIVATE KEY-----
...paste .p8 content...
-----END PRIVATE KEY-----`,
};
```

**How to get credentials:**
1. `developer.apple.com` → Identifiers → `com.ahmadadnanone.OutdoorAdvisor` → enable **WeatherKit**
2. Identifiers → `+` → Services IDs → `com.ahmadadnanone.weatherkit` → enable WeatherKit
3. Keys → `+` → check **WeatherKit** → Download `AuthKey_KEYID.p8`
4. Account → Membership → copy Team ID

Until configured the app silently uses Open-Meteo.

---

## iOS Entitlements

`ios/OutdoorAdvisor/OutdoorAdvisor.entitlements`:
```xml
com.apple.developer.weatherkit          → WeatherKit REST API
com.apple.developer.healthkit           → HealthKit read access
com.apple.developer.healthkit.background-delivery → Background health updates
aps-environment: development            → Push notifications (dev)
```

---

## Contexts

| Context | File | What it manages |
|---|---|---|
| `ThemeProvider` | `ThemeContext.js` | Dark mode always; NavigationContainer colours |
| `SettingsProvider` | `SettingsContext.js` | Units (°C/°F, km/mi), home section order, user preferences |
| `AuthProvider` | `AuthContext.js` | Supabase session, sign in/out/up, premium flag, 7-day trial state |

---

## Utilities

| File | Purpose |
|---|---|
| `persistentCache.js` | In-memory TTL cache (AsyncStorage for web); all weather/AQI caching flows through here |
| `weatherCodes.js` | WMO weather code → description + emoji |
| `activityScoring.js` | 0–100 score for each outdoor activity based on AQI + weather |
| `alertPreferences.js` | Load/save notification thresholds from AsyncStorage |
| `alertNotifications.js` | Request local notification permissions |
| `nhmpParser.js` | Scrapes and parses NHMP road advisory HTML |
| `locationSnapshot.js` | Persists last known location for background tasks |
| `notificationInbox.js` | AsyncStorage-backed notification history |
| `trialState.js` | 7-day device-based free trial — records `firstLaunchAt` in AsyncStorage; returns `{ inTrial, daysRemaining, expiresAt }` |

---

## Static Data

| File | Contents |
|---|---|
| `data/cities.js` | 30+ major Pakistan cities with lat/lon |
| `data/activities.js` | Activity definitions (name, icon, thresholds) |
| `data/mockData.js` | Dev-only sample data |

---

## Environment Variables

Set in `.env.local` (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL              Supabase project URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY  Supabase anon key
EXPO_PUBLIC_PREMIUM_EMAILS            Comma-separated premium email list
EXPO_PUBLIC_API_BASE_URL              Overrides default Vercel API base URL (optional)
GOOGLE_MAPS_API_KEY                   Google Maps (TravelScreen map tiles)
```

`src/config/weatherkit.js` — WeatherKit credentials (gitignored separately)

---

## Premium & StoreKit Subscriptions

Premium is backed by **Apple auto-renewable subscriptions** (the old device 7-day trial no longer grants production premium). Public trials are Apple-managed introductory offers.

**How it works:**
1. Product IDs in `src/config/subscriptions.js`: monthly `com.ahmadadnanone.outdooradvisor.premium.monthly` (15-day intro trial), yearly `com.ahmadadnanone.outdooradvisor.premium.yearly` (1-month intro).
2. `src/hooks/useStoreKitSubscriptions.js` (via `expo-iap`) exposes active subscription state + restore-purchases.
3. `AuthContext` composes `isPremium` from StoreKit subscription state **plus** internal entitlement (no longer from `trial.inTrial`).
4. `entitlementPremium` = `derivePremiumState(user)` in `src/lib/premium.js` — true when email is in `src/config/premiumAllowlist.js` / `EXPO_PUBLIC_PREMIUM_EMAILS`, or Supabase metadata has `plan/tier/subscription_status = premium/active`.
5. Free users keep core weather/AQI/activities/travel; AI/detail/weather-depth/route-planner features are premium-gated. All Gemini/AI is premium-only — `/api/ai/briefing` checks premium before calling Gemini.

**UI:** `HomeScreen` shows a StoreKit subscribe card (monthly/yearly + restore) for free users.

**Notes:** `expo-iap` is a native module — requires a full EAS build, not OTA. `EXPO_PUBLIC_TESTFLIGHT_PREMIUM` was removed from EAS profiles (2026-05-26) so TestFlight/review builds exercise the real StoreKit/free path. App Store Connect subscription products/offers/prices still depend on Apple processing.

---

## About Tab (App Store compliance)

`src/components/settings/AboutTab.js` — full legal coverage:
- Version + build number (from `expo-constants`)
- Privacy Policy (inline modal — no external URL needed at review time)
- Terms of Use (inline modal)
- Weather Disclaimer ("not for safety-critical decisions")
- Data Sources with attribution (WeatherKit, Open-Meteo, AQICN, NHMP, PMD)
- Open-source acknowledgements (7 libraries)
- Contact (mailto link)
- Legal footer with © year + non-affiliation statement

> Apple requires a **Privacy Policy URL** in App Store Connect. The privacy policy is hosted at:
> `https://gist.github.com/ahmadadnanone-hue/51b5f2db7f89bce2724dc57bdfd1f2c2`

---

## App Store Submission Checklist

**Build prep (done ✅):**
- [x] Fill in `src/config/weatherkit.js` with real credentials (Team `X6TA54T858`, Key `A33GG7GP8N`, Service ID `com.ahmadadnanone.weatherkit`)
- [x] Enable WeatherKit + WeatherKit Service ID on developer.apple.com
- [x] Change `aps-environment` in entitlements to `production`
- [x] Clean Info.plist (remove Expo Dev Launcher `NSLocalNetworkUsageDescription`, `NSBonjourServices`, `NSAllowsLocalNetworking`)
- [x] Add proper `NSLocationAlwaysAndWhenInUse` + `NSLocationAlways` strings
- [x] Add `app.config.js` `withInfoPlist` plugin to prevent prebuild from re-adding dev keys
- [x] Switch to 7-day device-based free trial (replaced "premium for everyone" production override)
- [x] Host Privacy Policy at public Gist URL
- [x] `eas build --platform ios --profile production` → v1.0.1 build 31
- [x] `eas submit --platform ios --latest` → uploaded to App Store Connect, available in TestFlight

**App Store Connect — still to do before "Submit for Review":**
- [ ] App Information → Privacy Policy URL: `https://gist.github.com/ahmadadnanone-hue/51b5f2db7f89bce2724dc57bdfd1f2c2`
- [ ] App Information → Category: Weather (primary), Health & Fitness (secondary)
- [ ] Age rating: 4+
- [ ] Version 1.0.1 → fill in: Name, Subtitle, Description, Keywords (`weather,air quality,AQI,Pakistan,pollen,Lahore,Karachi,Islamabad,outdoor,road`), Support URL, Marketing URL (optional)
- [ ] Screenshots: 6.7" iPhone (1290×2796) required; 5.5" iPhone (1242×2208) required
- [ ] App Review Information: contact email, demo notes ("No login required — open the app to see the 7-day trial unlock all premium features")
- [ ] Pricing & Availability: Free, available in Pakistan + worldwide (your call)
- [ ] Export Compliance: answer No (already declared `ITSAppUsesNonExemptEncryption: false`)
- [x] Click **Submit for Review** — done 2026-05-11 3:12 PM, Waiting for Review

**Submitting newer builds later:**
```bash
cd /Users/ahmedadnan/OutdoorAdvisor-main
eas build --platform ios --profile production
eas submit --platform ios --latest
```

---

## App Store Release History

| Build | Version | Date | Status |
|---|---|---|---|
| 31 | 1.0.0 | 2026-05-11 | Submitted for review — Waiting for Review |
| 30 | 1.0.0 | 2026-05-11 | TestFlight only (pre-trial) |

## Git History (recent)

```
97cee0b  Update CLAUDE.md: document trial system + current submission status
0cb8dc9  Switch to 7-day device-based free trial
ee4b8f7  Prepare for App Store submission (clean Info.plist + aps-environment → production)
6aead34  Record build 29 deployment
038ef90  Fix notification inbox and travel advisory scope
57a6936  Show NDMA advisories in Travel
39a797e  Build 28: edge-to-edge tab bar, fix scroll content hidden behind bar
```
