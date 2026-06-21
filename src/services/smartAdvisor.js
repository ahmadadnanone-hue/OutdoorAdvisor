import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayHealthSnapshot } from '../hooks/useHealthData';
import { fetchAqiForLocation } from '../hooks/useAQI';
import { fetchWeatherForLocation } from '../hooks/useWeather';
import { loadStoredNotifications } from '../utils/alertPreferences';
import { loadLocationSnapshot } from '../utils/locationSnapshot';
import { getNotificationDeliveryState } from './notificationService';

const SMART_STATE_KEY = 'outdooradvisor_smart_advisor_state_v1';
const WALK_NUDGE_COOLDOWN_MS    = 4 * 60 * 60 * 1000;

let _advisorRunning = false;
const DAILY_STEP_GOAL            = 5000;

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

function isHeavyRainRightNow(weather) {
  const code = weather?.current?.weatherCode;
  return code != null && [65, 82].includes(code);
}

function isThunderstormRightNow(weather) {
  const code = weather?.current?.weatherCode;
  return code != null && [95, 96, 99].includes(code);
}

function isSwimmingWeather(weather) {
  const feelsLike = weather?.current?.feelsLike ?? weather?.current?.temp ?? null;
  return feelsLike != null && feelsLike >= 34;
}

function isGoodWalkWeather(weather) {
  const feelsLike = weather?.current?.feelsLike ?? weather?.current?.temp ?? null;
  return feelsLike != null && feelsLike >= 18 && feelsLike <= 31;
}

function computeOutdoorScore({ steps, aqi, weather }) {
  const temp = weather?.current?.feelsLike ?? weather?.current?.temp ?? null;
  const isRain = isRainRightNow(weather);
  const isHeavyRain = isHeavyRainRightNow(weather);
  const isStorm = isThunderstormRightNow(weather);

  let aqiScore = 0;
  if (aqi <= 50) aqiScore = 4;
  else if (aqi <= 100) aqiScore = 3;
  else if (aqi <= 150) aqiScore = 2;
  else if (aqi <= 200) aqiScore = 1;

  let weatherScore = 0;
  if (isStorm) weatherScore = 0;
  else if (isHeavyRain) weatherScore = 0.5;
  else if (isRain) weatherScore = 1;
  else if (temp != null && temp >= 18 && temp <= 32) weatherScore = 4;
  else if (temp != null && temp >= 15 && temp <= 38) weatherScore = 3;
  else if (temp != null) weatherScore = 2;
  else weatherScore = 1;

  let activityScore = 0;
  if (steps < 1000) activityScore = 2;
  else if (steps < 3000) activityScore = 1.5;
  else if (steps < 5000) activityScore = 1;

  const raw = Math.max(0, Math.min(10, Math.round((aqiScore + weatherScore + activityScore) * 10) / 10));
  if (isStorm) return Math.min(raw, 2);
  if (isHeavyRain) return Math.min(raw, 4);
  if (isRain) return Math.min(raw, 6);
  return raw;
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

  const walkWindow = aqi != null && aqi < 100 && !isThunderstormRightNow(weather) && !isRainRightNow(weather) && isGoodWalkWeather(weather);
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

export async function runSmartAdvisorCheck({ reason = 'manual', promptForHealth = false } = {}) {
  if (_advisorRunning) return { sent: false, reason: 'already-running' };
  _advisorRunning = true;
  try {
    return await _runSmartAdvisorCheck({ reason, promptForHealth });
  } finally {
    _advisorRunning = false;
  }
}

async function _runSmartAdvisorCheck({ reason = 'manual', promptForHealth = false } = {}) {
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
  // Weather, AQI, PMD, NDMA, rain, wind, and route alerts are owned by the
  // server alert engine. Keeping the on-device advisor focused on movement
  // nudges prevents duplicate pushes when the app opens after a server alert.

  const smartWalkEnabled = prefs.smartWalkNudges !== false;
  if (!smartWalkEnabled) {
    return { sent: false, reason: 'smart-walk-disabled', health, aqi, weather };
  }

  if (!health?.authorized) {
    return { sent: false, reason: 'health-unavailable', health, aqi, weather };
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
      sent: false,
      reason: 'conditions-not-met',
      health,
      aqi,
      weather,
      outdoorScore: computeOutdoorScore({ steps, aqi, weather }),
    };
  }

  await saveSmartState({
    ...state,
    lastWalkNudgeAt: now.getTime(),
  });

  return {
    sent: false,
    reason,
    suppressed: 'routine-smart-nudge',
    suggestion,
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
