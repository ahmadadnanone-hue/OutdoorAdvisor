import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayHealthSnapshot } from '../hooks/useHealthData';
import { fetchAqiForLocation } from '../hooks/useAQI';
import { fetchWeatherForLocation } from '../hooks/useWeather';
import { loadStoredNotifications } from '../utils/alertPreferences';
import { loadLocationSnapshot } from '../utils/locationSnapshot';
import { sendSmartNotification } from './notificationService';
import { getNotificationDeliveryState } from './notificationService';

const SMART_STATE_KEY = 'outdooradvisor_smart_advisor_state_v1';
const WALK_NUDGE_COOLDOWN_MS    = 4 * 60 * 60 * 1000;
const MORNING_SUMMARY_HOUR_START = 6;
const MORNING_SUMMARY_HOUR_END   = 10;
const DAILY_STEP_GOAL            = 5000;
const CAP_ALERT_COOLDOWN_MS      = 6 * 60 * 60 * 1000; // only once per alert title per 6h

// ─── CAP alert push trigger ───────────────────────────────────────────────────

async function fetchActiveCapAlerts() {
  try {
    const r = await Promise.race([
      fetch('https://cap-sources.s3.amazonaws.com/pk-pmd-en/rss.xml'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const pubMatch   = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const title = titleMatch?.[1]?.trim();
      const pub   = pubMatch?.[1]?.trim();
      if (!title) continue;
      const tl  = title.toLowerCase();
      const sev = /extreme|flash flood|cyclone/i.test(tl) ? 'Extreme'
        : /severe|warning|heavy rain|thunder/i.test(tl) ? 'Severe'
        : null; // only care about Extreme + Severe for immediate push
      if (!sev) continue;
      const age = pub ? Date.now() - new Date(pub).getTime() : Infinity;
      if (age < 24 * 3_600_000) items.push({ title, severity: sev, pubDate: pub });
    }
    return items;
  } catch {
    return [];
  }
}

async function maybeSendCapAlert({ state, prefs }) {
  if (!prefs.severeAqiWarnings) return false; // reuse "severe warnings" pref as the gate
  const alerts = await fetchActiveCapAlerts();
  if (!alerts.length) return false;

  const sentTitles = state.sentCapAlerts || {};
  const now = Date.now();

  for (const alert of alerts) {
    const key       = alert.title.slice(0, 60); // stable short key
    const lastSent  = sentTitles[key] || 0;
    if (now - lastSent < CAP_ALERT_COOLDOWN_MS) continue;

    const title = alert.severity === 'Extreme'
      ? `PMD Extreme Alert`
      : `PMD Weather Warning`;
    const body = alert.title.length > 100 ? alert.title.slice(0, 97) + '…' : alert.title;

    const sent = await sendSmartNotification(title, body, {
      category: 'Alert',
      tag: `cap-${key.replace(/\s+/g, '-').slice(0, 40)}`,
      promptForPermission: false,
    });

    if (sent) {
      sentTitles[key] = now;
      return { sentTitles };
    }
  }
  return false;
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function hourOfDay(date = new Date()) {
  return date.getHours();
}

async function loadSmartState() {
  try {
    const raw = await AsyncStorage.getItem(SMART_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveSmartState(state) {
  await AsyncStorage.setItem(SMART_STATE_KEY, JSON.stringify(state));
}

function isRainRightNow(weather) {
  const code = weather?.current?.weatherCode;
  return code != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);
}

function isSwimmingWeather(weather) {
  const feelsLike = weather?.current?.feelsLike ?? weather?.current?.temp ?? null;
  return feelsLike != null && feelsLike >= 34;
}

function isGoodWalkWeather(weather) {
  const feelsLike = weather?.current?.feelsLike ?? weather?.current?.temp ?? null;
  return feelsLike != null && feelsLike >= 18 && feelsLike <= 31;
}

function summarizeConditions({ aqi, weather }) {
  const temp = weather?.current?.temp ?? null;
  const feelsLike = weather?.current?.feelsLike ?? temp;

  if (aqi == null || temp == null) {
    return 'Use the live cards before leaving; if anything is elevated, keep the first trip short.';
  }

  if (isRainRightNow(weather)) {
    return `Rain is active with temperatures near ${Math.round(temp)}°C. Carry rain gear and leave extra road margin.`;
  }

  if (aqi <= 50 && isGoodWalkWeather(weather)) {
    return `This is a good outdoor window: clean air and feels-like ${Math.round(feelsLike)}°C. Still take water if you will be out long.`;
  }

  if (aqi <= 100 && isGoodWalkWeather(weather)) {
    return `Outdoor plans are workable with AQI ${aqi} and feels-like ${Math.round(feelsLike)}°C. Keep effort moderate near traffic.`;
  }

  if (isSwimmingWeather(weather)) {
    return `Heat is the main factor, with feels-like near ${Math.round(feelsLike)}°C. Prefer shade, water, or an indoor/cooler plan.`;
  }

  if (aqi > 100) {
    return `AQI is ${aqi}. Keep outdoor exposure lighter and use a mask if you will be outside for long.`;
  }

  return `It feels like ${Math.round(feelsLike)}°C outside. Check heat, rain, and AQI before choosing timing.`;
}

function computeOutdoorScore({ steps, aqi, weather }) {
  const temp = weather?.current?.temp ?? null;
  const isRain = isRainRightNow(weather);

  let aqiScore = 0;
  if (aqi <= 50) aqiScore = 4;
  else if (aqi <= 100) aqiScore = 3;
  else if (aqi <= 150) aqiScore = 2;
  else if (aqi <= 200) aqiScore = 1;

  let weatherScore = 0;
  if (!isRain && temp != null && temp >= 18 && temp <= 32) weatherScore = 4;
  else if (!isRain && temp != null && temp >= 15 && temp <= 38) weatherScore = 3;
  else if (!isRain && temp != null) weatherScore = 2;
  else weatherScore = 1;

  let activityScore = 0;
  if (steps < 1000) activityScore = 2;
  else if (steps < 3000) activityScore = 1.5;
  else if (steps < 5000) activityScore = 1;

  return Math.max(0, Math.min(10, Math.round((aqiScore + weatherScore + activityScore) * 10) / 10));
}

function buildWalkNudgeMessage(steps, weather, aqi) {
  const temp = Math.round(weather?.current?.temp ?? 0);
  const feelsLike = Math.round(weather?.current?.feelsLike ?? temp);
  const remaining = Math.max(0, DAILY_STEP_GOAL - steps);

  if (steps < 1000) {
    return {
      title: 'Good window for easy movement',
      body: `Air is clean at AQI ${aqi} and it feels like ${feelsLike}°C. A short, easy walk is a good choice if you want to get moving.`,
    };
  }

  if (steps < 3000) {
    return {
      title: 'Short walk window',
      body: `You have ${steps.toLocaleString()} steps so far. Conditions still look usable, so keep it light and choose a cleaner, shaded route.`,
    };
  }

  return {
    title: 'Easy finish if you want it',
    body: `${remaining.toLocaleString()} steps remain for today’s goal. Conditions look usable, so a short loop is enough; no need to push hard.`,
  };
}

function buildAlternativeNudgeMessage(weather, aqi) {
  const temp = Math.round(weather?.current?.temp ?? 0);
  const feelsLike = Math.round(weather?.current?.feelsLike ?? temp);

  if (aqi != null && aqi >= 100) {
    return {
      title: 'Shift movement indoors',
      body: `AQI is ${aqi}, so keep outdoor movement brief. A treadmill, gym session, or indoor stretch is the better call right now.`,
    };
  }

  if (isSwimmingWeather(weather)) {
    return {
      title: 'Avoid the hot window',
      body: `It feels like ${feelsLike}°C outside. Prefer swimming, indoor movement, or save the walk for a cooler hour.`,
    };
  }

  if (isRainRightNow(weather)) {
    return {
      title: 'Rainy movement advisory',
      body: 'Rain is active right now. Keep outdoor errands short, or use an indoor workout until the weather settles.',
    };
  }

  return null;
}

function buildSmartSuggestion({ steps, weather, aqi }) {
  if (steps >= DAILY_STEP_GOAL) return null;

  const walkWindow = aqi != null && aqi < 100 && !isRainRightNow(weather) && isGoodWalkWeather(weather);
  if (walkWindow) {
    return {
      ...buildWalkNudgeMessage(steps, weather, aqi),
      tag: 'smart-walk',
    };
  }

  const alternative = buildAlternativeNudgeMessage(weather, aqi);
  if (alternative) {
    return {
      ...alternative,
      tag: 'smart-alt',
    };
  }

  return null;
}

async function maybeSendDailySummary({ prefs, locationLabel, aqi, weather, state, now, promptForPermission }) {
  if (!prefs.dailySummary) return false;

  const currentHour = hourOfDay(now);
  const today = dateKey(now);
  if (currentHour < MORNING_SUMMARY_HOUR_START || currentHour >= MORNING_SUMMARY_HOUR_END) {
    return false;
  }
  if (state.lastDailySummaryDay === today) return false;

  const title = `${locationLabel} morning summary`;
  const body = summarizeConditions({ aqi, weather });

  const sent = await sendSmartNotification(title, body, {
    category: 'Summary',
    promptForPermission,
  });
  if (!sent) return false;

  await saveSmartState({
    ...state,
    lastDailySummaryDay: today,
  });
  return true;
}

export async function runSmartAdvisorCheck({ reason = 'manual', promptForHealth = false } = {}) {
  const prefs = await loadStoredNotifications();
  const locationSnapshot = await loadLocationSnapshot();
  if (!locationSnapshot?.lat || !locationSnapshot?.lon) {
    return { sent: false, reason: 'no-location' };
  }

  const [health, aqiPayload, weather, state] = await Promise.all([
    getTodayHealthSnapshot({ force: true, prompt: promptForHealth }),
    fetchAqiForLocation(locationSnapshot.lat, locationSnapshot.lon, { force: true }),
    fetchWeatherForLocation(locationSnapshot.lat, locationSnapshot.lon),
    loadSmartState(),
  ]);

  const aqi = aqiPayload?.aqi ?? null;
  const now = new Date();
  const locationLabel = locationSnapshot.city || 'your area';

  const summarySent = await maybeSendDailySummary({
    prefs,
    locationLabel,
    aqi,
    weather,
    state,
    now,
    promptForPermission: reason !== 'background',
  });

  // Tier 3: fire push immediately for Extreme/Severe CAP alerts
  const capResult = await maybeSendCapAlert({ state, prefs });
  if (capResult?.sentTitles) {
    await saveSmartState({ ...state, sentCapAlerts: capResult.sentTitles });
  }

  const smartWalkEnabled = prefs.smartWalkNudges !== false;
  if (!smartWalkEnabled) {
    return { sent: summarySent, reason: 'smart-walk-disabled', health, aqi, weather };
  }

  if (!health?.authorized) {
    return { sent: summarySent, reason: 'health-unavailable', health, aqi, weather };
  }

  const steps = health.steps || 0;
  const temp = weather?.current?.temp ?? null;
  const feelsLike = weather?.current?.feelsLike ?? temp;
  const currentHour = hourOfDay(now);
  const isWithinHours = currentHour >= 6 && currentHour < 20;
  const recentlySent =
    state.lastWalkNudgeAt != null &&
    now.getTime() - state.lastWalkNudgeAt < WALK_NUDGE_COOLDOWN_MS;

  const suggestion = buildSmartSuggestion({ steps, weather, aqi });
  const underStepGoal = steps < DAILY_STEP_GOAL;
  const hasUsableWeather = temp != null || feelsLike != null;

  if (!underStepGoal || !isWithinHours || recentlySent || !hasUsableWeather || !suggestion) {
    return {
      sent: summarySent,
      reason: 'conditions-not-met',
      health,
      aqi,
      weather,
      outdoorScore: computeOutdoorScore({ steps, aqi, weather }),
    };
  }

  const sent = await sendSmartNotification(suggestion.title, suggestion.body, {
    category: 'Smart',
    tag: `${suggestion.tag}-${dateKey(now)}`,
    promptForPermission: reason !== 'background',
  });

  if (!sent) {
    return { sent: summarySent, reason: 'notification-not-sent', health, aqi, weather };
  }

  await saveSmartState({
    ...state,
    lastWalkNudgeAt: now.getTime(),
  });

  return {
    sent: true,
    reason,
    health,
    aqi,
    weather,
    outdoorScore: computeOutdoorScore({ steps, aqi, weather }),
  };
}

export async function getSmartAdvisorSnapshot({ promptForHealth = false } = {}) {
  const locationSnapshot = await loadLocationSnapshot();
  if (!locationSnapshot?.lat || !locationSnapshot?.lon) {
    return {
      locationLabel: 'Location unavailable',
      steps: 0,
      distanceKm: 0,
      calories: 0,
      aqi: null,
      weather: null,
      outdoorScore: 0,
      notificationsReady: false,
      healthStatus: 'unavailable',
    };
  }

  const [health, aqiPayload, weather] = await Promise.all([
    getTodayHealthSnapshot({ prompt: promptForHealth }),
    fetchAqiForLocation(locationSnapshot.lat, locationSnapshot.lon, {}),
    fetchWeatherForLocation(locationSnapshot.lat, locationSnapshot.lon),
  ]);
  const notificationState = await getNotificationDeliveryState();

  const aqi = aqiPayload?.aqi ?? null;

  return {
    locationLabel: locationSnapshot.city || 'Selected',
    steps: health.steps || 0,
    distanceKm: health.distanceKm || 0,
    calories: health.calories || 0,
    aqi,
    weather,
    outdoorScore: computeOutdoorScore({ steps: health.steps || 0, aqi, weather }),
    notificationsReady: notificationState.granted,
    healthStatus: health.status,
    healthAuthorized: health.authorized,
  };
}
