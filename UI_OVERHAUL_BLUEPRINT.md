# OutdoorAdvisor — UI Overhaul Blueprint

> Canonical plan for converting OutdoorAdvisor from a prototype-looking
> weather dashboard into a premium iOS Liquid Glass "Pakistan Road Intelligence
> Cockpit." Tide Guide / Apple Weather as visual reference. Do not delete —
> this is the source of truth for phased work.

**Owner:** Ahmed · **Started:** 2026-04-18 · **Target:** iPhone first, then Android parity

---

## North Star

The app should feel **premium, calm, atmospheric, Apple native, glassy,
layered, travel-focused, intelligent, and trustworthy** — like Tide Guide
but for Pakistani road intelligence (routes, weather, NHMP/PMD/NDMA
advisories, AQI, risk scoring, AI summary).

It must **never** overclaim safety. Wording is part of the design.

---

## Design principles (non-negotiable)

1. **Readability first.** Glass beautifies but must not hurt text contrast.
2. **One reusable component, not ten copy-pasted card styles.**
3. **Haptics are signal, not noise** — only on primary CTAs and tab changes.
4. **Animations are subtle** — fade + 8px slide max. No bouncy springs on list items.
5. **Safety copy is calm.** Never "guaranteed safe." Use "Go with care," "Based on latest advisories," "Recheck before departure."
6. **No emoji in navigation or primary chrome.** Ionicons only.

---

## Design tokens (source of truth)

All values live in `src/design/`. Nothing inline.

### Color palette

```js
bgTop:            '#071523'
bgMid:            '#102B3D'
bgBottom:         '#173E4A'

cardGlass:        'rgba(255,255,255,0.10)'
cardGlassStrong:  'rgba(255,255,255,0.16)'
cardStroke:       'rgba(255,255,255,0.18)'
cardStrokeSoft:   'rgba(255,255,255,0.09)'
cardHighlight:    'rgba(255,255,255,0.12)'  // top inner edge

textPrimary:      '#F5F8FA'
textSecondary:    'rgba(245,248,250,0.68)'
textMuted:        'rgba(245,248,250,0.45)'

accentBlue:       '#16A8FF'
accentCyan:       '#38D6E8'
accentGreen:      '#6EF2A0'
accentYellow:     '#FFD34E'
accentOrange:     '#FF9D3D'
accentRed:        '#FF5F6D'

dangerGlass:      'rgba(255,95,109,0.14)'
warningGlass:     'rgba(255,157,61,0.14)'
successGlass:     'rgba(110,242,160,0.13)'
infoGlass:        'rgba(22,168,255,0.14)'

blobCyan:         'rgba(22,168,255,0.16)'
blobTeal:         'rgba(56,214,232,0.10)'
```

### Radius

```js
pill: 999, small: 16, medium: 22, large: 30, xl: 38
```

### Spacing

```js
screenX: 20, cardPadding: 22, gap: 16, sectionGap: 24
```

### Typography

```js
screenTitle:  { size: 34, weight: '800', letterSpacing: -0.8 }
cardTitle:    { size: 28, weight: '800', letterSpacing: -0.5 }
sectionLabel: { size: 13, weight: '800', letterSpacing: 2.2, uppercase: true }
body:         { size: 17, weight: '500', lineHeight: 25 }
caption:      { size: 13, weight: '600', lineHeight: 18 }
metric:       { size: 48, weight: '800', letterSpacing: -1.2 } // the big 36°
```

### Shadows

```js
card:   { color:'#000', opacity:0.28, radius:30, offsetY:18, elevation:10 }
subtle: { color:'#000', opacity:0.18, radius:14, offsetY:8,  elevation:5  }
```

---

## File structure (target)

