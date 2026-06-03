# OutdoorAdvisor App Store Submission Pack

Last updated: 2026-06-03

This file is the reusable paste-ready source for App Store Connect, TestFlight, review notes, screenshot planning, and later public-release polish.

## Current Release State

- 🟢 **LIVE on the App Store** — version **1.0.4 / build `46`**, status `Ready for Distribution` (released 2026-06-03). App ID `6763982833`. Public listing: `https://apps.apple.com/us/app/id6763982833`.
- **ASO 1.0.4 shipped:** the optimized App Name / Subtitle / Keywords / Promotional Text / Description / What's New below are all **live**. EAS build `56ee5414` (1.0.4 / 46) was built from commit `b68afdf`, auto-submitted, attached to the version, and released through Apple review.
  - App Name: `OutdoorAdvisor: AQI & Smog` (was "OutdoorAdvisor Pakistan")
  - Subtitle: `Pakistan Weather & Travel` (was "Weather & Air for Pakistan")
  - Keywords: `air,quality,pollen,allergy,forecast,UV,Lahore,Islamabad,Karachi,Murree,motorway,fog,traffic,heat`
  - ⚠️ Build-version gotcha: a native `ios/` dir is present, so EAS reads `ios/OutdoorAdvisor/Info.plist` `CFBundleShortVersionString` (NOT `app.json`) for the marketing version — the first 1.0.4 build came out as 1.0.3 until the plist was bumped. Bump **both** `app.json` and the plist for the next release.
- Privacy URL live: `https://outdooradvisor.app/privacy` · Support/Marketing URL: `https://outdooradvisor.app`
- WeatherKit: server-side Vercel proxy live with Open-Meteo fallback.
- Premium: StoreKit auto-renewable subscriptions shipped in the live build; App Store Connect subscription products/offers depend on Apple processing.
- EAS CLI note: `What To Test` via `--what-to-test` is Expo Enterprise-only — paste the `TestFlight What To Test` section manually if needed. Build from a fresh clone (not the git worktree) per AGENTS.md.

## App Store Connect Fields

### App Name

OutdoorAdvisor: AQI & Smog

Character count: 26 / 30

> ASO note (2026-05-31): keyword-led title. Leads with brand `OutdoorAdvisor`, then the two highest-volume Pakistan search terms (`AQI`, `smog`) in the highest-weighted field. The display name in the App Store Connect app record may still read "OutdoorAdvisor Pakistan" (the original registered name); the **localizable App Name** on the version is what gets indexed and is set to the above. Geo term `Pakistan` is carried by the subtitle.
> Alternative (keep current): `OutdoorAdvisor Pakistan` — brand + geo, no extra keyword.

### Subtitle

Pakistan Weather & Travel

Character count: 25 / 30

### Promotional Text

Smog or heatwave today? Check air quality, weather, pollen, UV and live Pakistan motorway advisories — and find the best window for a walk, run, or road trip.

Character count: 160 / 170

> Promotional Text is editable on the live listing anytime with NO review. Refresh it seasonally (smog season ~Oct–Feb, heatwave ~Apr–Jun).

### Description

OutdoorAdvisor helps you decide what the conditions outside actually mean for your day.

Built for Pakistan, it combines weather, air quality, pollen, road advisories, and activity scoring into one practical outdoor guide. Check whether it is a good time for a walk, whether heat or smog should change your plan, or whether motorway and mountain-route conditions deserve a second look before you leave.

Features:

- Live weather and air-quality context
- Outdoor decision guidance in plain language
- Activity suitability scores for common outdoor plans
- Pakistan-focused travel and route awareness
- National Highways and Motorway Police advisory context
- Pakistan Meteorological Department forecast and alert links
- Optional Health-powered smart movement nudges on iPhone
- Privacy-first design with no advertising identifiers

OutdoorAdvisor is not a generic weather app. It is designed to help you make clearer, more practical outdoor decisions.

Important: Weather, air quality, pollen, and road-condition data is provided for general information only. Do not use OutdoorAdvisor for emergency, aviation, mountaineering, evacuation, flood, landslide, or other safety-critical decisions. Always consult official government and emergency sources for high-risk situations.

### Keywords

