// OutdoorAdvisor server alert engine.
//
// Pipeline: shared feeds → per-device snapshot → rules → dispatcher.
//
// 1. Shared feeds (PMD CAP, NDMA advisories, NHMP route state, national
//    overview) are fetched at most once per cron run, with their own
//    refresh throttles.
// 2. Each device gets ONE weather snapshot and ONE AQI snapshot per run,
//    shared across devices pinned to the same rounded coordinates.
// 3. Every rule evaluates that snapshot and emits candidate notifications
//    tagged with severity (critical / important / helpful) and a decision
//    verdict (avoid / caution / go / plan).
// 4. The dispatcher applies quiet hours, mute-today, per-type cooldowns,
//    the daily non-critical cap, and sends at most ONE non-critical push
//    per device per run so users never get stacked alerts.
import { listNativeDevices, sendNativePush } from './nativePush.js';
import { kvGetJson, kvSetJson } from './kv.js';
import {
  buildNdmaPushCopy,
  fetchNdmaAdvisories,
  ndmaAdvisoryMatchesDevice,
} from './ndmaAdvisories.js';

const ALERT_STATE_KEY = 'push:alert-engine:state';
const PMD_RSS_URL = 'https://cap-sources.s3.amazonaws.com/pk-pmd-en/rss.xml';

const NON_CRITICAL_DAILY_LIMIT = 2;
const MAX_CRITICALS_PER_RUN = 3;
const QUIET_HOURS = { start: 22, end: 6 }; // device-local; criticals bypass
const NDMA_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const NHMP_CHECK_INTERVAL_MS = 28 * 60 * 1000; // cron fires every 15 min
const COOLDOWN_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const SEND_LOG_LIMIT = 60;

const MORNING_BRIEF_WINDOW = { id: 'morning', start: 6, end: 10 };
const EVENING_PLANNER_WINDOW = { id: 'evening', start: 19, end: 22 };

const PAKISTAN_MORNING_SAMPLE_POINTS = [
  { label: 'Lahore', region: 'central', lat: 31.5204, lon: 74.3587 },
  { label: 'Karachi', region: 'south', lat: 24.8607, lon: 67.0011 },
  { label: 'Peshawar', region: 'northwest', lat: 34.0151, lon: 71.5249 },
  { label: 'Quetta', region: 'west', lat: 30.1798, lon: 66.9750 },
  { label: 'Gilgit', region: 'north', lat: 35.9208, lon: 74.3144 },
];

// WMO codes for weather-based alerts
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const RAIN_CODES         = new Set([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82]);
const HEAVY_RAIN_CODES   = new Set([63, 65, 67, 81, 82]);
const FOG_CODES          = new Set([45, 48]);

const SEVERITY_RANK = { critical: 3, important: 2, helpful: 1 };

// Decision verdicts: every push leads with one so the user can act without
// opening the app.
const DECISION_PREFIX = {
  avoid: 'Avoid outdoors',
  caution: 'Use caution',
  go: 'Good to go',
  plan: 'Plan ahead',
};

export async function runAlertEngine({ mode = 'scheduled' } = {}) {
  const [devices, state] = await Promise.all([
    listNativeDevices(),
    loadState(),
  ]);

  const activeDevices = devices.filter((device) => device?.expoPushToken);
  if (!activeDevices.length) {
    return { mode, devices: 0, sent: 0, results: [] };
  }

  const now = new Date();
  const shared = await loadSharedFeeds(activeDevices, state, { mode, now });
  const caches = { weather: new Map(), aqi: new Map() };
  const sentByType = {};
  let totalSent = 0;

  for (const device of activeDevices) {
    try {
      const ctx = await buildDeviceContext(device, caches, shared, state, now);
      const candidates = evaluateRules(device, ctx, shared, state, now);
      const sent = await dispatchCandidates(device, ctx, candidates, state, now);
      for (const item of sent) {
        sentByType[item.type] = (sentByType[item.type] || 0) + 1;
        totalSent += 1;
      }
    } catch (error) {
      state.lastDeviceError = { message: error?.message || 'device dispatch failed', at: Date.now() };
    }
  }

  state.lastRunAt = Date.now();
  pruneState(state, now);
  await saveState(state);

  return {
    mode,
    devices: activeDevices.length,
    sent: totalSent,
    results: Object.entries(sentByType).map(([type, sent]) => ({ type, sent })),
  };
}

// ─── Shared feeds (fetched once per run) ─────────────────────────────────────
async function loadSharedFeeds(devices, state, { mode, now }) {
  const shared = { pmdAlerts: [], ndmaAdvisories: [], nhmpChanges: [], nationalOverview: null };

  // PMD CAP RSS is cheap; refresh every run so critical alerts go out fast.
  shared.pmdAlerts = await fetchCriticalPmdAlerts();
  state.pmdLatest = shared.pmdAlerts;
  state.pmdLastCheckedAt = Date.now();

  // NDMA scraping is heavier; refresh hourly (forced for manual/test runs).
  const forceNdma = /ndma|manual|test/i.test(String(mode || ''));
  if (forceNdma || Date.now() - (state.ndmaLastCheckedAt || 0) >= NDMA_CHECK_INTERVAL_MS) {
    try {
      const advisories = await fetchNdmaAdvisories({ limit: 10 });
      state.ndmaLastCheckedAt = Date.now();
      state.ndmaLatest = advisories.slice(0, 5);
      shared.ndmaAdvisories = advisories.filter((advisory) => advisory.important);
      shared.ndmaForced = forceNdma;
    } catch (error) {
      state.ndmaLastError = { message: error?.message || 'NDMA fetch failed', at: Date.now() };
    }
  }

  // NHMP route state every ~30 min, and only if someone subscribed.
  const hasMotorwayCandidates = devices.some((d) =>
    d.premium === true &&
    d.preferences?.motorwayAlerts !== false &&
    d.motorwaySubscriptions &&
    Object.values(d.motorwaySubscriptions).some(Boolean));
  if (hasMotorwayCandidates && Date.now() - (state.nhmpLastCheckedAt || 0) >= NHMP_CHECK_INTERVAL_MS) {
    state.nhmpLastCheckedAt = Date.now();
    const advisories = await fetchNhmpAdvisories();
    if (advisories?.length) {
      const currentRouteState = buildNhmpRouteState(advisories);
      shared.nhmpChanges = detectNhmpChanges(state.nhmpRouteState || {}, currentRouteState);
      state.nhmpRouteState = currentRouteState;
    }
  }

  // National overview only when at least one morning brief is due.
  const briefDue = devices.some((device) =>
    device.preferences?.dailySummary !== false &&
    device.location?.lat != null &&
    isWindowDue(state, device, MORNING_BRIEF_WINDOW, now));
  if (briefDue) {
    shared.nationalOverview = await fetchPakistanMorningOverview();
  }

  return shared;
}

