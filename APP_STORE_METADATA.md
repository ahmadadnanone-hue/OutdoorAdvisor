# OutdoorAdvisor App Store Submission Pack

Last updated: 2026-05-26

This file is the reusable paste-ready source for App Store Connect, TestFlight, review notes, screenshot planning, and later public-release polish.

## Current Release State

- Latest checked iOS build in App Review: build version `41`
- EAS build ID: `97fbd02f-9fd6-4f9a-88ad-82b0b944b039`
- Status: App Store Connect submission is `Waiting for Review` as of 2026-05-25 3:25 PM PKT
- Distribution: `STORE`
- Build profile: `testflight-preview`
- Built from commit: `fa68022`
- Privacy URL live: `https://outdooradvisor.app/privacy`
- Support URL: `https://outdooradvisor.app`
- Marketing URL: `https://outdooradvisor.app`
- WeatherKit: server-side Vercel proxy is live with Open-Meteo fallback; latest smoke check saw Apple upstream return HTML `502 Bad Gateway`, and the proxy now reports that cleanly instead of throwing a generic 500
- Premium: StoreKit subscription implementation is now in progress. A new native build is required before this can be submitted because `expo-iap` adds native purchase code.
- TestFlight submission note: create App Store Connect subscription products before submitting the next StoreKit build.
- EAS CLI note: setting `What To Test` through `--what-to-test` is Expo Enterprise-only. Paste the `TestFlight What To Test` section below manually in App Store Connect if needed.

## App Store Connect Fields

### App Name

OutdoorAdvisor

### Subtitle

Weather, AQI and road guidance

Character count: 30 / 30

### Promotional Text

Plan your day outside with a practical read on weather, air quality, pollen, and Pakistan travel advisories.

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

OutdoorAdvisor is not a generic weather app. It is designed to help you make clearer, more practical outdoor decisions.

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

Recommended order:

1. Home / Outdoor Decision
   Caption: Know what outside means today
   Capture: Home screen showing live conditions, AQI, and the outdoor decision card.

2. AI / What Today Means
   Caption: A practical read on weather and air
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