```
src/
├─ design/
│  ├─ colors.js
│  ├─ typography.js
│  ├─ spacing.js
│  └─ shadows.js
├─ components/
│  ├─ glass/
│  │  ├─ GlassCard.js
│  │  ├─ GlassPill.js
│  │  ├─ GlassButton.js
│  │  ├─ GlassTabBar.js
│  │  └─ LiquidGlassView.js   # expo-glass-effect wrapper w/ BlurView fallback
│  ├─ cards/
│  │  ├─ LiveConditionsCard.js
│  │  ├─ OutdoorDecisionCard.js
│  │  ├─ TravelSnapshotCard.js
│  │  ├─ AdvisorySourceCard.js
│  │  └─ RouteOptionCard.js
│  └─ layout/
│     ├─ ScreenGradient.js      # renamed from ScreenBackground
│     ├─ ScreenHeader.js
│     └─ FloatingSettingsButton.js
└─ screens/  (unchanged names, rewired internals)
```

Old components to **retire** (keep during migration, delete at end):
- `components/LiquidGlassCard.js` → replaced by `glass/GlassCard.js`

---

## Phases (execution order)

Each phase is a stopping point — we build, test on sim/device, commit, then move on.

### Phase 0 — Audit & token foundation  ✅ Complete
- [x] Install `expo-haptics`, `expo-linear-gradient`
- [x] Install `expo-glass-effect`, `@expo/vector-icons`, `react-native-reanimated`
- [x] Create `src/design/` tokens (colors/typography/spacing/shadows)
- [x] Update existing `src/theme/glass.js` palette to match spec exactly
- [x] **Exit gate:** tokens importable, no runtime errors

### Phase 1 — Glass primitive components  ✅ Complete
- [x] Move `GlassCard`, `GlassButton`, `GlassTabBar`, `ScreenBackground` into new folders
- [x] Rename `ScreenBackground` → `ScreenGradient`
- [x] Add new `GlassPill` (for location selector, stat pills)
- [x] Add `LiquidGlassView` wrapper — uses `expo-glass-effect` on iOS 26+, falls back to BlurView
- [x] Remove default haptics from `GlassCard` (opt-in only)
- [x] **Exit gate:** GlassPreviewScreen shows all 5 primitives, readable text, smooth haptics

### Phase 2 — Icon system swap  ✅ Complete
- [x] Add `@expo/vector-icons` (Ionicons)
- [x] Build a single `<Icon name size color/>` wrapper so we can swap the icon lib later
- [x] Replace all emoji in tab bar with Ionicons outline set
- [x] **Exit gate:** no emoji in primary chrome (tabs, headers, buttons). Content areas may keep emoji for now.

### Phase 3 — Domain cards  ✅ Complete
Build in this order (easiest → hardest):
1. `AdvisorySourceCard` (NHMP / PMD — simple 2-line stat card)
2. `OutdoorDecisionCard` (status-tinted glass w/ headline)
3. `TravelSnapshotCard` (warning-tinted w/ mini stat pills)
4. `LiveConditionsCard` (big — metric + weather icon + 3-stat row + AQI snapshot)
5. `RouteOptionCard` (route viz + risk badge + recommendation chip)
- [x] **Exit gate:** all 5 render correctly in GlassPreviewScreen with real-ish dummy data

### Phase 4 — Home screen migration  ✅ Complete
- [x] Rewire `HomeScreen` to use `ScreenGradient` + new cards
- [x] Glass location selector pill (top)
- [x] Round glass settings button (top right)
- [x] `LiveConditionsCard` replaces flat blue card
- [x] `OutdoorDecisionCard` below
- [x] **Exit gate:** functional parity with current HomeScreen, new look

### Phase 5 — Travel screen migration  ✅ Complete
- [x] Rename visual direction: header "Road Intelligence"
- [x] Two `AdvisorySourceCard`s (NHMP, PMD)
- [x] `TravelSnapshotCard` with warning state when closures active
- [x] Trip Insight as a calm glass card
- [x] Update all copy: "Recheck NHMP," "Based on latest advisories"
- [x] **Exit gate:** Travel screen reads as intelligence, not report