// ─── Per-device snapshot ─────────────────────────────────────────────────────
function coordKey(lat, lon) {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

async function buildDeviceContext(device, caches, shared, state, now) {
  const prefs = device.preferences || {};
  const hasLocation = device.location?.lat != null && device.location?.lon != null;
  const localHour = hourInTimeZone(now, device.timezone || 'Asia/Karachi');
  const day = pakistanDateKey(now);

  const needsWeather = hasLocation && (
    prefs.rainAlerts !== false || prefs.thunderstormAlerts !== false ||
    prefs.windAlerts !== false || prefs.heatAlerts !== false ||
    prefs.coldAlerts !== false || prefs.fogWarnings !== false ||
    prefs.dailySummary !== false || prefs.eveningPlanner !== false ||
    prefs.goodWindowAlerts !== false
  );
  const needsAqi = hasLocation && (
    prefs.severeAqiWarnings !== false || prefs.dailySummary !== false ||
    prefs.goodWindowAlerts !== false
  );

  let wx = null;
  let aqi = null;
  if (needsWeather) {
    const key = coordKey(device.location.lat, device.location.lon);
    if (!caches.weather.has(key)) {
      caches.weather.set(key, await fetchWeatherForAlerts(device.location.lat, device.location.lon));
    }
    wx = caches.weather.get(key);
  }
  if (needsAqi) {
    const key = coordKey(device.location.lat, device.location.lon);
    if (!caches.aqi.has(key)) {
      caches.aqi.set(key, await fetchAqi(device.location.lat, device.location.lon));
    }
    aqi = caches.aqi.get(key);
  }

  return { prefs, hasLocation, localHour, day, wx, aqi };
}

// ─── Rules ───────────────────────────────────────────────────────────────────
// Each rule may push candidates shaped as:
// { type, severity, decision, title, body, category, source, url, data,
//   cooldownKey, cooldownMs, countsTowardCap, brief }
function evaluateRules(device, ctx, shared, state, now) {
  const candidates = [];
  const { prefs, wx, aqi, day, localHour } = ctx;
  const city = getDeviceLocationLabel(device);
  const token = device.expoPushToken;

  // 1. PMD official alerts (critical)
  if (prefs.officialAdvisories !== false) {
    for (const alert of shared.pmdAlerts) {
      if (prefs.thunderstormAlerts === false && /thunder|storm|lightning/i.test(alert.title)) continue;
      if (prefs.rainAlerts === false && /rain|flood/i.test(alert.title)) continue;
      if (!regionMatchesDevice(alert, device)) continue;
      candidates.push({
        type: 'pmd-critical',
        severity: 'critical',
        decision: 'avoid',
        title: alert.severity === 'Extreme' ? 'PMD Extreme Weather Alert' : 'PMD Weather Warning',
        body: withDecision('avoid', truncate(alert.title, 110)),
        category: 'Weather',
        source: 'pmd-cap',
        url: 'https://outdooradvisor.app',
        data: { alertKey: alert.key, severity: alert.severity },
        cooldownKey: `pmd:${alert.key}`,
        cooldownMs: 12 * 60 * 60 * 1000,
        legacyKeys: [alert.key],
      });
    }
  }

  // 2. NDMA national advisories (critical)
  if (prefs.officialAdvisories !== false) {
    for (const advisory of shared.ndmaAdvisories || []) {
      if (!ndmaAdvisoryMatchesDevice(advisory, device)) continue;
      const copy = buildNdmaPushCopy(advisory, device);
      candidates.push({
        type: 'ndma',
        severity: 'critical',
        decision: 'avoid',
        title: copy.title,
        body: copy.body,
        category: 'Official Advisory',
        source: 'ndma-advisory',
        url: advisory.sourceUrl || 'https://www.ndma.gov.pk/advisories',
        data: {
          advisoryKey: advisory.key,
          hazard: advisory.hazard,
          level: advisory.level,
          date: advisory.date,
          sourceUrl: advisory.sourceUrl,
        },
        cooldownKey: `ndma:${advisory.key}`,
        cooldownMs: 7 * 24 * 60 * 60 * 1000,
        bypassCooldown: !!shared.ndmaForced,
        legacyKeys: [advisory.key, `${advisory.key}:${token}`],
      });
    }
  }

  // 3. Motorway route changes (premium, per-route subscription)
  if (device.premium === true && prefs.motorwayAlerts !== false && device.motorwaySubscriptions) {
    for (const change of shared.nhmpChanges || []) {
      if (!device.motorwaySubscriptions[change.routeId]) continue;
      const copy = buildMotorwayCopy(change);
      const isClosure = change.type === 'closed';
      candidates.push({
        type: 'motorway',
        severity: isClosure ? 'critical' : 'important',
        decision: isClosure ? 'avoid' : change.type === 'reopened' ? 'go' : 'caution',
        title: copy.title,
        body: copy.body,
        category: 'Travel',
        source: 'motorway-closure',
        url: 'https://outdooradvisor.app',
        data: { routeId: change.routeId, changeType: change.type },
        cooldownKey: `mw:${change.routeId}:${change.type}`,
        cooldownMs: 6 * 60 * 60 * 1000,
      });
    }
  }

  // Weather-driven rules need a snapshot.
  if (wx) {
    const feels = wx.feelsLike ?? wx.temp;
    const storm = prefs.thunderstormAlerts !== false && isThunderstorm(wx);

    // 4. Thunderstorm (critical)
    if (storm) {
      const copy = buildStormCopy(city);
      candidates.push({
        type: 'thunderstorm',
        severity: 'critical',
        decision: 'avoid',
        title: copy.title,
        body: copy.body,
        category: 'Weather',
        source: 'weather-storm',
        url: 'https://outdooradvisor.app',
        data: { weatherCode: wx.weatherCode },
        cooldownKey: 'storm',
        cooldownMs: 4 * 60 * 60 * 1000,
      });
    }

    // 5. Rain — heavy is critical, light is important. Storm supersedes both.
    if (prefs.rainAlerts !== false && !storm && isRaining(wx)) {
      const heavy = isHeavyRain(wx);
      const copy = buildRainCopy(city, heavy, wx.precipitation ?? null);
      candidates.push({
        type: heavy ? 'heavy-rain' : 'rain',
        severity: heavy ? 'critical' : 'important',
        decision: heavy ? 'avoid' : 'caution',
        title: copy.title,
        body: copy.body,
        category: 'Weather',
        source: 'weather-rain',
        url: 'https://outdooradvisor.app',
        data: { weatherCode: wx.weatherCode, precipitation: wx.precipitation ?? null },
        cooldownKey: 'rain',
        cooldownMs: 4 * 60 * 60 * 1000,
      });
    }

    // 6. Extreme heat (critical when well past threshold, else important)
    if (prefs.heatAlerts !== false && feels != null) {
      const heatThreshold = Number(device.thresholds?.heatAlert || 42);
      if (feels >= heatThreshold) {
        const extreme = feels >= Math.max(45, heatThreshold + 2);
        candidates.push({
          type: 'extreme-heat',
          severity: extreme ? 'critical' : 'important',
          decision: extreme ? 'avoid' : 'caution',
          title: extreme ? `Extreme heat in ${city}` : `Heat advisory for ${city}`,
          body: withDecision(
            extreme ? 'avoid' : 'caution',
            `Feels like ${Math.round(feels)}°C. ${extreme
              ? 'Stay out of direct sun, postpone strenuous outdoor plans, and keep water close — heat at this level is unsafe for longer exposure.'
              : 'Shift outdoor plans to early morning or evening, take shade breaks, and hydrate more than usual.'}`,
          ),
          category: 'Weather',
          source: 'weather-heat',
          url: 'https://outdooradvisor.app',
          data: { feelsLike: feels, threshold: heatThreshold },
          cooldownKey: 'heat',
          cooldownMs: 4 * 60 * 60 * 1000,
        });
      }
    }

    // 7. Cold snap (important)
    if (prefs.coldAlerts !== false && feels != null) {
      const coldThreshold = Number(device.thresholds?.coldAlert ?? 5);
      if (feels <= coldThreshold) {
        candidates.push({
          type: 'cold-snap',
          severity: 'important',
          decision: 'caution',
          title: `Cold snap in ${city}`,
          body: withDecision('caution', `Feels like ${Math.round(feels)}°C. Layer up before heading out, keep outdoor sessions short, and watch for icy patches early in the day.`),
          category: 'Weather',
          source: 'weather-cold',
          url: 'https://outdooradvisor.app',
          data: { feelsLike: feels, threshold: coldThreshold },
          cooldownKey: 'cold',
          cooldownMs: 12 * 60 * 60 * 1000,
        });
      }
    }

    // 8. Wind — severe is critical, threshold-crossing is important
    if (prefs.windAlerts !== false) {
      const windThreshold = Number(device.thresholds?.windAlert || 60);
      if (isWindy(wx, windThreshold)) {
        const gusts = Math.round(wx.windGusts);
        const speed = Math.round(wx.windSpeed);
        const severe = gusts >= 80 || speed >= 70;
        const copy = buildWindCopy(city, speed, gusts, severe);
        candidates.push({
          type: 'wind',
          severity: severe ? 'critical' : 'important',
          decision: severe ? 'avoid' : 'caution',
          title: copy.title,
          body: copy.body,
          category: 'Wind',
          source: 'weather-wind',
          url: 'https://outdooradvisor.app',
          data: { windSpeed: speed, windGusts: gusts },
          cooldownKey: 'wind',
          cooldownMs: 3 * 60 * 60 * 1000,
        });
      }
    }

    // 9. Local fog (important) — driving/visibility hazard at the pin
    if (prefs.fogWarnings !== false && isFoggy(wx)) {
      candidates.push({
        type: 'fog',
        severity: 'important',
        decision: 'caution',
        title: `Fog reducing visibility near ${city}`,
        body: withDecision('caution', 'Fog or dense haze is active around your pin. Delay non-essential driving, use low beams and fog lights, and leave extra following distance.'),
        category: 'Weather',
        source: 'weather-fog',
        url: 'https://outdooradvisor.app',
        data: { weatherCode: wx.weatherCode, conditionCode: wx.conditionCode },
        cooldownKey: 'fog',
        cooldownMs: 6 * 60 * 60 * 1000,
      });
    }

    // 10. Rain expected soon (helpful) — only when it is not already raining
    if (prefs.rainAlerts !== false && !storm && !isRaining(wx)) {
      const rainSoon = getRainSoonSignal(wx);
      if (rainSoon) {
        candidates.push({
          type: 'rain-soon',
          severity: 'helpful',
          decision: 'plan',
          title: `Rain may reach ${city} soon`,
          body: withDecision('plan', `Your pin shows ${rainSoon.label}. Finish exposed errands now, keep rain gear close, and recheck before leaving.`),
          category: 'Weather',
          source: 'weather-rain-soon',
          url: 'https://outdooradvisor.app',
          data: { precipProbability: rainSoon.probability, weatherCode: rainSoon.weatherCode },
          cooldownKey: 'rain-soon',
          cooldownMs: 3 * 60 * 60 * 1000,
        });
      }
    }
  }

  // 11. Severe AQI (hazardous is critical, otherwise important)
  if (prefs.severeAqiWarnings !== false && aqi?.aqi != null) {
    const threshold = Number(device.thresholds?.aqiAlert || 150);
    if (aqi.aqi >= threshold) {
      const band = getAqiBand(aqi.aqi);
      candidates.push({
        type: 'severe-aqi',
        severity: band === 'hazardous' ? 'critical' : 'important',
        decision: band === 'unhealthy' ? 'caution' : 'avoid',
        title: band === 'hazardous' ? 'Hazardous AQI Alert' : 'Severe AQI Warning',
        body: buildAqiBody(aqi, device.location?.city || 'your area'),
        category: 'AQI',
        source: 'google-aqi',
        url: 'https://outdooradvisor.app',
        data: { aqi: aqi.aqi, pm25: aqi.pm25 ?? null, band },
        cooldownKey: `aqi:${band}`,
        cooldownMs: 4 * 60 * 60 * 1000,
      });
    }
  }

  // Track "bad day" so the good-window rule can detect recovery later.
  if (candidates.some((c) => c.severity !== 'helpful')) {
    state.badDay = state.badDay || {};
    state.badDay[token] = day;
  }

  // 12. Good outdoor window (helpful) — conditions recovered after a rough day
  if (
    prefs.goodWindowAlerts !== false &&
    state.badDay?.[token] === day &&
    localHour >= 8 && localHour < 19 &&
    wx && aqi?.aqi != null &&
    !candidates.some((c) => c.severity !== 'helpful') &&
    isGoodOutdoorWindow(wx, aqi.aqi)
  ) {
    const feels = Math.round(wx.feelsLike ?? wx.temp);
    candidates.push({
      type: 'good-window',
      severity: 'helpful',
      decision: 'go',
      title: `Conditions cleared in ${city}`,
      body: withDecision('go', `Air is at AQI ${aqi.aqi} and it feels like ${feels}°C with calm weather. This is the best outdoor window of the day — use it while it lasts.`),
      category: 'Smart',
      source: 'good-window',
      url: 'https://outdooradvisor.app',
      data: { aqi: aqi.aqi, feelsLike: feels },
      cooldownKey: `good-window:${day}`,
      cooldownMs: 20 * 60 * 60 * 1000,
    });
  }

  // 13. Pakistan Morning Outdoor Brief (helpful, cap-exempt)
  if (prefs.dailySummary !== false && ctx.hasLocation && isWindowHourMatch(localHour, MORNING_BRIEF_WINDOW)) {
    const officialContext = prefs.officialAdvisories !== false
      ? buildOfficialMorningContext({
        pmdAlerts: state.pmdLatest || [],
        ndmaAdvisories: state.ndmaLatest || [],
        device,
      })
      : null;
    const advisory = buildOutdoorSummaryCopy({
      city,
      window: MORNING_BRIEF_WINDOW,
      wx,
      aqi,
      nationalOverview: shared.nationalOverview,
      officialContext,
    });
    candidates.push({
      type: 'morning-brief',
      severity: 'helpful',
      decision: advisory.decision,
      title: advisory.title,
      body: advisory.body,
      category: 'Summary',
      source: 'outdoor-summary',
      url: 'https://outdooradvisor.app',
      data: {
        day,
        window: MORNING_BRIEF_WINDOW.id,
        weatherSource: wx?.source || null,
        aqi: aqi?.aqi ?? null,
        temp: wx?.temp ?? null,
      },
      cooldownKey: `brief:morning:${day}`,
      cooldownMs: 18 * 60 * 60 * 1000,
      brief: true,
    });
  }

  // 14. Evening planner — tomorrow's outlook for decision-making tonight
  if (prefs.eveningPlanner !== false && ctx.hasLocation && wx && isWindowHourMatch(localHour, EVENING_PLANNER_WINDOW)) {
    const planner = buildEveningPlannerCopy({ city, wx, aqi });
    if (planner) {
      candidates.push({
        type: 'evening-planner',
        severity: 'helpful',
        decision: planner.decision,
        title: planner.title,
        body: planner.body,
        category: 'Summary',
        source: 'evening-planner',
        url: 'https://outdooradvisor.app',
        data: { day, window: EVENING_PLANNER_WINDOW.id, weatherSource: wx?.source || null },
        cooldownKey: `brief:evening:${day}`,
        cooldownMs: 18 * 60 * 60 * 1000,
        brief: true,
      });
    }
  }

  return candidates;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
async function dispatchCandidates(device, ctx, candidates, state, now) {
  if (!candidates.length) return [];

  const token = device.expoPushToken;
  const day = ctx.day;
  const quiet = ctx.localHour >= QUIET_HOURS.start || ctx.localHour < QUIET_HOURS.end;
  const muted = Number(device.muteUntil || 0) > Date.now();

  state.cooldowns = state.cooldowns || {};
  const sent = [];

  const passesCooldown = (candidate) => {
    if (candidate.bypassCooldown) return true;
    const key = `${token}:${candidate.cooldownKey}`;
    const last = state.cooldowns[key] || 0;
    if (Date.now() - last < candidate.cooldownMs) return false;
    // Honour dedupe entries written by the pre-overhaul engine so a deploy
    // does not re-send PMD/NDMA alerts users already received.
    const legacyHit = (candidate.legacyKeys || []).some((legacyKey) => {
      const at = state.legacySent?.[legacyKey];
      return Number.isFinite(at) && Date.now() - at < candidate.cooldownMs;
    });
    return !legacyHit;
  };

  const markCooldown = (candidate) => {
    state.cooldowns[`${token}:${candidate.cooldownKey}`] = Date.now();
  };

  const ordered = [...candidates].sort(
    (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0),
  );

  // Criticals: always allowed (quiet hours and mute do not block safety alerts),
  // each deduped by its own cooldown, capped per run to avoid floods.
  const criticals = ordered.filter((c) => c.severity === 'critical' && passesCooldown(c));
  for (const candidate of criticals.slice(0, MAX_CRITICALS_PER_RUN)) {
    await sendCandidate(device, candidate, state);
    markCooldown(candidate);
    sent.push(candidate);
  }

  // Non-criticals: quiet hours + mute-today gate everything below critical.
  if (quiet || muted) return sent;

  // Briefs are cap-exempt (their once-per-day cooldown is the limiter).
  const briefs = ordered.filter((c) => c.brief && passesCooldown(c));
  for (const candidate of briefs) {
    await sendCandidate(device, candidate, state);
    markCooldown(candidate);
    sent.push(candidate);
  }

  // At most ONE other non-critical per run, within the daily cap.
  if (!canSendNonCriticalToday(state, token, day)) return sent;
  const best = ordered.find((c) => c.severity !== 'critical' && !c.brief && passesCooldown(c));
  if (best) {
    await sendCandidate(device, best, state);
    markCooldown(best);
    incrementNonCritical(state, token, day);
    sent.push(best);
  }

  return sent;
}

async function sendCandidate(device, candidate, state) {
  const id = `${candidate.type}:${candidate.cooldownKey}:${pakistanDateKey(new Date())}`;
  const response = await sendNativePush([device], {
    id,
    title: candidate.title,
    body: candidate.body,
    category: candidate.category,
    source: candidate.source,
    url: candidate.url,
    data: {
      decision: candidate.decision,
      severity: candidate.severity,
      ...(candidate.data || {}),
    },
    priority: candidate.severity === 'helpful' ? 'normal' : 'high',
    interruptionLevel: candidate.severity === 'critical' ? 'time-sensitive' : 'active',
    // Actionable category gives non-critical pushes a "Mute alerts today" button.
    categoryId: candidate.severity === 'critical' ? null : 'oa-alert',
  });

  state.sendLog = state.sendLog || [];
  state.sendLog.unshift({ at: Date.now(), type: candidate.type, severity: candidate.severity });
  if (state.sendLog.length > SEND_LOG_LIMIT) state.sendLog.length = SEND_LOG_LIMIT;

  return response;
}

// ─── Decision helpers ────────────────────────────────────────────────────────
function withDecision(decision, text) {
  const prefix = DECISION_PREFIX[decision];
  return prefix ? `${prefix} — ${text}` : text;
}

function isGoodOutdoorWindow(wx, aqiValue) {
  const feels = wx.feelsLike ?? wx.temp;
  return (
    aqiValue < 100 &&
    !isRaining(wx) && !isThunderstorm(wx) && !isFoggy(wx) &&
    feels != null && feels >= 15 && feels <= 32 &&
    (wx.windGusts ?? 0) < 45
  );
}

// ─── Personalised copy builders ───────────────────────────────────────────────
function buildWindCopy(city, speed, gusts, isSevere) {
  if (isSevere) {
    return {
      title: `Wind advisory for ${city}`,
      body: withDecision('avoid', `Gusts near ${gusts} km/h can make exposed routes dangerous. Delay non-essential outdoor plans, secure loose items, and keep away from trees and signboards.`),
    };
  }
  return {
    title: `Breezy window in ${city}`,
    body: withDecision('caution', `Winds are around ${speed} km/h with gusts near ${gusts} km/h. Choose sheltered routes and skip umbrella-heavy errands if you can wait.`),
  };
}

function buildStormCopy(city) {
  const lines = [
    `Storm risk is active over ${city}. Stay indoors for now and avoid open areas until the cell passes.`,
    `Thunderstorm conditions are near ${city}. Pause exposed travel and wait for a clearer window.`,
    `Lightning and storm signals are active around ${city}. Keep outdoor plans on hold and recheck before leaving.`,
  ];
  return {
    title: `Storm advisory for ${city}`,
    body: withDecision('avoid', lines[Math.floor(Math.random() * lines.length)]),
  };
}

function buildRainCopy(city, isHeavy, precip) {
  if (isHeavy) {
    return {
      title: `Heavy rain advisory for ${city}`,
      body: withDecision('avoid', `Heavy rain is active${precip != null ? ` (${precip} mm)` : ''}. Delay non-essential trips, slow down on wet roads, and avoid low-lying water.`),
    };
  }
  const lines = [
    `Rain is active in ${city}. Keep outdoor plans short and take rain gear if you need to leave.`,
    `Wet roads are likely around ${city}. Leave extra braking distance and avoid rushing errands.`,
    `Light rain is around ${city}. Pick covered routes and keep a little extra travel time.`,
  ];
  return {
    title: `Rain advisory for ${city}`,
    body: withDecision('caution', lines[Math.floor(Math.random() * lines.length)]),
  };
}

export function buildEveningPlannerCopy({ city, wx, aqi }) {
  const tomorrow = wx?.daily?.[1];
  if (!tomorrow) return null;

  const maxTemp = tomorrow.maxTemp != null ? Math.round(tomorrow.maxTemp) : null;
  const rainProb = Number(tomorrow.precipProbability ?? 0);
  const uv = tomorrow.uvIndex != null ? Math.round(tomorrow.uvIndex) : null;
  const aqiValue = aqi?.aqi ?? null;

  const facts = [];
  if (maxTemp != null) facts.push(`high near ${maxTemp}°C`);
  if (rainProb >= 30) facts.push(`${rainProb}% rain risk`);
  if (uv != null && uv >= 8) facts.push(`UV ${uv}`);
  if (aqiValue != null && aqiValue >= 150) facts.push(`AQI still ${aqiValue} tonight`);

  let decision = 'go';
  let advice = 'Tomorrow looks workable — morning is usually the cleanest, coolest window.';
  if (rainProb >= 60 || THUNDERSTORM_CODES.has(tomorrow.weatherCode)) {
    decision = 'plan';
    advice = 'Rain is likely — schedule outdoor plans around it and keep a backup indoor option.';
  } else if (maxTemp != null && maxTemp >= 40) {
    decision = 'plan';
    advice = 'It will be very hot — finish outdoor plans before 10am or move them after sunset.';
  } else if (aqiValue != null && aqiValue >= 200) {
    decision = 'caution';
    advice = 'Air quality is poor — plan lighter outdoor activity and keep a mask handy.';
  } else if (rainProb >= 30) {
    decision = 'plan';
    advice = 'Some rain risk — earlier plans are safer than later ones.';
  }

  return {
    decision,
    title: `Tomorrow's outlook for ${city}`,
    body: withDecision(decision, `${facts.length ? `${facts.join(', ')}. ` : ''}${advice}`),
  };
}

// ─── Weather fetch: WeatherKit first, Open-Meteo fallback ────────────────────
// Returns a normalised shape:
// { temp, feelsLike, humidity, windSpeed, windGusts, weatherCode, conditionCode,
//   precipitation, precipitationIntensity, hourly, daily, nativeAlerts }
async function fetchWeatherForAlerts(lat, lon) {
  const wk = await fetchWeatherKit(lat, lon);
  if (wk) return wk;
  return fetchOpenMeteoNormalised(lat, lon);
}

async function fetchWeatherKit(lat, lon) {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://outdooradvisor.app';
    const url = `${base}/api/weatherkit?lat=${lat}&lon=${lon}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const json = await response.json();
    if (!json?.current) return null;
    const c = json.current;
    return {
      temp:                   c.temp                   ?? null,
      feelsLike:              c.feelsLike              ?? null,
      humidity:               c.humidity               ?? null,
      windSpeed:              c.windSpeed              ?? 0,
      windGusts:              c.windGusts              ?? 0,
      weatherCode:            c.weatherCode            ?? 0,
      conditionCode:          c.conditionCode          ?? null,
      precipitation:          null,
      precipitationIntensity: c.precipitationIntensity ?? null,
      hourly:                 Array.isArray(json.hourly) ? json.hourly.slice(0, 6) : [],
      daily:                  Array.isArray(json.daily) ? json.daily.slice(0, 2) : [],
      nativeAlerts:           json.alerts              ?? [],
      source:                 'WeatherKit',
    };
  } catch {
    return null;
  }
}

async function fetchOpenMeteoNormalised(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,precipitation_probability_max&wind_speed_unit=kmh&forecast_days=2&timezone=auto`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const json = await response.json();
    if (!json?.current) return null;
    const c = json.current;
    const hourlyTimes = json.hourly?.time || [];
    const hourlyCodes = json.hourly?.weather_code || [];
    const hourlyTemps = json.hourly?.temperature_2m || [];
    const hourlyRain  = json.hourly?.precipitation_probability || [];
    const dailyTimes  = json.daily?.time || [];
    const dailyCodes  = json.daily?.weather_code || [];
    const dailyMax    = json.daily?.temperature_2m_max || [];
    const dailyMin    = json.daily?.temperature_2m_min || [];
    const dailyUv     = json.daily?.uv_index_max || [];
    const dailyRain   = json.daily?.precipitation_probability_max || [];
    return {
      temp:          c.temperature_2m          ?? null,
      feelsLike:     c.apparent_temperature    ?? null,
      humidity:      c.relative_humidity_2m    ?? null,
      windSpeed:     c.wind_speed_10m  ?? 0,
      windGusts:     c.wind_gusts_10m  ?? 0,
      weatherCode:   c.weather_code    ?? 0,
      conditionCode: null,
      precipitation: c.precipitation   ?? null,
      precipitationIntensity: c.precipitation ?? null,
      hourly: hourlyTimes.slice(0, 6).map((time, index) => ({
        time,
        temp: hourlyTemps[index] ?? null,
        weatherCode: hourlyCodes[index] ?? null,
        precipProbability: hourlyRain[index] ?? null,
        conditionCode: null,
      })),
      daily: dailyTimes.slice(0, 2).map((date, index) => ({
        date,
        maxTemp: dailyMax[index] ?? null,
        minTemp: dailyMin[index] ?? null,
        weatherCode: dailyCodes[index] ?? null,
        precipProbability: dailyRain[index] ?? null,
        uvIndex: dailyUv[index] ?? null,
      })),
      nativeAlerts:  [],
      source:        'OpenMeteo',
    };
  } catch {
    return null;
  }
}

// WeatherKit native condition codes for each alert type
const WK_WIND_CONDITIONS = new Set(['Windy', 'Squalls', 'BlowingDust', 'FreezingDrizzle']);

// Overhead thunderstorm: confirmed directly above
const WK_STORM_DEFINITE  = new Set(['Thunderstorms', 'SevereThunderstorm']);
// Area-wide scattered: only alert if precipitationIntensity confirms it at the pin
const WK_STORM_SCATTERED = new Set(['IsolatedThunderstorms', 'ScatteredThunderstorms']);

// Definite rain AT the pin — these condition codes mean precipitation is overhead
const WK_RAIN_DEFINITE   = new Set(['Drizzle', 'LightDrizzle', 'HeavyDrizzle', 'LightRain', 'Rain', 'HeavyRain', 'HeavyShowers']);
// Area-wide / passing — only alert if precipitationIntensity > 0 confirms actual rain at pin
const WK_RAIN_AREA       = new Set(['SunShowers', 'ScatteredShowers']);
const WK_HEAVY_RAIN_CONDITIONS = new Set(['HeavyDrizzle', 'HeavyRain', 'HeavyShowers']);

// precipitationIntensity > 0 means rain is measurably falling at the exact coordinates
function pinIsRaining(wx) {
  return wx.precipitationIntensity != null && wx.precipitationIntensity > 0;
}

function isWindy(wx, threshold) {
  if (WK_WIND_CONDITIONS.has(wx.conditionCode)) return true;
  return wx.windGusts >= threshold || wx.windSpeed >= threshold;
}

function isThunderstorm(wx) {
  if (WK_STORM_DEFINITE.has(wx.conditionCode)) return true;
  if (WK_STORM_SCATTERED.has(wx.conditionCode)) return pinIsRaining(wx);
  return THUNDERSTORM_CODES.has(wx.weatherCode);
}

function isRaining(wx) {
  if (WK_RAIN_DEFINITE.has(wx.conditionCode)) return true;
  if (WK_RAIN_AREA.has(wx.conditionCode)) return pinIsRaining(wx);
  return RAIN_CODES.has(wx.weatherCode);
}

function isHeavyRain(wx) {
  if (WK_HEAVY_RAIN_CONDITIONS.has(wx.conditionCode)) return true;
  return HEAVY_RAIN_CODES.has(wx.weatherCode);
}

function isFoggy(wx) {
  return new Set(['Foggy', 'Haze', 'Smoky', 'BlowingDust']).has(wx?.conditionCode) ||
    FOG_CODES.has(wx?.weatherCode);
}

function getRainSoonSignal(wx) {
  const upcoming = (wx.hourly || []).slice(0, 2);
  const rainy = upcoming.find((hour) => {
    const probability = Number(hour?.precipProbability ?? 0);
    const code = hour?.weatherCode;
    const condition = hour?.conditionCode;
    return probability >= 60 || RAIN_CODES.has(code) || WK_RAIN_DEFINITE.has(condition) || WK_RAIN_AREA.has(condition);
  });
  if (!rainy) return null;
  const probability = Number(rainy.precipProbability ?? 0);
  const minutes = rainy.time ? Math.max(15, Math.round((new Date(rainy.time).getTime() - Date.now()) / 60000)) : 60;
  const label = probability > 0
    ? `${probability}% rain risk in about ${minutes <= 30 ? '30 minutes' : '1-2 hours'}`
    : `rain signals in about ${minutes <= 30 ? '30 minutes' : '1-2 hours'}`;
  return { probability, label, weatherCode: rainy.weatherCode ?? null };
}

// ─── NHMP motorway helpers ───────────────────────────────────────────────────
// Map NHMP advisory route strings to canonical IDs like "M2", "M3", "E35"
function normaliseRouteId(routeStr) {
  const m = (routeStr || '').match(/\bM-?\s*(\d+)\b/i);
  if (m) return `M${m[1]}`;
  const e = (routeStr || '').match(/\bE-?\s*(\d+)\b/i);
  if (e) return `E${e[1]}`;
  return null;
}

// Rank severity so we keep the worst status when multiple rows cover the same route
function motorwaySeverityRank(s) {
  return ({ closed: 4, rain: 3, fog: 3, warning: 2, cloudy: 1, clear: 0 })[s] ?? 0;
}

// Collapse a flat advisory list into one record per route ID
function buildNhmpRouteState(advisories) {
  const state = {};
  for (const adv of advisories) {
    const routeId = normaliseRouteId(adv.route || '');
    if (!routeId) continue;
    const existing = state[routeId];
    if (!existing || motorwaySeverityRank(adv.severity) > motorwaySeverityRank(existing.severity)) {
      state[routeId] = { severity: adv.severity, status: adv.status };
    }
  }
  return state;
}

// Return only the route changes worth notifying about
function detectNhmpChanges(prev, curr) {
  const changes = [];
  const allRoutes = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  for (const routeId of allRoutes) {
    const prevSev = prev[routeId]?.severity;
    const currSev = curr[routeId]?.severity;
    if (prevSev === currSev) continue;
    if (currSev === 'closed' && prevSev !== 'closed') {
      changes.push({ routeId, type: 'closed', status: curr[routeId]?.status });
    } else if (prevSev === 'closed' && currSev !== 'closed') {
      changes.push({ routeId, type: 'reopened', status: curr[routeId]?.status || 'Normal flow resumed' });
    } else if ((currSev === 'fog' || currSev === 'rain') && !prevSev) {
      changes.push({ routeId, type: currSev, status: curr[routeId]?.status });
    }
  }
  return changes;
}

function buildMotorwayCopy(change) {
  const label = change.routeId.startsWith('E') ? change.routeId : change.routeId.replace(/^M(\d)$/, 'M-$1');
  const statusText = change.status ? ` — ${change.status}` : '';
  if (change.type === 'closed') {
    return {
      title: `${label} closed`,
      body: withDecision('avoid', `${label} is currently closed${statusText}. Plan an alternate route or check NHMP before you travel.`),
    };
  }
  if (change.type === 'reopened') {
    return {
      title: `${label} has reopened`,
      body: withDecision('go', `${label} is back open${statusText}. Confirm conditions before heading out.`),
    };
  }
  if (change.type === 'fog') {
    return {
      title: `Fog warning on ${label}`,
      body: withDecision('caution', `Fog is affecting ${label}${statusText}. Reduce speed and use fog lights.`),
    };
  }
  if (change.type === 'rain') {
    return {
      title: `Rain on ${label}`,
      body: withDecision('caution', `Wet conditions reported on ${label}${statusText}. Drive carefully.`),
    };
  }
  return { title: `${label} update`, body: change.status || 'Conditions have changed on this route.' };
}

async function fetchNhmpAdvisories() {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://outdooradvisor.app';
    const response = await fetch(`${base}/api/nhmp`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;
    const json = await response.json();
    return Array.isArray(json?.advisories) ? json.advisories : null;
  } catch {
    return null;
  }
}

// ─── AQI ─────────────────────────────────────────────────────────────────────
async function fetchAqi(lat, lon) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;

  try {
    const response = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: Number(lat), longitude: Number(lon) },
        extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION'],
        languageCode: 'en',
      }),
    });
    const json = await response.json();
    if (!response.ok || json.error) return null;
    const indexes = json.indexes || [];
    const primary = indexes.find((item) => item.code === 'usa_epa') || indexes.find((item) => item.code === 'uaqi') || indexes[0];
    const pollutants = json.pollutants || [];
    const pm25 = getPollutantValue(pollutants, 'pm25');
    return {
      aqi: primary?.aqi ?? null,
      category: primary?.category ?? null,
      pm25,
    };
  } catch {
    return null;
  }
}

