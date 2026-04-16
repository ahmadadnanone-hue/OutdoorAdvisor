# OutdoorAdvisor Cross-Platform Agent README

This file is a follow-up guide for agents working on the main `OutdoorAdvisor` product.
Use it as a practical handoff note for web, mobile, iOS simulator, Vercel, and product continuity work.

Read this together with [AGENTS.md](/Users/ahmedadnan/OutdoorAdvisor-main/AGENTS.md).

## Repo Identity

- Main product repo/worktree for current work:
  - `/Users/ahmedadnan/OutdoorAdvisor-main`
- Primary branch for the main app:
  - `master`
- Main live site:
  - `https://outdooradvisor.vercel.app`

Important:
- `RouteAdvisor` is a separate offshoot and should not be mixed into the main app work unless explicitly requested.
- The offshoot worktree exists elsewhere and is intentionally separate from this one.

## Product Summary

OutdoorAdvisor is a Pakistan-focused decision app for outdoor planning.
It is not meant to behave like a generic weather app.

Core product pillars:
- today-level outdoor decision guidance
- travel safety awareness
- ranked activities
- optional premium detail layers

Main sections:
- `Home`
- `Travel`
- `Activities`
- `Settings`

## Technical Stack

- Expo / React Native
- Web export for Vercel deployment
- Vercel API routes for weather/AQI/pollen/geocode and AI summaries
- Supabase auth for optional sign-in
- Premium gating in app logic and partially on server routes

Key files and areas:
- main app entry:
  - [App.js](/Users/ahmedadnan/OutdoorAdvisor-main/App.js)
- screens:
  - [/Users/ahmedadnan/OutdoorAdvisor-main/src/screens](/Users/ahmedadnan/OutdoorAdvisor-main/src/screens)
- shared components:
  - [/Users/ahmedadnan/OutdoorAdvisor-main/src/components](/Users/ahmedadnan/OutdoorAdvisor-main/src/components)
- API routes:
  - [/Users/ahmedadnan/OutdoorAdvisor-main/api](/Users/ahmedadnan/OutdoorAdvisor-main/api)
- settings/auth/premium logic:
  - [/Users/ahmedadnan/OutdoorAdvisor-main/src/context](/Users/ahmedadnan/OutdoorAdvisor-main/src/context)
  - [/Users/ahmedadnan/OutdoorAdvisor-main/src/lib](/Users/ahmedadnan/OutdoorAdvisor-main/src/lib)

## Current Important Truths

- GitHub is configured and usable from this machine.
- Vercel is configured and deploys have been run manually from this machine.
- Production flow has not been purely "push to GitHub and wait"; manual Vercel deploy has been part of the real workflow.
- Supabase auth exists and is optional.
- Premium is not yet backed by real App Store subscriptions.
- NHMP is scraped from the public NHMP website and is not a real API.

## iOS / Simulator Notes

The main app now has local iOS simulator setup in this worktree.

Current local state:
- `node_modules` is installed
- `expo-dev-client` is installed
- local iOS project exists
- CocoaPods has been installed on this Mac

Important local files:
- [OutdoorAdvisor.xcworkspace](/Users/ahmedadnan/OutdoorAdvisor-main/ios/OutdoorAdvisor.xcworkspace)
- [OutdoorAdvisor.xcodeproj](/Users/ahmedadnan/OutdoorAdvisor-main/ios/OutdoorAdvisor.xcodeproj)

Prefer:
- open the workspace, not the project:
  - [OutdoorAdvisor.xcworkspace](/Users/ahmedadnan/OutdoorAdvisor-main/ios/OutdoorAdvisor.xcworkspace)

Useful commands:
```bash
cd /Users/ahmedadnan/OutdoorAdvisor-main
npm install
npx expo start --dev-client --reset-cache
npx expo run:ios
```

Current iOS runtime fixes already applied in this worktree:
- installed Expo-compatible native package versions
- fixed `AsyncStorage is null` by aligning package versions and reinstalling
- fixed weather animation runtime crashes caused by unsupported easing names

## Deployment Workflow

For meaningful user-facing changes:
```bash
cd /Users/ahmedadnan/OutdoorAdvisor-main
npx expo export -p web
vercel deploy --prod --yes
```

Also push to GitHub when the user wants source continuity.

For docs-only changes:
- build/deploy is optional

## Editing Rules

- Use `apply_patch` for manual edits.
- Do not touch unrelated `.claude/worktrees/*` files.
- Especially ignore:
  - `/Users/ahmedadnan/OutdoorAdvisor/.claude/worktrees/relaxed-solomon`
- Check `git status --short` before editing.
- Do not revert unrelated user changes.

## Product Direction Rules

- Keep the interface calmer and less cluttered.
- Avoid turning the app into a generic weather dashboard.
- Weather details should support decisions, not dominate the screen.
- Use collapsible sections when lists get too long.
- Premium UX should feel subtle, not noisy.
- When wording route/outdoor safety, avoid overclaiming certainty.

## Good Agent Follow-Up Checklist

1. Confirm you are in `/Users/ahmedadnan/OutdoorAdvisor-main`.
2. Confirm branch is `master` unless explicitly working elsewhere.
3. Read [AGENTS.md](/Users/ahmedadnan/OutdoorAdvisor-main/AGENTS.md).
4. Check `git status --short`.
5. Identify whether the request is:
   - web/product UI
   - API/reliability
   - auth/premium
   - iOS simulator/native setup
6. If user-facing, verify with build/run/deploy as appropriate.
7. Update this file or `AGENTS.md` when workflow assumptions materially change.

## When To Update This File

Update this file when:
- deployment flow changes
- iOS/TestFlight setup changes
- auth or premium model changes
- RouteAdvisor split changes
- new major product areas are added
- there is a new important runtime fix future agents should know