### Phase 6 — Planner (form) screen migration  ⚠️ Partial
- [x] Glass input cards for From/To/Add-stop
- [x] Vehicle chooser is glass-styled and wired, but the current options are `Car / EV / Motorbike` rather than the planned `Petrol / Diesel / EV`
- [ ] Priority chips: Safest / Fastest / Family / Scenic
- [x] POI layer toggles inside glass container
- [x] Bright cyan "Plan Smart Route" CTA with haptic
- [ ] **Exit gate:** form feels like a cockpit, not a web form

### Phase 7 — Route results  ⚠️ Partial
- [ ] `RouteOptionCard` trio: Fastest / Safest / Family-friendly (+ EV-friendly when vehicle=EV)
- [ ] Each card: duration, distance, risk score 0–100, advisory flag, recommendation chip
- [ ] Map panel sits behind floating glass filter controls (stretch goal)
- [ ] Bottom sheet: Route Intelligence summary
- [ ] **Exit gate:** route picker feels premium and decision-ready
- Reality check: `RouteOptionCard` exists, but `RoutePlannerScreen` is still rendering the older `RoutePlanCard` path rather than the final card trio described here.

### Phase 8 — Floating glass tab bar  ✅ Complete
- [x] Replace stock bottom tabs with `GlassTabBar`
- [x] Active pill with cyan tint, Ionicons, labels
- [x] Floats 18px above safe area, 20px horizontal margin
- [x] **Exit gate:** tabs feel Apple-native

### Phase 9 — Motion & polish
- [ ] Install `react-native-reanimated` (if not already)
- [ ] Card entrance: fade + 8px slide-up, 300ms, staggered 60ms
- [ ] Press scale 0.97 on cards, 0.95 on buttons (already done)
- [ ] Risk score count-up animation
- [ ] Audit all haptics — only CTAs, tab changes, toggles
- [ ] **Exit gate:** motion feels intentional, not decorative

### Phase 10 — Copy & safety wording pass
- [ ] Replace any "safe" / "no danger" / "guaranteed" wording
- [ ] Add "Based on latest available advisories" footer on advisory views
- [ ] Add "Conditions may change. Recheck before departure." on route results
- [ ] **Exit gate:** App Store review-safe language everywhere

### Phase 11 — Device test & EAS build
- [ ] `eas build --profile development --platform ios`
- [ ] Install on physical iPhone, test all flows
- [ ] Profile perf (focus: Home screen scroll, POI layer toggles, map render)
- [ ] Dark mode only — confirm no light-theme remnants broken
- [ ] Contrast check (WCAG AA on all text over glass)
- [ ] **Exit gate:** ready for TestFlight

### Phase 12 — Deferred
- [ ] TypeScript migration (separate project)
- [ ] WeatherKit integration (separate project — see earlier WEATHERKIT notes)
- [ ] StoreKit 2 subscriptions (separate project)

---

## Component API contracts (short)

```jsx
<ScreenGradient withBlobs>{children}</ScreenGradient>

<GlassCard strong elevated onPress? hapticStyle?>...</GlassCard>

<GlassPill label icon onPress? active? />

<GlassButton
  label icon onPress
  variant="glass" | "primary" | "ghost"
  size="sm" | "md" | "lg"
  active loading disabled
/>

<GlassTabBar items={[{key,label,icon}]} activeKey onChange floating />

<LiveConditionsCard city weather temp aqi wind humidity pm25 />
<OutdoorDecisionCard status="go"|"caution"|"danger" title body />
<TravelSnapshotCard level alerts clear pmd closures />
<AdvisorySourceCard name metric subtitle onPress />
<RouteOptionCard
  label="Fastest"|"Safest"|"Family"
  duration distance riskScore advisory recommendation onPress
/>
```

---

## Safety wording lexicon (use these phrases verbatim)

**Approved:**
- "Go with care"
- "High travel caution"
- "Recheck NHMP before departure"
- "Based on latest available advisories"
- "Conditions may change"
- "Recommended"
- "Avoid if possible"
- "Official source"

