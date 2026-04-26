# OutdoorAdvisor — iOS App Store Launch Checklist

Track progress here. Check off each item as it is completed.
Items marked **[CODE]** require changes in this repo; all others are done in Apple portals or terminals.

---

## Phase 1 — Apple Developer Portal Setup
_developer.apple.com → Certificates, IDs & Profiles_

- [ ] Sign the Apple Developer Program License Agreement
- [ ] Create a Bundle ID (App ID) — e.g. `com.outdooradvisor.app`
  - Enable **Push Notifications** capability on the App ID
  - Enable **Associated Domains** if you plan to support universal links later
- [ ] Create an APNs Auth Key (`.p8` file)
  - Go to **Keys → +** → enable Apple Push Notifications service (APNs)
  - Download the `.p8` file and note the **Key ID** and **Team ID** — you need these for EAS
- [ ] Create or download a **Distribution Certificate** (EAS can auto-manage this; skip if using EAS managed credentials)
- [ ] Register at least one test device UDID (for TestFlight internal testing)

---

## Phase 2 — App Store Connect Setup
_appstoreconnect.apple.com_

- [ ] Create a new App record
  - **Name:** OutdoorAdvisor
  - **Primary language:** English (or your target locale)
  - **Bundle ID:** must match the one created in Phase 1
  - **SKU:** any unique string, e.g. `outdooradvisor-1`
- [ ] Complete **App Information**
  - Subtitle (optional, ≤30 chars) — e.g. "Air · Weather · Activities"
  - Category: **Weather** (primary) / **Health & Fitness** (secondary)
  - Content rights declaration
- [ ] Add a **Privacy Policy URL** — required before submission
- [ ] Complete the **Age Rating** questionnaire (no mature content → 4+)
- [ ] Set **Pricing & Availability** (free or paid tier)
- [ ] Fill in **App Store Listing** text (can be done now or in Phase 6)

---

## Phase 3 — Code & Build Configuration
_All changes go in this repo_

- [ ] **[CODE]** Add `bundleIdentifier` to `app.json` iOS block:
  ```json
  "ios": {
    "bundleIdentifier": "com.outdooradvisor.app",
    "buildNumber": "1",
    "supportsTablet": true,
    ...
  }
  ```
- [ ] **[CODE]** Add `googleMapsApiKey` to `app.json` iOS block (needed for `react-native-maps` on iOS):
  ```json
  "ios": {
    "config": {
      "googleMapsApiKey": "YOUR_IOS_GOOGLE_MAPS_API_KEY"
    }
  }
  ```
- [ ] **[CODE]** Add background notification mode to `app.json` iOS `infoPlist`:
  ```json
  "UIBackgroundModes": ["remote-notification"]
  ```
- [ ] Install EAS CLI globally: `npm install -g eas-cli`
- [ ] Log in: `eas login`
- [ ] Run `eas init` in the project root — links the project to your Expo account
- [ ] **[CODE]** Create `eas.json` with a production profile (file will be created automatically; verify it looks like):
  ```json
  {
    "cli": { "version": ">= 12.0.0" },
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal"
      },
      "preview": {
        "distribution": "internal"
      },
      "production": {
        "autoIncrement": true
      }
    },
    "submit": {
      "production": {}
    }
  }
  ```
- [ ] Configure APNs push key in EAS:
  ```
  eas credentials --platform ios
  ```
  → Push Notifications → Add APNs Key → paste Key ID, Team ID, upload `.p8`
- [ ] Verify all environment variables / secrets are set in EAS dashboard (Supabase URL, Anon Key, Google API keys, etc.)

---

## Phase 4 — Screenshots & App Store Assets

Required screenshot sizes (at least one set is mandatory):

- [ ] **iPhone 6.9"** — 1320 × 2868 px (iPhone 16 Pro Max) ← Apple's required size
- [ ] **iPhone 6.7"** — 1290 × 2796 px (iPhone 15 Plus / 14 Plus)
- [ ] **iPad Pro 13"** — 2064 × 2752 px ← required because `supportsTablet: true`
- [ ] **iPad Pro 12.9" (2nd/3rd gen)** — 2048 × 2732 px

Recommended shots for OutdoorAdvisor:
1. Home screen with AQI hero card (clean/good air day)
2. Home screen with smog conditions (shows warnings)
3. Activities screen grid
4. Activity detail modal (Outdoor Dining with an advisory visible)
5. Travel screen / Map screen

- [ ] App icon confirmed at all sizes (already done in earlier commit)
- [ ] App preview video (optional but boosts conversion)

---

## Phase 5 — Build & TestFlight

- [ ] Run production build:
  ```
  eas build --platform ios --profile production
  ```
- [ ] Submit build directly to App Store Connect:
  ```
  eas submit --platform ios --latest
  ```
  _Or download the `.ipa` and upload via **Transporter** (Mac app)._
- [ ] In App Store Connect → TestFlight → confirm build is **ready to test**
- [ ] Add internal testers (your Apple ID + team)
- [ ] Install via TestFlight on a real device and test:
  - [ ] Location permission prompt appears and works
  - [ ] AQI / weather data loads correctly
  - [ ] Push notification permission prompt appears
  - [ ] Test notification fires (use `/api/notifications/send-test`)
  - [ ] Premium features visible for allowlisted accounts
  - [ ] Dark mode / light mode toggle
  - [ ] Outdoor Dining advisory banners show under hot / cold / smoggy conditions
  - [ ] Maps screen loads with correct region
  - [ ] App works on iPad (supportsTablet)

---

## Phase 6 — App Store Listing Copy

- [ ] **App Description** (up to 4000 chars) — describe AQI, weather, activities, and travel features
- [ ] **Promotional Text** (≤170 chars) — this can be updated at any time without a new build
- [ ] **Keywords** (≤100 chars total, comma-separated) — e.g.:
  `air quality,AQI,weather,smog,outdoor,activities,pollen,Pakistan`
- [ ] **Support URL** — a webpage or email link for user support
- [ ] **Marketing URL** (optional)
- [ ] **What's New** text for version 1.0 — e.g. "Initial release"

---

## Phase 7 — App Review Submission

- [ ] In App Store Connect, select the build from Phase 5
- [ ] Complete **App Review Information**:
  - Demo account email + password (so reviewer can log in and see premium features)
  - Notes: explain location usage, AQI data source, no user-generated content
  - Contact phone and email
- [ ] **Export Compliance**: answer encryption questions
  - This app uses HTTPS (standard encryption) → select "No" for custom encryption
- [ ] Review all metadata one final time
- [ ] Click **Submit for Review**
- [ ] Monitor review status — typical turnaround: 24–48 hours
- [ ] Respond promptly to any **Reviewer Feedback** (metadata rejection or binary rejection)

---

## Phase 8 — Post-Launch

- [ ] Confirm app is live on the App Store
- [ ] Share App Store link with users
- [ ] Monitor **Crashes** in App Store Connect → Xcode Organizer or Expo dashboard
- [ ] Monitor **Ratings & Reviews** — respond to early reviews
- [ ] Plan **v1.1** patch for any bugs surfaced after launch
- [ ] Consider submitting the Android version to Google Play (most config is already in place)

---

## Quick Reference

| Item | Value |
|---|---|
| App name | OutdoorAdvisor |
| Expo slug | OutdoorAdvisor |
| Bundle ID (to set) | `com.outdooradvisor.app` |
| Version | 1.0.0 |
| Build number | 1 |
| Min iOS target | 16.0 (Expo 55 default) |
| Tablet support | Yes |
| Push notifications | Yes (APNs key needed) |
| Location | When In Use only |
| Encryption | Standard HTTPS only |