function getPollutantValue(pollutants, code) {
  const pollutant = pollutants.find((item) => item.code === code);
  const value = pollutant?.concentration?.value;
  return Number.isFinite(value) ? Math.round(value) : null;
}

function getAqiBand(aqi) {
  if (aqi >= 300) return 'hazardous';
  if (aqi >= 200) return 'very-unhealthy';
  return 'unhealthy';
}

function buildAqiBody(aqi, city) {
  const pm25 = aqi.pm25 != null ? ` PM2.5 is at ${aqi.pm25} µg/m³.` : '';
  if (aqi.aqi >= 300) {
    return withDecision('avoid', `Air in ${city} is hazardous right now (AQI ${aqi.aqi}).${pm25} Stay indoors, keep windows shut, and wear an N95 if you really must go out.`);
  }
  if (aqi.aqi >= 200) {
    return withDecision('avoid', `Very unhealthy air in ${city} (AQI ${aqi.aqi}).${pm25} Limit outdoor time and avoid any physical activity outside.`);
  }
  return withDecision('caution', `Air quality is unhealthy in ${city} (AQI ${aqi.aqi}).${pm25} Keep outdoor time short, choose lighter activity, and use a mask if you will be out for long.`);
}

// ─── PMD feed ────────────────────────────────────────────────────────────────
async function fetchCriticalPmdAlerts() {
  try {
    const response = await fetch(PMD_RSS_URL, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'OutdoorAdvisor/1.0 push alert engine',
      },
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = cleanXml(extractTag(block, 'title'));
      const pubDate = cleanXml(extractTag(block, 'pubDate'));
      const description = cleanXml(extractTag(block, 'description'));
      if (!title) continue;
      const severity = inferSeverity(title, description);
      if (!severity) continue;
      const age = pubDate ? Date.now() - new Date(pubDate).getTime() : Infinity;
      if (age > 48 * 60 * 60 * 1000) continue;
      items.push({
        key: hashKey(title),
        title,
        description,
        pubDate,
        severity,
        regions: inferRegions(`${title} ${description}`),
      });
    }
    return items.slice(0, 5);
  } catch {
    return [];
  }
}