**Forbidden:**
- "Safe" / "This route is safe"
- "No danger"
- "Guaranteed"
- "Risk-free"

---

## Progress log

| Date       | Phase | Status        | Notes |
|------------|-------|---------------|-------|
| 2026-04-18 | 0     | ✅ Complete    | Installed expo-haptics, expo-linear-gradient, expo-glass-effect, @expo/vector-icons, react-native-reanimated (worklets 0.7.0 pinned). Created `src/design/` tokens (colors, typography, spacing, shadows). Palette aligned to spec (#071523 → #102B3D → #173E4A). |
| 2026-04-18 | 1     | ✅ Complete    | Moved glass primitives into `components/glass/` with barrel export. Added `GlassPill` and `LiquidGlassView` (native on iOS 26+, BlurView fallback). Renamed `ScreenBackground` → `ScreenGradient` in `components/layout/`. GlassCard haptics now opt-in. Preview screen rewritten with new imports. |
| 2026-04-18 | 2     | ✅ Complete    | Added `src/components/Icon.js` — Ionicons wrapper with `ICON` name constants. Swapped emoji tab icons in `App.js` for Ionicons (home/navigate/map/fitness/sparkles/settings outline). Removed emoji from GlassPreviewScreen's pills, tab bar, and semantic card headings. |
| 2026-04-18 | 3     | ✅ Complete    | All 5 domain cards built in `components/cards/` using `GlassCard` and design tokens. Migrated `AlertsScreen` and `RoutePlannerScreen` from retired `LiquidGlassCard` → `GlassCard`. Deleted `components/LiquidGlassCard.js`. |
| 2026-04-18 | 4     | ✅ Complete    | HomeScreen wrapped in `ScreenGradient`. Glass pill header (location + settings). `LiveConditionsCard` replaces `AQIHeroCard` in aqi section. `OutdoorDecisionCard` + `GlassCard` replace flat decision/AI cards. Helpers: `getWeatherIcon`, `getAqiCategory`, `decisionStatus`. |
| 2026-04-18 | 5     | ✅ Complete    | TravelScreen fully migrated to glass design system. `ScreenGradient` wrapper, all `useTheme()` colors replaced with design tokens, `AdvisorySourceCard` pair for NHMP/PMD, `TravelSnapshotCard` for snapshot, `GlassCard` for all section/route/AI cards, `StopRow` uses token colors. Fixed "dark text" issue throughout. Reverse geocoder now returns city name only (no neighborhood prefix like "Union Square"). |
| 2026-04-18 | 6     | ⚠️ Partial     | Planner shell is migrated to the new system: `ScreenGradient`, glass selector card, vehicle chooser, POI toggles, and cyan `Plan Smart Route` CTA are live. Priority chips from the blueprint are not implemented yet, and the vehicle model differs from the original Petrol/Diesel/EV plan. |
| 2026-04-18 | 7     | ⚠️ Partial     | `RouteOptionCard` exists in `components/cards/`, but the planner still renders the older `RoutePlanCard` path instead of the final Fastest / Safest / Family-friendly result trio. Route-results architecture is therefore only partially migrated. |
| 2026-04-18 | 8     | ✅ Complete    | `App.js` now uses `GlassTabBar` with Ionicons and safe-area-aware floating placement. The stock bottom tab bar has been replaced. |
| 2026-04-18 | Audit | ✅ Synced      | Blueprint statuses updated to match the repo reality after Claude handoff review: phases 0–5 complete, 6–7 partial, 8 complete. |

---

## Anti-patterns to avoid (learned from Phase 0)

- ❌ Default haptics on every pressable card (overwhelming)
- ❌ Emoji icons in primary navigation
- ❌ Duplicate glass wrappers (`LiquidGlassCard` + `GlassCard` — consolidate!)
- ❌ Inline `rgba()` colors in screen files — always import from `design/colors.js`
- ❌ Bouncy springs on list items (performance + feels childish)
- ❌ Blurring text backgrounds (readability killer)
