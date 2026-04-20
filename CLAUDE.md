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
- **Distribution:** Apple App Store via EAS Build / Xcode (not yet submitted — in development)
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
| `AuthProvider` | `AuthContext.js` | Supabase session, sign in/out/up, premium flag |

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

> Apple requires a **Privacy Policy URL** in App Store Connect. Host the privacy policy text (already written in the app) at any public URL — a GitHub Gist is fine.

---

## App Store Submission Checklist

- [ ] Fill in `src/config/weatherkit.js` with real credentials
- [ ] Enable WeatherKit + WeatherKit Service ID on developer.apple.com
- [ ] Change `aps-environment` in entitlements to `production` before release build
- [ ] Host Privacy Policy at a public URL; add URL to App Store Connect
- [ ] Run `eas build --platform ios --profile production`
- [ ] Submit via Xcode Organizer or EAS Submit
- [ ] App Store Connect metadata: description, keywords, screenshots (6.7" + 5.5")
- [ ] Age rating: 4+
- [ ] Category: Weather (primary), Health & Fitness (secondary)

---

## Git History (recent)

```
0bcee53  Build full App Store-compliant About tab
974c2a9  Add WeatherKit REST API with Open-Meteo fallback
10522ee  Replace emoji with Ionicons in FABMenu satellite items
0553981  Fix FABMenu y-axis direction + add SafeAreaProvider
8d6fc6a  Add floating action button with quarter-circle spring fan animation
cfc47a0  Refactor HomeScreen: split 1,900-line file into 13 focused components
ebfd6e0  Overhaul: iOS-only glass UI, remove Route Planner & all web/legacy code
```
