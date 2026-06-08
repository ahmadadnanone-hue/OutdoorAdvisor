# OutdoorAdvisor Next Release Metadata Draft

Prepared: 2026-06-09

This is a draft pack for the next App Store Connect review. Do not paste or submit until Ahmed approves the final positioning.

## Screenshot Assets

Apple's current screenshot specs accept 1-10 `.jpeg`, `.jpg`, or `.png` screenshots. For iPhone, the large 6.9-inch slot accepts `1290 x 2796` portrait screenshots; App Store Connect can scale high-resolution screenshots down for smaller iPhone sizes when the UI is the same.

Prepared iPhone 6.9-inch portrait screenshots:

1. `assets/appstore-screenshots/release-2026-06-light/iphone-6.9-1290x2796/04_home_live_conditions.png`
2. `assets/appstore-screenshots/release-2026-06-light/iphone-6.9-1290x2796/01_activities.png`
3. `assets/appstore-screenshots/release-2026-06-light/iphone-6.9-1290x2796/02_travel_tourist_stations.png`
4. `assets/appstore-screenshots/release-2026-06-light/iphone-6.9-1290x2796/03_travel_official_sources.png`

Recommended upload order:

1. Home / Outdoor Brief
   - Shows the new light daytime look, AI Outdoor Brief, weather alert, Health & Outdoor Score, and live conditions.
   - Suggested marketing line if we later add framed captions: `AQI, heat and weather guidance for Pakistan`

2. Activities
   - Shows activity scoring and the best outdoor options for Lahore conditions.
   - Suggested marketing line: `Know which outdoor plans work today`

3. Travel Tourist Stations
   - Shows tourist stations prioritized by advisory intensity and PMD-style weather context.
   - Suggested marketing line: `Tourist stations and mountain-route weather`

4. Official Sources
   - Shows NHMP, PMD, and NDMA sources, national watch items, and weather alert details.
   - Suggested marketing line: `PMD, NDMA and motorway advisories in one place`

Pending screenshot recommendation:

- Capture one Settings/About privacy screenshot if Apple asks for more than four screenshots or if we want a privacy/trust screenshot.
- If App Store Connect requires iPad screenshots for this version, use true iPad captures or keep the existing approved iPad assets. Do not stretch these iPhone shots into iPad format.

## App Store Connect Copy

### App Name

OutdoorAdvisor: AQI & Smog

### Subtitle

Pakistan Weather & Travel

### Promotional Text

Smog or heatwave today? Check air quality, weather, pollen, UV and live Pakistan motorway advisories — and find the best window for a walk, run, or road trip.

### Description

Keep unchanged from the current live listing. Use the exact Description from `APP_STORE_METADATA.md`.

### Keywords

air,quality,pollen,allergy,forecast,UV,Lahore,Islamabad,Karachi,Murree,motorway,fog,traffic,heat

### What's New

This update improves OutdoorAdvisor's appearance, alerts, travel awareness, and account experience.

- New daytime Light theme with improved readability
- Original Dark theme preserved
- Official-source view for NHMP, PMD, and NDMA advisories
- Tourist stations prioritize important alerts first
- Clearer summaries for rain, heat, flood, GLOF, and road warnings
- Improved sign-in, email-code verification, and password recovery
- Sign in with Apple
- Improved wind and thunderstorm alerts

### App Review Notes

Keep unchanged from the previous version unless Apple asks for updated review instructions. Use the exact App Review Notes from `APP_STORE_METADATA.md`.

### TestFlight What To Test

Please test the current OutdoorAdvisor flow on a physical iPhone:

- Home screen light theme, Outdoor Brief, weather alerts, and Live Conditions
- Premium AI / rule-based briefing behavior
- Activity scoring and ranking in the Outdoors tab
- Travel screen official sources: NHMP, PMD, and NDMA
- Tourist stations ordering by important advisories first
- Motorway and weather-alert detail expansion
- Apple In-App Purchase subscription and restore purchases
- Settings appearance picker, notification preferences, About, privacy, and support links
- Health permission flow and Health & Outdoor Score display if comfortable granting Health access

Known note: weather, advisory, and route information is for general planning context only and should not be used for emergency or safety-critical decisions.

## App Store Connect Checklist

- Screenshots uploaded in order above for the iPhone 6.9-inch slot.
- Existing iPad screenshots kept, or true iPad screenshots captured if App Store Connect requests replacement.
- App name, subtitle, promotional text, description, keywords, What's New, and review notes pasted.
- Support URL: `https://outdooradvisor.app`
- Marketing URL: `https://outdooradvisor.app`
- Privacy Policy URL: `https://outdooradvisor.app/privacy`
- Primary category: Weather
- Secondary category: Health & Fitness
- Export compliance: standard HTTPS/encryption only, consistent with `ITSAppUsesNonExemptEncryption=false`.
- Build selected only after Ahmed confirms the build/version to submit.
