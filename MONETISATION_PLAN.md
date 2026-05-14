# OutdoorAdvisor Pakistan — Monetisation & Business Plan

> Version 1.0 — May 2026  
> Prepared for internal use, investor reference, and Apple App Review submission context.

---

## 1. Executive Summary

OutdoorAdvisor Pakistan is the only app purpose-built for Pakistan's outdoor conditions — combining real-time AQI, weather, pollen, road advisories (NHMP/NDMA), and Gemini AI synthesis into a single daily-driver. It targets urban commuters, parents, highway travellers, and outdoor enthusiasts across Pakistan's major cities.

Monetisation is freemium: the core app is free forever, every new install receives a 7-day full-feature trial, and continued access to premium features requires a low-cost subscription priced for the Pakistani market.

---

## 2. Product Tiers

| Feature | Free | Trial (7 days) | Premium |
|---|:---:|:---:|:---:|
| Live AQI + weather | ✅ | ✅ | ✅ |
| Outdoor Decision card | ✅ | ✅ | ✅ |
| Basic activity scores | ✅ | ✅ | ✅ |
| Road advisories (NHMP/NDMA) | ✅ | ✅ | ✅ |
| AI Outdoor Brief (Gemini) | ❌ | ✅ | ✅ |
| Pollen section | ❌ | ✅ | ✅ |
| Wind detail section | ❌ | ✅ | ✅ |
| 7-day + hourly forecast | ❌ | ✅ | ✅ |
| Health stats (HealthKit) | ❌ | ✅ | ✅ |
| Smart push notifications | ❌ | ✅ | ✅ |
| Motorway route alerts | ❌ | ✅ | ✅ |
| Travel AI insight | ❌ | ✅ | ✅ |
| Custom alert thresholds | ❌ | ✅ | ✅ |
| Home section customisation | ❌ | ✅ | ✅ |

### Trial mechanics
- Trial starts on first app launch — stored locally via `outdooradvisor_trial_v1` in AsyncStorage
- Duration: 7 days from first launch
- No credit card required — fully device-based, no sign-in needed
- After expiry with no active subscription: user drops to free tier permanently
- Trial does not restart on reinstall (keyed to device, not Apple ID) — prevents abuse

---

## 3. Pricing

### Subscription Plans

| Plan | Pakistan | International |
|---|---|---|
| Free | PKR 0 / forever | USD 0 / forever |
| Premium Monthly | **PKR 300 / month** | **USD 3 / month** |
| Premium Annual | **PKR 2,400 / year** | **USD 24 / year** |

### Annual Savings
- Annual plan = 33% saving vs monthly (8 months paid, 4 months free)
- Industry standard discount — significantly reduces monthly churn

### Pricing Rationale

**PKR 300/month (Pakistan)**
- Equivalent to a single fast-food meal or one cup of specialty coffee in Lahore/Karachi
- Below the psychological "expensive app" ceiling for Pakistani consumers
- Comparable to Netflix Pakistan (PKR 250–450/mo) which users already accept
- Accessible to students, young professionals, and middle-income households
- At 15% Apple developer rate: net ~PKR 255/month per subscriber

**USD 3/month (International)**
- Targets Pakistani diaspora in UAE, UK, USA, Saudi Arabia, Canada, Australia
- Significantly below global weather app competitors:
  - Dark Sky was USD 4/year (now Apple Weather, free)
  - Carrot Weather: USD 5/month
  - Weather Pro: USD 3.99/month
  - IQAir Premium: USD 8/month
- Positions as the affordable specialist for South Asian weather/AQI needs
- At 15% Apple developer rate: net ~USD 2.55/month per subscriber

---

## 4. Competitive Landscape

| App | Monthly Price | Pakistan AQI | Road Data | AI Synthesis |
|---|---|:---:|:---:|:---:|
| AccuWeather | Free / USD 5 | ❌ | ❌ | ❌ |
| Carrot Weather | USD 5 | ❌ | ❌ | ❌ |
| IQAir | Free / USD 8 | Basic | ❌ | ❌ |
| The Weather Channel | Free / USD 2 | ❌ | ❌ | ❌ |
| PMD (Pakistan Met) | Free | ❌ | ❌ | ❌ |
| AQI Pakistan (web) | Free | Basic | ❌ | ❌ |
| **OutdoorAdvisor PK** | **Free / PKR 300** | **✅ Hyperlocal** | **✅ NHMP/NDMA** | **✅ Gemini** |

**Moat:** No direct competitor combines Pakistan-specific AQI + weather + road intelligence + AI outdoor guidance in a single native iOS app. This is the core defensible position.

---

## 5. Revenue Projections

### Conservative Scenario

| Period | Monthly Active Users | Conversion Rate | Paying Subs | Monthly Net Revenue |
|---|---|---|---|---|
| Month 3 (launch) | 500 | 5% | 25 | PKR 6,375 (~USD 23) |
| Month 6 | 2,000 | 6% | 120 | PKR 30,600 (~USD 110) |
| Month 12 | 10,000 | 8% | 800 | PKR 204,000 (~USD 730) |
| Year 2 | 50,000 | 10% | 5,000 | PKR 1,275,000 (~USD 4,570) |