function regionMatchesDevice(alert, device) {
  if (!alert.regions?.length) return true;
  const city = normalizeRegion(device.location?.city);
  const region = normalizeRegion(device.location?.region);
  if (!city || city === 'selected') return false;
  return alert.regions.some((item) => {
    const needle = normalizeRegion(item);
    if (!needle) return false;
    if (needle === 'pakistan') return true;
    return city.includes(needle) || needle.includes(city) || region.includes(needle) || needle.includes(region);
  });
}

// ─── Caps, windows, time helpers ─────────────────────────────────────────────
function canSendNonCriticalToday(state, token, day) {
  const record = state.nonCriticalCounts?.[token];
  if (!record || record.day !== day) return true;
  return record.count < NON_CRITICAL_DAILY_LIMIT;
}

function incrementNonCritical(state, token, day) {
  state.nonCriticalCounts = state.nonCriticalCounts || {};
  const record = state.nonCriticalCounts[token];
  state.nonCriticalCounts[token] = {
    day,
    count: record?.day === day ? record.count + 1 : 1,
  };
}

function isWindowHourMatch(hour, window) {
  return hour >= window.start && hour < window.end;
}

function isWindowDue(state, device, window, now) {
  const hour = hourInTimeZone(now, device.timezone || 'Asia/Karachi');
  if (!isWindowHourMatch(hour, window)) return false;
  const key = `${device.expoPushToken}:brief:${window.id}:${pakistanDateKey(now)}`;
  return !(state.cooldowns?.[key]);
}