air,quality,pollen,allergy,forecast,UV,Lahore,Islamabad,Karachi,Murree,motorway,fog,traffic,heat

Character count: 96 / 100

> ASO note (2026-05-31): rewritten to remove words already covered by the title (`outdoor`, `advisor`, `aqi`, `smog`), subtitle (`pakistan`, `weather`, `travel`), and the Weather category — Apple forms compound queries across all fields, so duplicated words are wasted. Singular forms only (Apple auto-matches plurals). Dropped low-volume branded acronyms `PMD`/`NHMP` in favor of higher-volume `air`/`quality`/`allergy`/`forecast`/`UV`/`fog`/`traffic`/`heat`. Total unique indexed terms across title+subtitle+keywords: 21.

### Categories

Primary category: Weather

Secondary category: Health & Fitness

### URLs

Support URL:

https://outdooradvisor.app

Privacy Policy URL:

https://outdooradvisor.app/privacy

Marketing URL:

https://outdooradvisor.app

### Copyright

2026 Ahmad Adnan

## App Review Notes

OutdoorAdvisor provides general weather, air-quality, pollen, and travel-advisory context for Pakistan. It is not intended for emergency or safety-critical use.

WeatherKit is accessed through a server-side Vercel proxy. The app also has Open-Meteo fallback behavior if WeatherKit is unavailable.

OutdoorAdvisor Pakistan uses Apple In-App Purchase for premium subscriptions in this version.

Premium is available through two auto-renewable subscriptions in App Store Connect:
- Monthly: `com.ahmadadnanone.outdooradvisor.premium.monthly`
- Yearly: `com.ahmadadnanone.outdooradvisor.premium.yearly`

The monthly subscription should be priced at USD 0.99 internationally and PKR 99 in Pakistan. The yearly subscription should be priced as the best-value annual plan with one month free versus monthly pricing. Configure the monthly product with a 15-day introductory free trial. Configure the yearly product with a 1-month introductory free trial. Users must subscribe through Apple and have a payment method before the free trial starts. If a user does not subscribe, the app remains on the free tier: core weather, AQI, activity, and travel-advisory features stay available, while premium features such as AI briefings, detailed pollen/wind/forecast cards, experimental route planning, and advanced alerts remain locked.

Account deletion is available in-app. Sign in with the demo account, open Settings, open About, then use the visible Account Management card near the top of the page and tap Delete account. The app asks for confirmation before permanently deleting the account. A small footer link remains as a backup, but the primary delete control is now a full-width Account Management button for iPhone and iPad accessibility.

The app may request location permission to show local weather, air quality, and travel context. If Health access is granted, the app reads step count, walking/running distance, and active energy to support optional smart movement nudges. Health data is not sold, not used for advertising, and not written back to Apple Health.

## TestFlight What To Test

Please test the core OutdoorAdvisor flow on iPhone:

- Home screen weather, AQI, and outdoor decision guidance
- AI / rule-based briefing card behavior
- Apple In-App Purchase subscription flow and restore purchases
- Splash/launch transition without old icon flash
- Travel screen advisory cards and PMD/NHMP source links
- Wind, rain, thunderstorm, and AQI notification preferences
- Activities scoring and nearby place behavior
- Settings, notifications, About, privacy, and support/contact links
- Health permission flow and Health & Outdoor Score display if you are comfortable granting Health access

Known testing note: the next StoreKit build must be tested on a physical iOS device with sandbox subscriptions.

## TestFlight Build 19 Processing Steps

Use this after Apple finishes processing uploaded build `19`:

1. Open App Store Connect -> OutdoorAdvisor -> TestFlight -> iOS Builds.
2. Click build `19`.
3. Add it to internal groups and the external testing group if needed (prior submitted builds used internal groups `FF`/`TE`; external testing may require group `BT` plus Beta App Review).
4. Paste the `TestFlight What To Test` text above.
5. If export compliance appears, answer that the app uses standard encryption/HTTPS only and no non-exempt encryption.
6. Click `Submit for Review` / `Submit to Beta App Review`.
7. Expected result: build `19` should become available to internal testers after processing, and external testing should move to `Waiting for Review` if submitted for Beta App Review.

## Age Rating Answer Sheet

Suggested age rating: 4+

Use these answers unless the app content changes materially:

