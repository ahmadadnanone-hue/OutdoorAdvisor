# OutdoorAdvisor Agent Notes

This file is the quick-start context for any agent working in this repo.
Update it whenever the product, workflow, or important assumptions change.

## Project

OutdoorAdvisor is a Pakistan-focused outdoor decision app built with Expo / React Native and deployed on Vercel.

Production site:
- `https://outdooradvisor.vercel.app`

Primary focus:
- outdoor decision guidance
- travel safety and route awareness
- activity suitability
- lightweight premium features

It is not meant to feel like a generic weather app.

## Current Product Areas

### Home
- Live conditions hero
- Outdoor decision card
- `What today means` summary card
- ranked activity advisory
- travel quick checks
- optional premium weather detail sections

### Travel
- National Highways & Motorway Police live advisories
- Pakistan Meteorological Department forecasts and alerts
- motorway and corridor route cards
- premium experimental route planner tab
- premium stop-by-stop route scan
- AI travel insight

### Activities
- ranked activity scores
- time-of-day aware scoring
- gym included as an activity
- nearby places integration is premium

### Settings
- thresholds
- notifications
- customize home layout
- about
- real Supabase auth UI

## Current Architecture

### Client
- Expo / React Native app with web export
- main screens live under `src/screens`
- hooks and data-fetch helpers under `src/hooks`, `src/utils`, and `src/config`

### Server Routes on Vercel
- Google weather, AQI, pollen, and geocode are proxied through Vercel API routes
- AI summaries are served through `/api/ai/briefing`
- NHMP and PMD are scraped/proxied through server routes

### AI
- Home and Travel use `src/hooks/useAiBriefing.js`
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
- some premium checks are UI-side and some are server-enforced
- known premium user allowlist exists for now as a temporary bridge before store subscriptions
- route planner is premium and experimental

## Important Current Truths

- GitHub remote is configured and working from this machine
- Vercel project is configured and linked from this machine
- production deploys have been triggered manually from this repo with `vercel deploy --prod --yes`
- do not assume Vercel is only relying on auto-deploy from GitHub; manual prod deploy has been the current workflow
- notifications, subscriptions, and privacy/legal hardening are not finished for full app-store readiness
- real App Store subscriptions are not implemented yet
- NHMP source is not an API; it is scraped from:
  - `https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx`

## NHMP Notes

- NHMP is flaky and sometimes returns an ASP.NET timeout/error page instead of real advisory HTML
- current fix lives in `api/nhmp.js`
- the route now rejects NHMP error pages instead of treating them like valid content
- there is also a fallback snapshot in `api/_data/nhmpFallback.js`
- Travel screen should prefer server data on web so browser-side direct fetch does not dominate/fail first

## UX Direction

- cleaner, calmer layout
- fewer always-open detail blocks
- use collapsible sections when data lists get too long
- keep weather detail secondary to decision-making
- avoid redundant location labels
- premium UI should feel subtle, not noisy

## Workflow Notes

- use `apply_patch` for manual file edits
- do not touch unrelated `.claude/worktrees/*` files
- especially ignore `.claude/worktrees/relaxed-solomon`
- after meaningful product changes:
  - build with `npx expo export -p web`
  - push to GitHub
  - deploy to production on Vercel
- for docs-only changes, build/deploy is optional

## Good First Checks Before Editing

1. Inspect `git status --short`
2. Confirm whether the change is user-facing or internal
3. Read the relevant screen or API route directly
4. Preserve recent UI tone and product direction
5. Update this file if the change materially affects future work

## Suggested Next Internal Updates

- keep this file current when premium rules change
- update it when auth, subscriptions, or app-store hardening starts
- update it when a new major route, AI behavior, or notification rule is added