function hourInTimeZone(date, timeZone) {
  try {
    return Number(new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date)) % 24;
  } catch {
    return hourInPakistan(date);
  }
}

function hourInPakistan(date) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    hour12: false,
  }).format(date)) % 24;
}

function pakistanDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getDeviceLocationLabel(device) {
  const city = device.location?.city;
  const region = device.location?.region;
  if (city && region && !String(city).toLowerCase().includes(String(region).toLowerCase())) {
    return `${city}, ${region}`;
  }
  return city || region || 'your pinned area';
}

// ─── Morning brief copy ──────────────────────────────────────────────────────
export function buildOutdoorSummaryCopy({
  city,
  window,
  wx,
  aqi,
  nationalOverview = null,
  officialContext = null,
}) {
  const temp = wx?.feelsLike ?? wx?.temp;
  const wind = wx?.windGusts ?? wx?.windSpeed;
  const rainSoon = wx ? getRainSoonSignal(wx) : null;
  const today = wx?.daily?.[0] || null;
  const aqiValue = aqi?.aqi ?? null;

  const risks = [];
  if (aqiValue != null && aqiValue >= 170) risks.push(`AQI ${aqiValue} is rough`);
  else if (aqiValue != null && aqiValue >= 100) risks.push(`AQI ${aqiValue} needs lighter plans`);
  if (temp != null && temp >= 38) risks.push(`feels near ${Math.round(temp)}C`);
  if (rainSoon) risks.push(rainSoon.label);
  else if (today?.precipProbability >= 50) risks.push(`${today.precipProbability}% rain risk today`);
  if (wind != null && wind >= 45) risks.push(`gusts near ${Math.round(wind)} km/h`);

  const decision = risks.length >= 2 ? 'caution' : risks.length === 1 ? 'plan' : 'go';

  const goodWindow = window.id === 'morning'
    ? 'Use the cooler window early'
    : window.id === 'afternoon'
    ? 'Keep outdoor time short this afternoon'
    : 'Evening is the better window if conditions stay steady';

  const action = risks.length
    ? `${goodWindow}; ${risks.slice(0, 2).join(' and ')}.`
    : `${goodWindow}; your pin looks workable for easy outdoor plans.`;

  const condition = wx?.conditionCode ? weatherConditionLabel(wx.conditionCode) : null;
  const weatherBits = [
    temp != null ? `feels ${Math.round(temp)}C` : null,
    condition,
    aqiValue != null ? `AQI ${aqiValue}` : null,
  ].filter(Boolean);

  return {
    decision,
    title: `Pakistan morning brief - ${city}`,
    body: truncate(
      `${weatherBits.length ? `${weatherBits.join(', ')}. ` : ''}${nationalOverview ? `${nationalOverview} ` : ''}${officialContext ? `${officialContext} ` : ''}${action}`,
      380,
    ),
  };
}

