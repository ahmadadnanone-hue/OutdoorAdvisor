# OutdoorAdvisor App Store Submission Pack

Last updated: 2026-04-27

This file is the reusable paste-ready source for App Store Connect, TestFlight, review notes, screenshot planning, and later public-release polish.

## Current Release State

- Latest checked iOS build: build version `18`
- EAS build ID: `5c774f86-e9c7-4c99-a1f1-86dedd95379c`
- Status: `FINISHED`
- Distribution: `STORE`
- Built from commit: `be00c29`
- Privacy URL live: `https://outdooradvisor.app/privacy`
- Support URL: `https://outdooradvisor.app`
- Marketing URL: `https://outdooradvisor.app`
- WeatherKit: server-side Vercel proxy is live, with Open-Meteo fallback
- Premium: currently allowlist/tester based, not StoreKit
- TestFlight submission note: build `18` is already uploaded and visible in App Store Connect. If the Apple UI says `Ready to Submit`, click build `18` and submit it for Beta App Review / external testing; do not keep rerunning EAS upload unless a new IPA is needed.
- EAS CLI note: setting `What To Test` through `--what-to-test` is Expo Enterprise-only. Paste the `TestFlight What To Test` section below manually in App Store Connect if needed.

## App Store Connect Fields

### App Name

OutdoorAdvisor

### Subtitle

Weather, AQI and road guidance

Character count: 30 / 30

### Promotional Text

Plan your day outside with a calm read on weather, air quality, pollen, and Pakistan travel advisories.

Character count: 105 / 170

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

OutdoorAdvisor is not a generic weather app. It is designed to help you make calmer, more practical outdoor decisions.

Important: Weather, air quality, pollen, and road-condition data is provided for general information only. Do not use OutdoorAdvisor for emergency, aviation, mountaineering, evacuation, flood, landslide, or other safety-critical decisions. Always consult official government and emergency sources for high-risk situations.

### Keywords

weather,AQI,smog,Pakistan,Lahore,Islamabad,Karachi,Murree,travel,motorway,PMD,NHMP,pollen

Character count: 89 / 100

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

Premium functionality is currently limited during TestFlight and may be enabled for allowlisted tester accounts. If a reviewer needs a premium-enabled account or a specific test account, please contact support@outdooradvisor.app.

The app may request location permission to show local weather, air quality, and travel context. If Health access is granted, the app reads step count, walking/running distance, and active energy to support optional smart movement nudges. Health data is not sold, not used for advertising, and not written back to Apple Health.

## TestFlight What To Test

Please test the core OutdoorAdvisor flow on iPhone:

- Home screen weather, AQI, and outdoor decision guidance
- AI / rule-based briefing card behavior
- Quick Action Button customization from Settings
- Refresh and AI brief premium/rate-limit handling
- Travel screen advisory cards and PMD/NHMP source links
- Activities scoring and nearby place behavior
- Settings, notifications, About, privacy, and support/contact links
- Health permission flow and Health & Outdoor Score display if you are comfortable granting Health access

Known testing note: premium and subscription behavior is currently allowlist-based during TestFlight.

## TestFlight Build 18 Submission Steps

Use this when build `18` is visible in App Store Connect but still says `Ready to Submit`:

1. Open App Store Connect -> OutdoorAdvisor -> TestFlight -> iOS Builds.
2. Click build `18`.
3. Add it to the external testing group if needed (the prior submitted build showed group `BT`; internal groups `FF` and `TE` are not enough for Beta App Review).
4. Paste the `TestFlight What To Test` text above.
5. If export compliance appears, answer that the app uses standard encryption/HTTPS only and no non-exempt encryption.
6. Click `Submit for Review` / `Submit to Beta App Review`.
7. Expected result: build `18` should change from `Ready to Submit` to `Waiting for Review`, matching the previous build `14` state.

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
- In-App Purchases: No for the current allowlist/TestFlight build; change to Yes only when StoreKit/subscriptions are implemented.
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

Recommended order:

1. Home / Outdoor Decision
   Caption: Know what outside means today
   Capture: Home screen showing live conditions, AQI, and the outdoor decision card.

2. AI / What Today Means
   Caption: A calmer read on weather and air
   Capture: Home screen with the AI or rule-based briefing card visible.

3. Activities
   Caption: Pick the right activity window
   Capture: Activities screen showing ranked activity scores.

4. Travel
   Caption: Check road and weather context
   Capture: Travel screen showing Road Intelligence, NHMP/PMD source cards, or route cards.

5. Quick Action Button
   Caption: Keep your fastest actions close
   Capture: Settings → Customize → Quick Action Button section.

6. Privacy / About
   Caption: Built with privacy in mind
   Capture: About screen showing privacy/support/contact surfaces.

Screenshot capture tips:

- Use a real-looking Pakistan city/location, preferably Lahore or Islamabad.
- Avoid showing impossible, broken, or empty states.
- Avoid showing premium-locked UI as the primary screenshot until StoreKit is implemented.
- Avoid screenshots with debug/dev messages.
- Keep status bar and bottom safe area visually clean.

## Premium / Review-Risk Recommendation

Current risk:

Premium is still allowlist-based and StoreKit subscriptions are not implemented. If public App Review sees visible premium promises, locked paid features, or upgrade language without in-app purchases, Apple may ask for StoreKit or reject the binary.

Recommended path for TestFlight:

- Keep current allowlist behavior acceptable for internal/external TestFlight testing.
- In review notes, say premium functionality is limited during TestFlight and reviewer access can be provided on request.

Recommended path before public App Store review:

- Either hide/reframe premium surfaces as "Preview", "Experimental", or "Tester access" until StoreKit is ready, or implement StoreKit subscriptions before public submission.
- Avoid language that implies users can purchase premium if no purchase flow exists.
- Do not make premium screenshots part of the first App Store screenshot set until StoreKit is live.

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
