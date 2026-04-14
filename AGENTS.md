# RouteAdvisor Agent Notes

This file is the quick-start context for any agent working in this repo.
Update it whenever the product, workflow, or important assumptions change.

## Project

RouteAdvisor is a Pakistan-focused AI road trip planner built with Expo / React Native and deployed on Vercel.

Production site:
- `https://routeadvisor.vercel.app`

Primary focus:
- smart city-to-city route planning
- live road safety intelligence (NHMP, PMD, NDMA)
- roadside convenience (fuel, food, hotels, hospitals, EV chargers)
- AI-powered trip explanation and verdict

It is not a weather app or activity tracker. It answers: "which route is safer, smarter, and more convenient today?"

## Current Product Areas

### Plan (main tab)
- Multi-stop trip builder
- City-to-city route comparison
- Live NHMP and PMD advisory integration
- Stop-by-stop weather and AQI scan
- Route risk scoring

### Advisories
- National Highways & Motorway Police live advisories
- Pakistan Meteorological Department forecasts and alerts
- Motorway and corridor route cards
- AI travel insight

### Settings
- Units and wind unit preferences
- Notification preferences
- Theme toggle
- About

## Current Architecture

### Client
- Expo / React Native app with web export
- Main screens live under `src/screens`
- Hooks and data-fetch helpers under `src/hooks`, `src/utils`, and `src/config`

### Server Routes on Vercel
- Google weather, AQI, and geocode are proxied through Vercel API routes
- AI summaries are served through `/api/ai/briefing`
- NHMP and PMD are scraped/proxied through server routes

### AI
- AI briefings use `src/hooks/useAiBriefing.js`
- AI route supports Gemini
- server-side env var for Gemini must be `GEMINI_API_KEY`
- do not reuse the public Maps / Weather browser key for Gemini

### Auth
- Supabase auth is wired in
- auth is intended to stay optional for now
- current env vars:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Premium
- premium gating logic lives in `src/lib/premium.js`
- route planning is NOT premium gated (it's the core feature)
- premium features: AI briefings, push notifications, some alert types

## Important Current Truths

- Forked from OutdoorAdvisor codebase on the RouteAdvisor branch
- GitHub remote is configured and working from this machine
- Vercel project needs to be created and linked to routeadvisor.vercel.app
- production deploys triggered with `npx expo export -p web` then `vercel deploy --prod --yes`
- Expo / EAS login is configured on this machine
- EAS project has been created and linked for this repo
- iOS App Store / TestFlight work is blocked only by missing Apple Developer enrollment
- NHMP source is not an API; it is scraped from:
  - `https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx`

## Safety Language

All route verdicts and recommendations must use hedging language:
- "based on latest available advisory"
- "caution advised"
- "conditions may change"
- "verify before departure"

Never state a route is definitively "safe".

## UX Direction

- Clean, calm layout
- Route planning is the hero feature
- Safety intelligence is the differentiator
- Use collapsible sections for long data lists
- Premium UI should feel subtle, not noisy

## Workflow Notes

- after meaningful product changes:
  - build with `npx expo export -p web`
  - push to GitHub
  - deploy to production on Vercel
- for docs-only changes, build/deploy is optional