async function fetchPakistanMorningOverview() {
  const samples = await Promise.all(PAKISTAN_MORNING_SAMPLE_POINTS.map(async (point) => ({
    ...point,
    wx: await fetchWeatherForAlerts(point.lat, point.lon),
  })));
  return buildPakistanMorningOverview(samples);
}

export function buildPakistanMorningOverview(samples = []) {
  const valid = samples.filter((sample) => sample?.wx);
  if (!valid.length) return null;

  const stormy = valid.filter((sample) => isThunderstorm(sample.wx));
  const rainy = valid.filter((sample) => !isThunderstorm(sample.wx) && isRaining(sample.wx));
  const foggy = valid.filter((sample) => isFoggy(sample.wx));
  const extremeHeat = valid.filter((sample) => (sample.wx.feelsLike ?? sample.wx.temp) >= 42);
  const hot = valid.filter((sample) => (sample.wx.feelsLike ?? sample.wx.temp) >= 36);

  const signals = [];
  if (extremeHeat.length) signals.push(`extreme heat around ${joinSampleLabels(extremeHeat)}`);
  else if (hot.length) signals.push(`hot conditions around ${joinSampleLabels(hot)}`);
  if (stormy.length) signals.push(`storm signals near ${joinSampleLabels(stormy)}`);
  else if (rainy.length) signals.push(`rain around ${joinSampleLabels(rainy)}`);
  if (foggy.length) signals.push(`fog or haze near ${joinSampleLabels(foggy)}`);

  return signals.length
    ? `Pakistan outlook: ${signals.slice(0, 2).join('; ')}.`
    : 'Pakistan outlook: conditions look broadly stable across major centres.';
}