*Figures are after Apple's 15% small developer commission.*

### Seasonal multiplier
Pakistan's smog season (October–January) naturally spikes AQI-related app installs and trial starts. Annual revenue will be heavily weighted toward Q4/Q1. Marketing spend and feature launches should align with smog season onset.

### Annual plan uplift
If 30% of subscribers choose the annual plan:
- Reduces effective churn from ~8%/mo to ~3%/mo
- Improves 12-month LTV by ~60%
- Provides predictable cash flow for server/API cost planning

---

## 6. Cost Structure

### Monthly Operating Costs (estimated at 10,000 MAU)

| Item | Est. Monthly Cost |
|---|---|
| Vercel (API hosting, Hobby→Pro as needed) | USD 20–40 |
| Gemini API (AI briefings, ~0.5M tokens/mo) | USD 5–15 |
| AQICN API (paid tier if needed) | USD 0–30 |
| WeatherKit (Apple, included with Dev Program) | USD 0 |
| Supabase (auth + optional sync, free tier) | USD 0 |
| Apple Developer Program (annual) | USD 99/yr (~USD 8/mo) |
| EAS Production (Expo builds + OTA) | USD 19/mo |
| **Total** | **~USD 52–112/mo** |

At 800 subscribers (Month 12 projection), monthly net revenue is ~USD 730 against ~USD 80 costs — **9:1 margin**.

---

## 7. Go-to-Market Strategy

### Phase 1 — Organic Launch (Now → Month 3)
- App Store optimisation: keywords "Pakistan weather", "Lahore AQI", "Karachi air quality", "outdoor Pakistan", "smog alert Pakistan"
- Smog season timing: target October for maximum organic installs
- Twitter/X: post daily AQI cards for Lahore/Karachi/Islamabad with app attribution during bad air days
- WhatsApp status sharing: shareable AQI snapshot image from the app

### Phase 2 — Content & Community (Month 2–6)
- Partner with Pakistani parenting/health accounts on Instagram (AQI + children's health angle is highly shareable)
- Collaborate with cycling and running communities in Lahore (Zwift Pakistan, Lahore Cycling Club)
- Local tech blogs/YouTube: product demo for Pakistani tech audience
- Feature: "Today's AQI in [City]" shareable card generated from within the app

### Phase 3 — B2B & Institutional (Month 6+)
- **Corporate wellness packages:** Bulk subscriptions for Lahore/Karachi corporate offices — pitch to HR departments as an employee wellness benefit during smog season
- **School alert service:** Notify parents when AQI crosses safe outdoor PE thresholds — institutional B2B pricing
- **NDMA/PMD integration visibility:** Position as the citizen-facing layer on top of official government data — potential grant or partnership angle

---

## 8. Implementation Roadmap (Technical)

The current app uses a device-based 7-day trial with email-allowlist premium. To charge real subscriptions, StoreKit 2 must be implemented.

### Required for live subscriptions
1. **App Store Connect:** Create subscription products
   - `pk.outdooradvisor.premium.monthly` — PKR 300/mo
   - `pk.outdooradvisor.premium.annual` — PKR 2,400/yr
   - `com.outdooradvisor.premium.monthly` — USD 3/mo
   - `com.outdooradvisor.premium.annual` — USD 24/yr
2. **StoreKit 2 integration** in the app:
   - Purchase flow (monthly/annual selection screen)
   - Receipt validation (server-side via Supabase function)
   - Entitlement grant — replaces current email-allowlist check in `src/lib/premium.js`
   - Restore purchases button (Apple requirement)
3. **Subscription management UI** in Settings → Account:
   - Show current plan, renewal date, manage/cancel link
4. **Legal copy update** in About tab:
   - Subscription terms, auto-renewal disclosure, cancellation instructions (Apple requirement)

### This requires a new native build (not OTA-shippable)
StoreKit is a native module. Plan for 2–3 days of development + one EAS build + App Store review cycle.

---

## 9. Apple App Review — Business Model Statement

Use this text in App Store Connect Review Notes when submitting:

> *OutdoorAdvisor Pakistan offers a permanently free tier with core weather and AQI features. Every new install receives a 7-day free trial with full premium access — no payment or sign-in required. After the trial period, users may subscribe to Premium at PKR 300/month or USD 3/month (local pricing varies by region) via in-app purchase to retain access to AI outdoor synthesis, pollen data, detailed forecasts, smart push notifications, and travel intelligence. No payment is ever required to use the core outdoor decision features, live conditions, or road advisories.*

---

## 10. Summary

| | |
|---|---|
| Free tier | Permanent, no expiry, core features |
| Trial | 7 days, full access, no card required |
| Premium Pakistan | PKR 300/mo or PKR 2,400/yr |
| Premium International | USD 3/mo or USD 24/yr |
| Apple cut | 30% yr 1, 15% yr 2+ (small developer) |
| Break-even | ~21 paying subscribers at current server costs |
| Next technical step | StoreKit 2 integration for live IAP |
| Key seasonal opportunity | Pakistan smog season Oct–Jan |
