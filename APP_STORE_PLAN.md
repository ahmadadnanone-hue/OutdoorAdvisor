# OutdoorAdvisor App Store Plan

This is the working checklist for converting OutdoorAdvisor from a web-first shipped product into a real iPhone App Store app.

## Current Repo Audit

The app already has a solid Expo / React Native base, but it is not App Store ready yet.

Important current gaps:

- native app identity has now been started in `app.json`, but still needs final App Store validation
- `eas.json` now exists, but App Store Connect submission values are still blank
- no App Store metadata workflow exists yet
- no privacy policy / terms URLs are present in the product flow
- premium is still custom allowlist logic, not real App Store subscriptions
- notifications are currently web-oriented and need a native iOS push path review
- app-store-specific legal / privacy / account deletion review has not been done

## Goal

Ship OutdoorAdvisor as a real iPhone app with:

- TestFlight distribution
- App Store submission
- real premium foundation
- native-quality icons, metadata, permissions, and privacy disclosures

## Phase 1: Native App Identity

- verify app config rename from `RouteAdvisor` to `OutdoorAdvisor`
- verify final `slug`
- verify `ios.bundleIdentifier`
- verify `ios.buildNumber`
- confirm final app icon, splash, accent colors, and app name

## Phase 2: Expo / EAS Setup

- verify `eas.json`
- configure production iOS build profile
- configure App Store Connect submission profile
- confirm Apple Developer account access
- connect credentials through EAS

## Phase 3: iPhone Product Hardening

- review all permissions text
- replace web-only assumptions with iOS-safe behavior
- review notifications for native iOS flow
- test sign-in on real iPhone
- verify location, weather, AQI, and premium gating work on device

## Phase 4: App Store Compliance

- add privacy policy URL
- add support URL
- prepare App Privacy disclosure answers
- review whether account deletion flow is required for the current auth setup
- review subscription and premium claims so they match actual purchase behavior

## Phase 5: Premium / Billing

- replace temporary premium allowlist logic with real entitlements
- add Apple in-app subscriptions if premium is sold inside the iPhone app
- sync subscription status back into auth / user profile state

## Phase 6: Store Submission Assets

- App Store title and subtitle
- keywords
- description
- screenshots for iPhone sizes
- app preview copy
- promotional text
- age rating answers

## Phase 7: Release Flow

- create internal iOS build
- test on device
- ship to TestFlight
- fix TestFlight issues
- submit for App Review

## Recommended Execution Order

1. Finalize app identity and native Expo config
2. Set up EAS build + TestFlight
3. Hardening pass for auth, notifications, privacy, and native behavior
4. Add real subscription / premium entitlements
5. Prepare App Store metadata and submit

## Notes

- Keep this file updated as App Store work starts
- When a phase is completed, mark it here
- Do not treat Vercel production readiness as equivalent to App Store readiness