function joinSampleLabels(samples) {
  return samples.slice(0, 2).map((sample) => sample.label).join(' and ');
}

export function buildOfficialMorningContext({ pmdAlerts = [], ndmaAdvisories = [], device }) {
  const candidates = [
    ...pmdAlerts.map((alert) => ({
      source: 'PMD',
      level: alert.severity,
      text: `${alert.title || ''} ${alert.description || ''}`,
      regions: alert.regions || [],
    })),
    ...ndmaAdvisories
      .filter((advisory) => advisory?.important && advisory.pushEligible !== false)
      .map((advisory) => ({
        source: 'NDMA',
        level: advisory.level,
        text: `${advisory.hazard || ''} ${advisory.title || ''}`,
        regions: advisory.regions || [],
      })),
  ].filter((item) => item.text.trim());

  if (!candidates.length) return 'No major PMD or NDMA warning is active in the latest official feeds.';

  const ranked = candidates
    .map((item) => ({
      ...item,
      local: item.regions.length > 0 &&
        !item.regions.some((region) => /^pakistan$/i.test(region)) &&
        regionMatchesDevice({ regions: item.regions }, device),
      hazard: inferBriefHazard(item.text),
    }))
    .sort((a, b) => {
      const localDiff = Number(b.local) - Number(a.local);
      if (localDiff) return localDiff;
      return officialSeverityRank(b.level) - officialSeverityRank(a.level);
    })
    .slice(0, 2);

  const local = ranked.filter((item) => item.local);
  const national = ranked.filter((item) => !item.local);
  const parts = [];
  if (local.length) {
    parts.push(`Your area: ${formatOfficialSignals(local)}`);
  }
  if (national.length) {
    parts.push(`Pakistan watch: ${formatOfficialSignals(national)}`);
  }
  return `${parts.join('. ')}.`;
}