- Cartoon or Fantasy Violence: None
- Realistic Violence: None
- Prolonged Graphic or Sadistic Realistic Violence: None
- Profanity or Crude Humor: None
- Mature or Suggestive Themes: None
- Horror/Fear Themes: None
- Medical/Treatment Information: None
- Alcohol, Tobacco, Drug Use or References: None
- Simulated Gambling: None
- Sexual Content or Nudity: None
- Graphic Sexual Content and Nudity: None
- Contests: No
- Gambling: No
- Unrestricted Web Access: No
- User Generated Content or Social Networking: No
- Messaging and Chat: No
- Advertising: No
- In-App Purchases: Yes. OutdoorAdvisor Premium uses auto-renewable subscriptions through Apple In-App Purchase.
- Location: Yes, app uses location for weather, AQI, pollen, and travel context.
- Health or Fitness: Yes, optional Apple Health read access can support smart movement nudges.

Notes for reviewer-facing interpretation:

- OutdoorAdvisor gives general informational guidance, not medical advice.
- It does not diagnose, treat, prevent, or monitor medical conditions.
- It does not provide emergency alerts or safety-critical routing.

## Screenshot Plan

Required sizes:

- 6.7-inch iPhone screenshots
- 5.5-inch iPhone screenshots if App Store Connect requests them

Recommended order (captions are OCR-indexed by Apple in 2026 — keep them keyword-rich but natural):

1. Home / Outdoor Decision
   Caption: Air quality & weather — know what outside means today
   Capture: Home screen showing live conditions, AQI, and the outdoor decision card.

2. AI / What Today Means
   Caption: What today's smog, heat & AQI mean for your plans
   Capture: Home screen with the AI or rule-based briefing card visible.

3. Activities
   Caption: The best window to walk, run, or cycle
   Capture: Activities screen showing ranked activity scores.

4. Travel
   Caption: Pakistan motorway & road weather advisories
   Capture: Travel screen showing Road Intelligence, NHMP/PMD source cards, or route cards.

5. Forecast & Details
   Caption: 7-day forecast with pollen, UV & wind
   Capture: Home forecast strip / detail grid (avoid premium-locked empty states).

6. Privacy / About
   Caption: Private by design — no ad tracking
   Capture: About screen showing privacy/support/contact surfaces.

Screenshot capture tips:

- Use a real-looking Pakistan city/location, preferably Lahore or Islamabad.
- Avoid showing impossible, broken, or empty states.
- Avoid showing premium-locked UI as the primary screenshot until the StoreKit products are created and attached to the app version.
- Avoid screenshots with debug/dev messages.
- Keep status bar and bottom safe area visually clean.

## Premium / Review-Risk Recommendation

Current risk:

Premium is now intended to be backed by StoreKit. Do not submit the next binary until App Store Connect has the matching auto-renewable subscription products created, priced, localized, and selected for review.

Recommended path for TestFlight:

- Test subscriptions through Apple sandbox/TestFlight. Internal allowlist access may remain only for developer/admin accounts.

Recommended path before public App Store review:

- Create and attach the StoreKit subscriptions before public review.
- Use reviewer notes that state premium access is purchased only through Apple In-App Purchase.
- Do not make premium screenshots part of the first App Store screenshot set until StoreKit products are live in App Store Connect.

Preferred conservative choice:

For the first public review, hide or soften premium purchase language and keep the visible product focused on weather, AQI, activities, travel awareness, privacy, and Health-powered nudges.

## App Store Connect Checklist

- App name set to OutdoorAdvisor
- Subtitle pasted
- Promotional text pasted
- Description pasted
- Keywords pasted, under 100 characters
- Category set to Weather
- Secondary category set to Health & Fitness
- Support URL set to `https://outdooradvisor.app`
- Privacy URL set to `https://outdooradvisor.app/privacy`
- Marketing URL set to `https://outdooradvisor.app`
- Age rating questionnaire completed using answer sheet above
- Screenshots uploaded for required iPhone sizes
- Review notes pasted
- Build selected, preferably latest approved TestFlight/App Store candidate
- Export compliance answered consistently with `ITSAppUsesNonExemptEncryption: false`
- Submit for review only after premium positioning is decided
