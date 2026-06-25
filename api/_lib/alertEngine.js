// OutdoorAdvisor server alert engine.
//
// Pipeline: shared feeds → per-device snapshot → rules → dispatcher.
//
// 1. Shared feeds (PMD CAP, NDMA advisories, NHMP route state) are fetched at
//    most once per cron run, with their own refresh throttles.
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

const NON_CRITICAL_DAILY_LIMIT = 1;
const MAX_CRITICALS_PER_RUN = 3;
const QUIET_HOURS = { start: 22, end: 6 }; // device-local; criticals bypass
const NDMA_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const NHMP_CHECK_INTERVAL_MS = 28 * 60 * 1000; // cron fires every 15 min
const COOLDOWN_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const SNAPSHOT_RETENTION_MS = 6 * 60 * 60 * 1000;
const SEND_LOG_LIMIT = 60;
const DEFAULT_RAIN_PROBABILITY = 60;
const DEFAULT_RAIN_JUMP = 25;
const DEFAULT_RAIN_LEAD_HOURS = 3;
const BRIEF_RESTORE_MARKER_KEY = '_briefsRestoredAt';

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
  const caches = { weather: new Map(), aqi: new Map(), pollen: new Map() };
  const sentByType = {};
  let totalSent = 0;

  for (const device of activeDevices) {
    try {
      const ctx = await buildDeviceContext(device, caches, shared, state, now);
      const candidates = evaluateRules(device, ctx, shared, state, now);
      updateDeviceSnapshot(state, device, ctx, now);
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
  const shared = {
    pmdAlerts: [],
    ndmaAdvisories: (state.ndmaLatest || []).filter((advisory) => advisory.important),
    nhmpChanges: [],
    nationalOverview: null,
  };

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

  if (devices.some((device) =>
    briefPreferenceEnabled(device.preferences || {}, 'dailySummary') &&
    isWindowDue(state, device, MORNING_BRIEF_WINDOW, now)
  )) {
    try {
      shared.nationalOverview = await fetchPakistanMorningOverview();
    } catch (error) {
      state.morningOverviewLastError = { message: error?.message || 'morning overview failed', at: Date.now() };
    }
  }

  // NHMP route state every ~30 min when someone follows a route or has broad
  // major-closure alerts enabled.
  const hasMotorwayCandidates = devices.some((d) =>
    d.premium === true &&
    (
      d.preferences?.routeClosureAlerts !== false ||
      (
        d.preferences?.motorwayAlerts !== false &&
        d.motorwaySubscriptions &&
        Object.values(d.motorwaySubscriptions).some(Boolean)
      )
    ));
  if (hasMotorwayCandidates && Date.now() - (state.nhmpLastCheckedAt || 0) >= NHMP_CHECK_INTERVAL_MS) {
    state.nhmpLastCheckedAt = Date.now();
    const advisories = await fetchNhmpAdvisories();
    if (advisories?.length) {
      const currentRouteState = buildNhmpRouteState(advisories);
      shared.nhmpChanges = detectNhmpChanges(state.nhmpRouteState || {}, currentRouteState);
      state.nhmpRouteState = currentRouteState;
    }
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
    prefs.fogWarnings !== false ||
    prefs.smogAlerts !== false ||
    prefs.severeAqiWarnings !== false ||
    briefPreferenceEnabled(prefs, 'dailySummary') ||
    briefPreferenceEnabled(prefs, 'eveningPlanner')
  );
  const needsAqi = hasLocation && (
    prefs.severeAqiWarnings !== false || prefs.smogAlerts !== false ||
    briefPreferenceEnabled(prefs, 'dailySummary') ||
    briefPreferenceEnabled(prefs, 'eveningPlanner')
  );
  const needsPollen = false;

  let wx = null;
  let aqi = null;
  let pollen = null;
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
  if (needsPollen) {
    const key = coordKey(device.location.lat, device.location.lon);
    if (!caches.pollen.has(key)) {
      caches.pollen.set(key, await fetchPollen(device.location.lat, device.location.lon));
    }
    pollen = caches.pollen.get(key);
  }

  return { prefs, hasLocation, localHour, day, wx, aqi, pollen };
}

// ─── Rules ───────────────────────────────────────────────────────────────────
// Each rule may push candidates shaped as:
// { type, severity, decision, title, body, category, source, url, data,
//   cooldownKey, cooldownMs, countsTowardCap, brief }
function evaluateRules(device, ctx, shared, state, now) {
  const candidates = [];
  const { prefs, wx, aqi, day } = ctx;
  const city = getDeviceLocationLabel(device);
  const token = device.expoPushToken;
  const previous = state.weatherSnapshots?.[token] || null;

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
      if (change.type !== 'closed') continue;
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

  // 4. Major route closures (premium, broad closure-only watch)
  if (device.premium === true && prefs.routeClosureAlerts !== false) {
    for (const change of shared.nhmpChanges || []) {
      if (change.type !== 'closed') continue;
      if (prefs.motorwayAlerts !== false && device.motorwaySubscriptions?.[change.routeId]) continue;
      const copy = buildMotorwayCopy(change);
      candidates.push({
        type: 'route-closure',
        severity: 'critical',
        decision: 'avoid',
        title: copy.title,
        body: copy.body,
        category: 'Travel',
        source: 'major-route-closure',
        url: 'https://outdooradvisor.app',
        data: { routeId: change.routeId, changeType: change.type },
        cooldownKey: `route-closure:${change.routeId}`,
        cooldownMs: 6 * 60 * 60 * 1000,
      });
    }
  }

  // Weather-driven rules need a snapshot.
  if (wx) {
    const feels = wx.feelsLike ?? wx.temp;
    const storm = prefs.thunderstormAlerts !== false && isThunderstorm(wx);

    // 5. Native provider warnings at the exact pin.
    if (prefs.officialAdvisories !== false) {
      for (const alert of normaliseNativeWeatherAlerts(wx.nativeAlerts)) {
        candidates.push({
          type: 'native-weather-alert',
          severity: alert.critical ? 'critical' : 'important',
          decision: alert.critical ? 'avoid' : 'caution',
          title: alert.title,
          body: withDecision(alert.critical ? 'avoid' : 'caution', alert.body),
          category: 'Official Advisory',
          source: 'weatherkit-alert',
          url: alert.url || 'https://outdooradvisor.app',
          data: { alertKey: alert.key },
          cooldownKey: `native-alert:${alert.key}`,
          cooldownMs: 12 * 60 * 60 * 1000,
        });
      }
    }

    // 6. Thunderstorm (critical)
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

    // 7. Heavy rain only. Light rain is visible in-app but no longer pushed.
    if (prefs.rainAlerts !== false && !storm && isHeavyRain(wx)) {
      const heavy = isHeavyRain(wx);
      const rainSignal = getRainSoonSignal(wx, {
        now,
        timeZone: device.timezone || 'Asia/Karachi',
        probabilityThreshold: Math.min(Number(device.thresholds?.rainProbabilityAlert || DEFAULT_RAIN_PROBABILITY), 50),
        leadHours: Number(device.thresholds?.rainLeadHours || DEFAULT_RAIN_LEAD_HOURS),
      });
      const copy = buildRainCopy(city, heavy, wx.precipitation ?? null, rainSignal);
      candidates.push({
        type: heavy ? 'heavy-rain' : 'rain',
        severity: heavy ? 'critical' : 'important',
        decision: heavy ? 'avoid' : 'caution',
        title: copy.title,
        body: copy.body,
        category: 'Weather',
        source: 'weather-rain',
        url: 'https://outdooradvisor.app',
        data: {
          weatherCode: wx.weatherCode,
          precipitation: wx.precipitation ?? null,
          rainAt: rainSignal?.time || null,
          rainProbability: rainSignal?.probability ?? null,
        },
        cooldownKey: 'rain',
        cooldownMs: 4 * 60 * 60 * 1000,
      });
    }

    // 8. Extreme heat (critical when well past threshold, else important)
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

    // 9. Wind — push only severe wind; ordinary breezy windows stay in-app.
    if (prefs.windAlerts !== false) {
      const windThreshold = Number(device.thresholds?.windAlert || 60);
      if (isWindy(wx, windThreshold)) {
        const gusts = Math.round(wx.windGusts);
        const speed = Math.round(wx.windSpeed);
        const severe = gusts >= 80 || speed >= 70;
        if (!severe) {
          // Sudden wind strengthening is handled separately below.
        } else {
          const copy = buildWindCopy(city, speed, gusts, severe);
          candidates.push({
            type: 'wind',
            severity: 'critical',
            decision: 'avoid',
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
    }

    // 10. Sudden local weather changes between scheduler snapshots.
    const sudden = buildSuddenWeatherCandidates({ device, wx, aqi, previous, city, now });
    candidates.push(...sudden.filter((candidate) => {
      if (candidate.type === 'sudden-rain' && (storm || isRaining(wx))) return false;
      if (candidate.type === 'sudden-wind' && candidates.some((item) => item.type === 'wind' || item.type === 'thunderstorm')) return false;
      if (candidate.type === 'visibility-drop' && candidates.some((item) => item.type === 'fog')) return false;
      return true;
    }));
  }

  // 14. Severe AQI / PM2.5 (hazardous is critical, otherwise important)
  if (prefs.severeAqiWarnings !== false && (aqi?.aqi != null || aqi?.pm25 != null)) {
    const threshold = Number(device.thresholds?.aqiAlert || 150);
    const pm25Threshold = Number(device.thresholds?.pm25Alert || 75);
    if (aqi.aqi >= threshold || aqi.pm25 >= pm25Threshold) {
      const band = getAqiBand(aqi.aqi);
      const hazardousPm25 = aqi.pm25 >= 150;
      candidates.push({
        type: 'severe-aqi',
        severity: band === 'hazardous' || hazardousPm25 ? 'critical' : 'important',
        decision: band === 'unhealthy' && !hazardousPm25 ? 'caution' : 'avoid',
        title: band === 'hazardous' || hazardousPm25 ? 'Hazardous Air Alert' : 'Severe Air Quality Warning',
        body: buildAqiBody(aqi, device.location?.city || 'your area'),
        category: 'AQI',
        source: 'google-aqi',
        url: 'https://outdooradvisor.app',
        data: { aqi: aqi.aqi, pm25: aqi.pm25 ?? null, band, threshold, pm25Threshold },
        cooldownKey: `aqi:${band}`,
        cooldownMs: 4 * 60 * 60 * 1000,
      });
    }
  }

  // 15. Smog-season warning (premium) — fine-particle pollution plus haze,
  // smoke, dust, or a strongly elevated PM2.5 reading.
  if (
    device.premium === true &&
    prefs.smogAlerts !== false &&
    isSmogRisk(wx, aqi, device.thresholds) &&
    !candidates.some((candidate) => candidate.type === 'severe-aqi')
  ) {
    const severe = Number(aqi?.pm25 || 0) >= 150 || Number(aqi?.aqi || 0) >= 250;
    candidates.push({
      type: 'smog',
      severity: severe ? 'critical' : 'important',
      decision: severe ? 'avoid' : 'caution',
      title: `Smog warning for ${city}`,
      body: withDecision(severe ? 'avoid' : 'caution', `Fine-particle pollution is elevated${aqi?.pm25 != null ? ` at PM2.5 ${aqi.pm25} µg/m³` : ''}. Keep outdoor exertion low, close windows during the worst period, and use an N95 outside.`),
      category: 'AQI',
      source: 'smog-rule',
      url: 'https://outdooradvisor.app',
      data: { aqi: aqi?.aqi ?? null, pm25: aqi?.pm25 ?? null },
      cooldownKey: 'smog',
      cooldownMs: 8 * 60 * 60 * 1000,
    });
  }

  if (wx && briefPreferenceEnabled(prefs, 'dailySummary') && isWindowDue(state, device, MORNING_BRIEF_WINDOW, now)) {
    const copy = buildOutdoorSummaryCopy({
      city,
      window: MORNING_BRIEF_WINDOW,
      wx,
      aqi,
      nationalOverview: shared.nationalOverview,
      officialContext: buildOfficialMorningContext({
        pmdAlerts: shared.pmdAlerts,
        ndmaAdvisories: shared.ndmaAdvisories,
        device,
      }),
    });
    candidates.push({
      type: 'morning-brief',
      severity: 'helpful',
      decision: copy.decision,
      title: copy.title,
      body: copy.body,
      category: 'Summary',
      source: 'morning-brief',
      url: 'https://outdooradvisor.app',
      data: { window: MORNING_BRIEF_WINDOW.id },
      cooldownKey: `brief:${MORNING_BRIEF_WINDOW.id}:${day}`,
      cooldownMs: 20 * 60 * 60 * 1000,
      brief: true,
    });
  }

  if (wx && briefPreferenceEnabled(prefs, 'eveningPlanner') && isWindowDue(state, device, EVENING_PLANNER_WINDOW, now)) {
    const copy = buildEveningPlannerCopy({ city, wx, aqi });
    if (copy) {
      candidates.push({
        type: 'evening-planner',
        severity: 'helpful',
        decision: copy.decision,
        title: copy.title,
        body: copy.body,
        category: 'Summary',
        source: 'evening-planner',
        url: 'https://outdooradvisor.app',
        data: { window: EVENING_PLANNER_WINDOW.id },
        cooldownKey: `brief:${EVENING_PLANNER_WINDOW.id}:${day}`,
        cooldownMs: 20 * 60 * 60 * 1000,
        brief: true,
      });
    }
  }

  // Track "bad day" so the good-window rule can detect recovery later.
  if (candidates.some((c) => c.severity !== 'helpful')) {
    state.badDay = state.badDay || {};
    state.badDay[token] = day;
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

function buildRainCopy(city, isHeavy, precip, rainSignal = null) {
  const timingText = rainSignal?.arrivalSentence
    ? `${rainSignal.arrivalSentence}. `
    : 'Rain timing is not precise yet. ';
  if (isHeavy) {
    return {
      title: `Heavy rain advisory for ${city}`,
      body: withDecision('avoid', `Heavy rain is active now at your pin${precip != null ? ` (${precip} mm)` : ''}. ${timingText}Delay non-essential trips, slow down on wet roads, and avoid low-lying water.`),
    };
  }
  const lines = [
    `${timingText}Keep outdoor plans short and take rain gear if you need to leave.`,
    `${timingText}Leave extra braking distance and avoid rushing errands.`,
    `${timingText}Pick covered routes and keep a little extra travel time.`,
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
// { temp, feelsLike, humidity, windSpeed, windGusts, visibility, weatherCode,
//   conditionCode, precipitation, precipitationIntensity, hourly, daily,
//   nativeAlerts }
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
      visibility:             c.visibility             ?? null,
      weatherCode:            c.weatherCode            ?? 0,
      conditionCode:          c.conditionCode          ?? null,
      precipitation:          null,
      precipitationIntensity: c.precipitationIntensity ?? null,
      hourly:                 Array.isArray(json.hourly) ? json.hourly.slice(0, 24) : [],
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,precipitation_probability_max&wind_speed_unit=kmh&forecast_days=2&timezone=auto`;
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
      visibility:    c.visibility      ?? null,
      weatherCode:   c.weather_code    ?? 0,
      conditionCode: null,
      precipitation: c.precipitation   ?? null,
      precipitationIntensity: c.precipitation ?? null,
      hourly: hourlyTimes.map((time, index) => ({
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
    FOG_CODES.has(wx?.weatherCode) ||
    (Number.isFinite(wx?.visibility) && wx.visibility <= 2000);
}

export function getFutureHourly(wx, { now = new Date(), leadHours = DEFAULT_RAIN_LEAD_HOURS } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const maxMs = nowMs + Math.max(1, Number(leadHours) || DEFAULT_RAIN_LEAD_HOURS) * 60 * 60 * 1000;
  return (wx?.hourly || []).filter((hour) => {
    const at = hour?.time ? new Date(hour.time).getTime() : NaN;
    return Number.isFinite(at) && at >= nowMs - 5 * 60 * 1000 && at <= maxMs;
  });
}

export function getRainSoonSignal(wx, {
  now = new Date(),
  probabilityThreshold = DEFAULT_RAIN_PROBABILITY,
  leadHours = DEFAULT_RAIN_LEAD_HOURS,
  timeZone = 'Asia/Karachi',
} = {}) {
  const upcoming = getFutureHourly(wx, { now, leadHours });
  const rainy = upcoming.find((hour) => {
    const probability = Number(hour?.precipProbability ?? 0);
    const code = hour?.weatherCode;
    const condition = hour?.conditionCode;
    return probability >= probabilityThreshold || RAIN_CODES.has(code) || WK_RAIN_DEFINITE.has(condition) || WK_RAIN_AREA.has(condition);
  });
  if (!rainy) return null;
  const probability = Number(rainy.precipProbability ?? 0);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const rainAt = rainy.time ? new Date(rainy.time) : null;
  const rainAtMs = rainAt ? rainAt.getTime() : NaN;
  const minutes = Number.isFinite(rainAtMs)
    ? Math.max(0, Math.round((rainAtMs - nowMs) / 60000))
    : 60;
  const timing = minutes <= 30 ? '30 minutes' : minutes <= 90 ? '1-2 hours' : `${Math.ceil(minutes / 60)} hours`;
  const timeLabel = Number.isFinite(rainAtMs) ? formatRainTime(rainAt, timeZone) : null;
  const arrivalLabel = timeLabel
    ? minutes <= 15
      ? `now / around ${timeLabel}`
      : `around ${timeLabel}`
    : `within about ${timing}`;
  const arrivalSentence = timeLabel
    ? minutes <= 15
      ? `Rain is at or very near your pin now`
      : `Rain is estimated near your pin around ${timeLabel}`
    : `Rain is estimated within about ${timing} at your pin`;
  const label = probability > 0
    ? `${probability}% rain risk ${arrivalLabel}`
    : `rain signals ${arrivalLabel}`;
  return {
    probability,
    label,
    minutes,
    time: Number.isFinite(rainAtMs) ? rainAt.toISOString() : null,
    timeLabel,
    arrivalLabel,
    arrivalSentence,
    weatherCode: rainy.weatherCode ?? null,
  };
}

function formatRainTime(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
}

function getPeakRainProbability(wx, now, leadHours) {
  return getFutureHourly(wx, { now, leadHours }).reduce(
    (max, hour) => Math.max(max, Number(hour?.precipProbability ?? 0)),
    0,
  );
}

export function buildSuddenWeatherCandidates({ device, wx, aqi, previous, city, now = new Date() }) {
  if (!previous?.at || !wx) return [];
  const ageMs = now.getTime() - Number(previous.at);
  if (ageMs < 4 * 60 * 1000 || ageMs > SNAPSHOT_RETENTION_MS) return [];

  const prefs = device.preferences || {};
  const thresholds = device.thresholds || {};
  const candidates = [];
  const leadHours = Number(thresholds.rainLeadHours || DEFAULT_RAIN_LEAD_HOURS);
  const rainThreshold = Number(thresholds.rainProbabilityAlert || DEFAULT_RAIN_PROBABILITY);
  const rainJumpThreshold = Number(thresholds.rainProbabilityJump || DEFAULT_RAIN_JUMP);
  const rainProbability = getPeakRainProbability(wx, now, leadHours);
  const rainJump = rainProbability - Number(previous.rainProbability || 0);

  if (prefs.rainAlerts !== false && rainProbability >= rainThreshold && rainJump >= rainJumpThreshold) {
    const rainSignal = getRainSoonSignal(wx, {
      now,
      probabilityThreshold: rainThreshold,
      leadHours,
      timeZone: device.timezone || 'Asia/Karachi',
    });
    const timingText = rainSignal?.arrivalSentence
      ? `${rainSignal.arrivalSentence}.`
      : `Rain is estimated within the next ${leadHours} hours at your pin.`;
    candidates.push({
      type: 'sudden-rain',
      severity: 'important',
      decision: 'plan',
      title: `Rain may reach ${city} soon`,
      body: withDecision('plan', `Rain chance jumped from ${Math.round(previous.rainProbability || 0)}% to ${Math.round(rainProbability)}%. ${timingText} Finish exposed plans early and take rain gear.`),
      category: 'Weather',
      source: 'weather-change',
      url: 'https://outdooradvisor.app',
      data: {
        fromProbability: previous.rainProbability || 0,
        toProbability: rainProbability,
        leadHours,
        rainAt: rainSignal?.time || null,
        rainProbability: rainSignal?.probability ?? rainProbability,
      },
      cooldownKey: 'sudden-rain',
      cooldownMs: 2 * 60 * 60 * 1000,
    });
  }

  const gusts = Number(wx.windGusts || 0);
  const gustJump = gusts - Number(previous.windGusts || 0);
  const windThreshold = Number(thresholds.windAlert || 40);
  if (prefs.windAlerts !== false && gusts >= windThreshold && gustJump >= 20) {
    candidates.push({
      type: 'sudden-wind',
      severity: gusts >= 70 ? 'critical' : 'important',
      decision: gusts >= 70 ? 'avoid' : 'caution',
      title: `Wind strengthening near ${city}`,
      body: withDecision(gusts >= 70 ? 'avoid' : 'caution', `Gusts rose from about ${Math.round(previous.windGusts || 0)} to ${Math.round(gusts)} km/h. Secure loose items and avoid exposed routes, trees, and signboards.`),
      category: 'Wind',
      source: 'weather-change',
      url: 'https://outdooradvisor.app',
      data: { fromGusts: previous.windGusts || 0, toGusts: gusts },
      cooldownKey: 'sudden-wind',
      cooldownMs: 2 * 60 * 60 * 1000,
    });
  }

  const visibility = toFiniteMetric(wx.visibility);
  const previousVisibility = toFiniteMetric(previous.visibility);
  if (
    prefs.fogWarnings !== false &&
    Number.isFinite(visibility) &&
    Number.isFinite(previousVisibility) &&
    visibility <= 2000 &&
    previousVisibility - visibility >= 2000
  ) {
    candidates.push({
      type: 'visibility-drop',
      severity: visibility <= 1000 ? 'critical' : 'important',
      decision: visibility <= 1000 ? 'avoid' : 'caution',
      title: `Visibility dropping near ${city}`,
      body: withDecision(visibility <= 1000 ? 'avoid' : 'caution', `Visibility fell to about ${Math.round(visibility)} metres. Delay non-essential driving, slow down, and use low beams.`),
      category: 'Weather',
      source: 'weather-change',
      url: 'https://outdooradvisor.app',
      data: { fromVisibility: previousVisibility, toVisibility: visibility },
      cooldownKey: 'visibility-drop',
      cooldownMs: 3 * 60 * 60 * 1000,
    });
  }

  const feels = toFiniteMetric(wx.feelsLike ?? wx.temp);
  const previousFeels = toFiniteMetric(previous.feelsLike);
  if (
    prefs.heatAlerts !== false &&
    Number.isFinite(feels) &&
    Number.isFinite(previousFeels) &&
    feels >= Number(thresholds.heatAlert || 42) &&
    feels - previousFeels >= 6
  ) {
    candidates.push({
      type: 'temperature-surge',
      severity: 'important',
      decision: 'caution',
      title: `Temperature rising quickly near ${city}`,
      body: withDecision('caution', `Feels-like temperature climbed from ${Math.round(previousFeels)}°C to ${Math.round(feels)}°C. Shorten exposed plans and hydrate before heading out.`),
      category: 'Weather',
      source: 'weather-change',
      url: 'https://outdooradvisor.app',
      data: { fromFeelsLike: previousFeels, toFeelsLike: feels },
      cooldownKey: 'temperature-surge',
      cooldownMs: 3 * 60 * 60 * 1000,
    });
  }

  const currentAqi = toFiniteMetric(aqi?.aqi);
  const previousAqi = toFiniteMetric(previous.aqi);
  if (
    prefs.severeAqiWarnings !== false &&
    Number.isFinite(currentAqi) &&
    Number.isFinite(previousAqi) &&
    currentAqi >= 100 &&
    currentAqi - previousAqi >= 50
  ) {
    candidates.push({
      type: 'aqi-surge',
      severity: currentAqi >= 200 ? 'critical' : 'important',
      decision: currentAqi >= 200 ? 'avoid' : 'caution',
      title: `Air quality worsening quickly near ${city}`,
      body: withDecision(currentAqi >= 200 ? 'avoid' : 'caution', `AQI rose from ${Math.round(previousAqi)} to ${Math.round(currentAqi)}. Reduce outdoor exertion and recheck before longer plans.`),
      category: 'AQI',
      source: 'air-change',
      url: 'https://outdooradvisor.app',
      data: { fromAqi: previousAqi, toAqi: currentAqi },
      cooldownKey: 'aqi-surge',
      cooldownMs: 3 * 60 * 60 * 1000,
    });
  }

  return candidates;
}

function updateDeviceSnapshot(state, device, ctx, now) {
  if (!device.expoPushToken || (!ctx.wx && !ctx.aqi)) return;
  const leadHours = Number(device.thresholds?.rainLeadHours || DEFAULT_RAIN_LEAD_HOURS);
  state.weatherSnapshots = state.weatherSnapshots || {};
  state.weatherSnapshots[device.expoPushToken] = {
    at: now.getTime(),
    rainProbability: ctx.wx ? getPeakRainProbability(ctx.wx, now, leadHours) : 0,
    windGusts: ctx.wx?.windGusts ?? null,
    visibility: ctx.wx?.visibility ?? null,
    feelsLike: ctx.wx?.feelsLike ?? ctx.wx?.temp ?? null,
    aqi: ctx.aqi?.aqi ?? null,
    pm25: ctx.aqi?.pm25 ?? null,
  };
}

function toFiniteMetric(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseNativeWeatherAlerts(alerts = []) {
  return (Array.isArray(alerts) ? alerts : [])
    .map((alert, index) => {
      const title = alert?.headline || alert?.event || alert?.title || 'Official weather alert';
      const body = alert?.description || alert?.details || alert?.instruction || title;
      const severity = String(alert?.severity || alert?.significance || '').toLowerCase();
      const critical = /extreme|severe|warning/.test(severity) || /flash flood|cyclone|tornado|severe|warning/i.test(`${title} ${body}`);
      return {
        key: alert?.id || alert?.identifier || hashKey(`${title}:${index}`),
        title: truncate(title, 90),
        body: truncate(body, 220),
        url: alert?.sourceURL || alert?.detailsUrl || null,
        critical,
      };
    })
    .filter((alert) => alert.title && alert.body)
    .slice(0, 3);
}

function isSmogRisk(wx, aqi, thresholds = {}) {
  const pm25Threshold = Number(thresholds?.pm25Alert || 75);
  const pm25 = Number(aqi?.pm25 || 0);
  const aqiValue = Number(aqi?.aqi || 0);
  const haze = new Set(['Haze', 'Smoky', 'Smoke', 'BlowingDust']).has(wx?.conditionCode);
  return pm25 >= pm25Threshold && (haze || aqiValue >= 150 || pm25 >= Math.max(100, pm25Threshold + 25));
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

  if (key) {
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
      if (response.ok && !json.error) {
        const indexes = json.indexes || [];
        const primary = indexes.find((item) => item.code === 'usa_epa') || indexes.find((item) => item.code === 'uaqi') || indexes[0];
        const pollutants = json.pollutants || [];
        const pm25 = getPollutantValue(pollutants, 'pm25');
        return {
          aqi: primary?.aqi ?? null,
          category: primary?.category ?? null,
          pm25,
        };
      }
    } catch {
      // Fall through to Open-Meteo air quality below.
    }
  }

  return fetchOpenMeteoAqi(lat, lon);
}

async function fetchOpenMeteoAqi(lat, lon) {
  try {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'us_aqi,pm10,pm2_5');
    url.searchParams.set('timezone', 'auto');
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await response.json();
    if (!response.ok || json.error || !json.current) return null;
    return {
      aqi: json.current.us_aqi ?? null,
      category: getAqiBand(json.current.us_aqi ?? null),
      pm25: json.current.pm2_5 ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchPollen(lat, lon) {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://outdooradvisor.app';
    const response = await fetch(`${base}/api/google/pollen?lat=${lat}&lon=${lon}&days=1`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const types = (json?.dailyInfo?.[0]?.pollenTypeInfo || [])
      .map((item) => ({
        value: item?.indexInfo?.value ?? null,
        category: item?.indexInfo?.displayName || item?.indexInfo?.category || null,
        displayName: item?.displayName || item?.code || 'Pollen',
      }))
      .filter((item) => Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value);
    return types[0] || null;
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
  if (!Number.isFinite(aqi)) return 'unhealthy';
  if (aqi >= 300) return 'hazardous';
  if (aqi >= 200) return 'very-unhealthy';
  return 'unhealthy';
}

function buildAqiBody(aqi, city) {
  const pm25 = aqi.pm25 != null ? ` PM2.5 is at ${aqi.pm25} µg/m³.` : '';
  if (aqi.aqi == null || aqi.aqi < 100) {
    return withDecision('caution', `Fine-particle pollution in ${city} is above your PM2.5 alert level.${pm25} Keep outdoor time short and use an N95 for longer exposure.`);
  }
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

function briefPreferenceEnabled(prefs, key) {
  if (prefs?.[key] !== false) return true;
  // Devices that received the temporary "major warnings only" OTA may have
  // false saved without user intent. Once the app saves the restore marker,
  // an explicit false is respected again.
  return !prefs?.[BRIEF_RESTORE_MARKER_KEY];
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
  for (const [token, snapshot] of Object.entries(state.weatherSnapshots || {})) {
    if (!Number.isFinite(snapshot?.at) || Date.now() - snapshot.at > SNAPSHOT_RETENTION_MS) {
      delete state.weatherSnapshots[token];
    }
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
