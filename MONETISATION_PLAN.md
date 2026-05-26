# OutdoorAdvisor Pakistan — Monetisation & Business Plan

> Version 1.0 — May 2026  
> Prepared for internal use, investor reference, and Apple App Review submission context.

---

## 1. Executive Summary

OutdoorAdvisor Pakistan is the only app purpose-built for Pakistan's outdoor conditions — combining real-time AQI, weather, pollen, road advisories (NHMP/NDMA), and Gemini AI synthesis into a single daily-driver. It targets urban commuters, parents, highway travellers, and outdoor enthusiasts across Pakistan's major cities.

Monetisation is freemium: the core app is free forever, and premium features require an Apple-managed auto-renewable subscription. The free trial starts only after the user subscribes through Apple with a payment method.

---

## 2. Product Tiers

| Feature | Free | StoreKit Trial | Premium |
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
- Trial starts only when the user subscribes through Apple In-App Purchase with a payment method.
- Monthly subscription: 15-day introductory free trial in App Store Connect.
- Yearly subscription: 1-month introductory free period in App Store Connect.
- Users who do not subscribe stay on the free tier.
- Apple manages trial eligibility, billing, renewal, cancellation, and restore behavior.

---

## 3. Pricing

### Subscription Plans

| Plan | Pakistan | International |
|---|---|---|
| Free | PKR 0 / forever | USD 0 / forever |
| Premium Monthly | **PKR 99 / month** | **USD 0.99 / month** |
| Premium Annual | **Best-value annual plan** | **Best-value annual plan** |

### Annual Savings
- Annual plan should include one month free versus monthly pricing.
- Exact localized yearly prices must be configured in App Store Connect price schedules.

### Pricing Rationale

**PKR 99/month (Pakistan)**
- Equivalent to a single fast-food meal or one cup of specialty coffee in Lahore/Karachi
- Below the psychological "expensive app" ceiling for Pakistani consumers
- Comparable to Netflix Pakistan (PKR 250–450/mo) which users already accept
- Accessible to students, young professionals, and middle-income households
- At 15% Apple developer rate: net ~PKR 255/month per subscriber

**USD 0.99/month (International)**
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

The current app has StoreKit client wiring through `expo-iap`. App Store Connect products and a new native build are still required.

### Required for live subscriptions
1. **App Store Connect:** Create subscription products
   - `com.ahmadadnanone.outdooradvisor.premium.monthly` — PKR 99 in Pakistan, USD 0.99 internationally, 15-day intro trial
   - `com.ahmadadnanone.outdooradvisor.premium.yearly` — annual best-value price, 1-month intro/free offer
2. **StoreKit 2 integration** in the app:
   - Purchase flow (monthly/annual selection screen)
   - Entitlement grant from StoreKit active subscription state, plus internal allowlist for admin/test users
   - Restore purchases button (Apple requirement)
3. **Subscription management UI** in Settings → Account:
   - Show current plan, renewal date, manage/cancel link
4. **Legal copy update** in About tab:
   - Subscription terms, auto-renewal disclosure, cancellation instructions (Apple requirement)

### This requires a new native build (not OTA-shippable)
StoreKit is a native module. This requires one EAS build and App Store review cycle; OTA cannot add the native module.

---

## 9. Apple App Review — Business Model Statement

Use this text in App Store Connect Review Notes when submitting:

> *OutdoorAdvisor Pakistan offers a permanently free tier with core weather, AQI, activity, and travel-advisory features. Premium features are available only through Apple In-App Purchase auto-renewable subscriptions. The monthly product `com.ahmadadnanone.outdooradvisor.premium.monthly` includes a 15-day introductory free trial and is priced at USD 0.99 internationally / PKR 99 in Pakistan. The yearly product `com.ahmadadnanone.outdooradvisor.premium.yearly` is the best-value annual plan with a 1-month introductory free period. Users who do not subscribe remain on the free tier. Apple manages trial eligibility, payment method, renewal, cancellation, and restore purchases.*

---

## 10. Summary

| | |
|---|---|
| Free tier | Permanent, no expiry, core features |
| Trial | Apple-managed intro offer after subscribe/payment method |
| Premium Pakistan | PKR 99/mo plus annual best-value plan |
| Premium International | USD 0.99/mo plus annual best-value plan |
| Apple cut | 30% yr 1, 15% yr 2+ (small developer) |
| Break-even | ~21 paying subscribers at current server costs |
| Next technical step | Create App Store Connect subscription products and ship native build |
| Key seasonal opportunity | Pakistan smog season Oct–Jan |