function formatOfficialSignals(items) {
  return items.map((item) => `${item.source} ${item.hazard}`).join('; ');
}

function inferBriefHazard(text) {
  const value = String(text || '').toLowerCase();
  if (/flash flood|urban flood|flood warning|torrential|very heavy rain/.test(value)) return 'flash-flood/heavy-rain alert';
  if (/glof|glacial lake|landslide|debris flow/.test(value)) return 'GLOF/landslide alert';
  if (/heatwave|heat wave|heat dome|extreme heat|above normal/.test(value)) return 'heatwave alert';
  if (/smog|poor air|air quality/.test(value)) return 'smog/air-quality alert';
  if (/fog|mist/.test(value)) return 'fog alert';
  if (/thunder|lightning|hail|windstorm|dust storm|squall|gust/.test(value)) return 'storm/wind alert';
  if (/rain|flood/.test(value)) return 'rain/flood alert';
  return 'weather warning';
}

function officialSeverityRank(level) {
  return ({ Extreme: 4, Severe: 3, Moderate: 2, Minor: 1, Info: 0 })[level] ?? 0;
}

function normalizeRegion(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\bkpk\b|\bkp\b/g, 'khyber pakhtunkhwa')
    .replace(/\bgb\b/g, 'gilgit-baltistan')
    .replace(/\bajk\b/g, 'azad kashmir');
}

function weatherConditionLabel(conditionCode) {
  if (!conditionCode) return null;
  return String(conditionCode)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

// ─── State persistence ───────────────────────────────────────────────────────
async function loadState() {
  const state = (await kvGetJson(ALERT_STATE_KEY)) || {};
  migrateLegacyState(state);
  return state;
}

// Fold pre-overhaul dedupe maps into a legacy lookup so a deploy does not
// re-send PMD/NDMA alerts users already received.
function migrateLegacyState(state) {
  state.cooldowns = state.cooldowns || {};
  if (state.sentPmdAlerts || state.sentNdmaAlerts) {
    state.legacySent = {
      ...(state.legacySent || {}),
      ...(state.sentPmdAlerts || {}),
      ...(state.sentNdmaAlerts || {}),
    };
    delete state.sentPmdAlerts;
    delete state.sentNdmaAlerts;
  }
  // Seed brief cooldowns so the morning brief is not duplicated on deploy day.
  if (state.sentOutdoorSummaries) {
    for (const [token, windows] of Object.entries(state.sentOutdoorSummaries)) {
      for (const [windowId, day] of Object.entries(windows || {})) {
        state.cooldowns[`${token}:brief:${windowId}:${day}`] = Date.now();
      }
    }
  }
  // Old per-type maps are superseded by the unified cooldown store.
  delete state.sentWindAlerts;
  delete state.sentStormAlerts;
  delete state.sentRainAlerts;
  delete state.sentImminentRainAlerts;
  delete state.sentAqiAlerts;
  delete state.sentMotorwayAlerts;
  delete state.sentOutdoorSummaries;
  delete state.sentDailySummaries;
}

function pruneState(state, now) {
  const cutoff = Date.now() - COOLDOWN_RETENTION_MS;
  for (const [key, at] of Object.entries(state.cooldowns || {})) {
    if (!Number.isFinite(at) || at < cutoff) delete state.cooldowns[key];
  }
  for (const [key, at] of Object.entries(state.legacySent || {})) {
    if (!Number.isFinite(at) || at < cutoff) delete state.legacySent[key];
  }
  const day = pakistanDateKey(now);
  for (const [token, record] of Object.entries(state.nonCriticalCounts || {})) {
    if (record?.day !== day) delete state.nonCriticalCounts[token];
  }
  for (const [token, badDay] of Object.entries(state.badDay || {})) {
    if (badDay !== day) delete state.badDay[token];
  }
}

async function saveState(state) {
  await kvSetJson(ALERT_STATE_KEY, state);
}

export async function getAlertEngineStatus() {
  const [devices, state] = await Promise.all([listNativeDevices(), loadState()]);
  return {
    devices: devices.length,
    lastRunAt: state.lastRunAt || null,
    pmdLastCheckedAt: state.pmdLastCheckedAt || null,
    ndmaLastCheckedAt: state.ndmaLastCheckedAt || null,
    ndmaLastError: state.ndmaLastError || null,
    nhmpLastCheckedAt: state.nhmpLastCheckedAt || null,
    activePmdAlerts: (state.pmdLatest || []).length,
    recentSends: (state.sendLog || []).slice(0, 25),
  };
}

// ─── XML / misc helpers ──────────────────────────────────────────────────────
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const match = re.exec(xml || '');
  return match ? match[1].trim() : '';
}

function cleanXml(value) {
  return (value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferSeverity(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (/extreme|cyclone|flash flood|torrential|emergency/.test(text)) return 'Extreme';
  if (/severe|warning|heavy rain|thunderstorm|lightning|flood|hail|heatwave|windstorm|dust storm|squall|gust/.test(text)) return 'Severe';
  return null;
}

function inferRegions(text) {
  const regions = [
    'Lahore', 'Islamabad', 'Rawalpindi', 'Karachi', 'Murree', 'Peshawar', 'Quetta',
    'Multan', 'Faisalabad', 'Hyderabad', 'Swat', 'Hunza', 'Gilgit', 'Skardu',
    'Punjab', 'Sindh', 'Balochistan', 'Khyber Pakhtunkhwa', 'AJK', 'Azad Kashmir',
  ];
  return regions.filter((region) => new RegExp(region, 'i').test(text || ''));
}

function hashKey(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return `pmd:${Math.abs(hash)}`;
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
