import { listNativeDevices, sendNativePush } from './nativePush.js';
import { kvGetJson, kvSetJson } from './kv.js';

const ALERT_STATE_KEY = 'push:alert-engine:state';
const PMD_RSS_URL = 'https://cap-sources.s3.amazonaws.com/pk-pmd-en/rss.xml';
const DAILY_SUMMARY_START_HOUR = 6;
const DAILY_SUMMARY_END_HOUR = 10;
const NON_CRITICAL_DAILY_LIMIT = 2;

// WMO codes for weather-based alerts
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const RAIN_CODES         = new Set([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82]);
const HEAVY_RAIN_CODES   = new Set([63, 65, 67, 81, 82]);

export async function runAlertEngine({ mode = 'scheduled' } = {}) {
  const [devices, state] = await Promise.all([
    listNativeDevices(),
    loadState(),
  ]);

  const activeDevices = devices.filter((device) => device?.expoPushToken);
  if (!activeDevices.length) {
    return { mode, devices: 0, sent: 0, results: [] };
  }

  const results = [];
  const pmdResult       = await sendPmdCriticalAlerts(activeDevices, state);
  if (pmdResult)       results.push(pmdResult);

  const aqiResult       = await sendSevereAqiAlerts(activeDevices, state);
  if (aqiResult)       results.push(aqiResult);

  const windResult      = await sendWindAlerts(activeDevices, state);
  if (windResult)      results.push(windResult);

  const stormResult     = await sendThunderstormAlerts(activeDevices, state);
  if (stormResult)     results.push(stormResult);

  const rainResult      = await sendRainAlerts(activeDevices, state);
  if (rainResult)      results.push(rainResult);

  const summaryResult   = await sendMorningSummaries(activeDevices, state);
  if (summaryResult)   results.push(summaryResult);

  state.lastRunAt = Date.now();
  await saveState(state);

  return {
    mode,
    devices: activeDevices.length,
    sent: results.reduce((sum, result) => sum + (result.sent || 0), 0),
    results,
  };
}

// ─── Wind alerts ──────────────────────────────────────────────────────────────
async function sendWindAlerts(devices, state) {
  const candidates = devices.filter((d) => {
    const prefs = d.preferences || {};
    return prefs.windAlerts !== false && d.location?.lat != null;
  });
  if (!candidates.length) return null;

  let sent = 0;
  state.sentWindAlerts = state.sentWindAlerts || {};

  for (const device of candidates) {
    const wx = await fetchWeatherForAlerts(device.location.lat, device.location.lon);
    if (!wx) continue;

    const gusts = wx.windGusts;
    const speed = wx.windSpeed;
    const threshold = Number(device.thresholds?.windAlert || 60); // km/h

    if (!isWindy(wx, threshold)) continue;

    const key = `${device.expoPushToken}:wind:${pakistanDateKey(new Date())}`;
    if (Date.now() - (state.sentWindAlerts[key] || 0) < 3 * 60 * 60 * 1000) continue;

    const isSevere = gusts >= 80 || speed >= 70;
    const city = device.location?.city || 'your area';
    const { title, body } = buildWindCopy(city, Math.round(speed), Math.round(gusts), isSevere);
    const response = await sendNativePush([device], {
      id: key,
      title,
      body,
      category: 'Wind',
      source: 'weather-wind',
      url: 'https://outdooradvisor.app',
      data: { windSpeed: speed, windGusts: gusts },
      priority: isSevere ? 'high' : 'normal',
    });

    sent += response.attempted;
    state.sentWindAlerts[key] = Date.now();
    if (!isSevere) incrementNonCritical(state, device.expoPushToken, pakistanDateKey(new Date()));
  }

  return sent ? { type: 'wind', sent } : null;
}

// ─── Thunderstorm alerts ──────────────────────────────────────────────────────
async function sendThunderstormAlerts(devices, state) {
  const candidates = devices.filter((d) => {
    const prefs = d.preferences || {};
    return prefs.thunderstormAlerts !== false && d.location?.lat != null;
  });
  if (!candidates.length) return null;

  let sent = 0;
  state.sentStormAlerts = state.sentStormAlerts || {};

  for (const device of candidates) {
    const wx = await fetchWeatherForAlerts(device.location.lat, device.location.lon);
    if (!wx) continue;

    if (!isThunderstorm(wx)) continue;

    const key = `${device.expoPushToken}:storm:${pakistanDateKey(new Date())}`;
    if (Date.now() - (state.sentStormAlerts[key] || 0) < 4 * 60 * 60 * 1000) continue;

    const city = device.location?.city || 'your area';
    const { title, body } = buildStormCopy(city);
    const response = await sendNativePush([device], {
      id: key,
      title,
      body,
      category: 'Weather',
      source: 'weather-storm',
      url: 'https://outdooradvisor.app',
      data: { weatherCode: wx.weatherCode },
      priority: 'high',
    });

    sent += response.attempted;
    state.sentStormAlerts[key] = Date.now();
  }

  return sent ? { type: 'thunderstorm', sent } : null;
}

// ─── Rain alerts ──────────────────────────────────────────────────────────────
async function sendRainAlerts(devices, state) {
  const candidates = devices.filter((d) => {
    const prefs = d.preferences || {};
    return prefs.rainAlerts !== false && d.location?.lat != null;
  });
  if (!candidates.length) return null;

  let sent = 0;
  state.sentRainAlerts = state.sentRainAlerts || {};

  for (const device of candidates) {
    const wx = await fetchWeatherForAlerts(device.location.lat, device.location.lon);
    if (!wx) continue;

    if (!isRaining(wx)) continue;

    const key = `${device.expoPushToken}:rain:${pakistanDateKey(new Date())}`;
    if (Date.now() - (state.sentRainAlerts[key] || 0) < 4 * 60 * 60 * 1000) continue;

    if (!canSendNonCriticalToday(state, device.expoPushToken, pakistanDateKey(new Date()))) continue;

    const isHeavy = isHeavyRain(wx);
    const city = device.location?.city || 'your area';
    const precip = wx.precipitation ?? null;
    const { title, body } = buildRainCopy(city, isHeavy, precip);
    const response = await sendNativePush([device], {
      id: key,
      title,
      body,
      category: 'Weather',
      source: 'weather-rain',
      url: 'https://outdooradvisor.app',
      data: { weatherCode: wx.weatherCode, precipitation: precip },
      priority: isHeavy ? 'high' : 'normal',
    });

    sent += response.attempted;
    state.sentRainAlerts[key] = Date.now();
    incrementNonCritical(state, device.expoPushToken, pakistanDateKey(new Date()));
  }

  return sent ? { type: 'rain', sent } : null;
}

// ─── Personalised copy builders ───────────────────────────────────────────────
function buildWindCopy(city, speed, gusts, isSevere) {
  if (isSevere) {
    return {
      title: `Wind advisory for ${city}`,
      body: `Gusts near ${gusts} km/h can make exposed routes messy. Delay non-essential outdoor plans, secure loose items, and keep away from trees and signboards.`,
    };
  }
  return {
    title: `Breezy window in ${city}`,
    body: `Winds are around ${speed} km/h with gusts near ${gusts} km/h. Choose sheltered routes and skip umbrella-heavy errands if you can wait.`,
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
    body: lines[Math.floor(Math.random() * lines.length)],
  };
}

function buildRainCopy(city, isHeavy, precip) {
  if (isHeavy) {
    return {
      title: `Heavy rain advisory for ${city}`,
      body: `Heavy rain is active${precip != null ? ` (${precip} mm)` : ''}. Delay non-essential trips, slow down on wet roads, and avoid low-lying water.`,
    };
  }
  const lines = [
    `Rain is active in ${city}. Keep outdoor plans short and take rain gear if you need to leave.`,
    `Wet roads are likely around ${city}. Leave extra braking distance and avoid rushing errands.`,
    `Light rain is around ${city}. Pick covered routes and keep a little extra travel time.`,
  ];
  return {
    title: `Rain advisory for ${city}`,
    body: lines[Math.floor(Math.random() * lines.length)],
  };
}

// ─── Weather fetch: WeatherKit first, Open-Meteo fallback ────────────────────
// Returns a normalised shape:
// { windSpeed, windGusts, weatherCode, conditionCode, precipitation, nativeAlerts }
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
      windSpeed:              c.windSpeed              ?? 0,
      windGusts:              c.windGusts              ?? 0,
      weatherCode:            c.weatherCode            ?? 0,
      conditionCode:          c.conditionCode          ?? null,
      precipitation:          null,
      precipitationIntensity: c.precipitationIntensity ?? null,
      nativeAlerts:           json.alerts              ?? [],
      source:                 'WeatherKit',
    };
  } catch {
    return null;
  }
}

async function fetchOpenMeteoNormalised(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,wind_speed_10m,wind_gusts_10m,precipitation&wind_speed_unit=kmh&forecast_days=1`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const json = await response.json();
    if (!json?.current) return null;
    const c = json.current;
    return {
      windSpeed:     c.wind_speed_10m  ?? 0,
      windGusts:     c.wind_gusts_10m  ?? 0,
      weatherCode:   c.weather_code    ?? 0,
      conditionCode: null,
      precipitation: c.precipitation   ?? null,
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

async function sendSevereAqiAlerts(devices, state) {
  const candidates = devices.filter((device) => {
    const prefs = device.preferences || {};
    return prefs.severeAqiWarnings !== false && device.location?.lat != null && device.location?.lon != null;
  });
  if (!candidates.length) return null;

  let sent = 0;
  state.sentAqiAlerts = state.sentAqiAlerts || {};

  for (const device of candidates) {
    const aqi = await fetchAqi(device.location.lat, device.location.lon);
    if (aqi?.aqi == null) continue;

    const threshold = Number(device.thresholds?.aqiAlert || 150);
    if (aqi.aqi < threshold) continue;

    const band = getAqiBand(aqi.aqi);
    const key = `${device.expoPushToken}:${pakistanDateKey(new Date())}:${band}`;
    const lastSent = state.sentAqiAlerts[key] || 0;
    if (Date.now() - lastSent < 4 * 60 * 60 * 1000) continue;

    if (band !== 'hazardous' && !canSendNonCriticalToday(state, device.expoPushToken, pakistanDateKey(new Date()))) {
      continue;
    }

    const response = await sendNativePush([device], {
      id: key,
      title: band === 'hazardous' ? 'Hazardous AQI Alert' : 'Severe AQI Warning',
      body: buildAqiBody(aqi, device.location.city || 'your area'),
      category: 'AQI',
      source: 'google-aqi',
      url: 'https://outdooradvisor.app',
      data: { aqi: aqi.aqi, pm25: aqi.pm25 ?? null, band },
      priority: 'high',
    });

    sent += response.attempted;
    state.sentAqiAlerts[key] = Date.now();
    if (band !== 'hazardous') incrementNonCritical(state, device.expoPushToken, pakistanDateKey(new Date()));
  }

  return sent ? { type: 'severe-aqi', sent } : null;
}

async function sendPmdCriticalAlerts(devices, state) {
  const alerts = await fetchCriticalPmdAlerts();
  if (!alerts.length) return null;

  let sent = 0;
  const sentKeys = state.sentPmdAlerts || {};
  const now = Date.now();

  for (const alert of alerts) {
    const key = alert.key;
    if (sentKeys[key] && now - sentKeys[key] < 12 * 60 * 60 * 1000) continue;

    const matched = devices.filter((device) => {
      const prefs = device.preferences || {};
      if (prefs.thunderstormAlerts === false && /thunder|storm|lightning/i.test(alert.title)) return false;
      if (prefs.rainAlerts === false && /rain|flood/i.test(alert.title)) return false;
      if (prefs.severeAqiWarnings === false) return false;
      return regionMatchesDevice(alert, device);
    });

    if (!matched.length) {
      sentKeys[key] = now;
      continue;
    }

    const response = await sendNativePush(matched, {
      id: key,
      title: alert.severity === 'Extreme' ? 'PMD Extreme Weather Alert' : 'PMD Weather Warning',
      body: truncate(alert.title, 118),
      category: 'Weather',
      source: 'pmd-cap',
      url: 'https://outdooradvisor.app',
      data: { alertKey: key, severity: alert.severity },
      priority: 'high',
    });

    sent += response.attempted;
    sentKeys[key] = now;
  }

  state.sentPmdAlerts = sentKeys;
  return sent ? { type: 'pmd-critical', sent } : null;
}

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
    return `Air in ${city} is hazardous right now (AQI ${aqi.aqi}).${pm25} Stay indoors, keep windows shut, and wear an N95 if you really must go out.`;
  }
  if (aqi.aqi >= 200) {
    return `Very unhealthy air in ${city} (AQI ${aqi.aqi}).${pm25} Limit outdoor time and avoid any physical activity outside.`;
  }
  return `Air quality is unhealthy in ${city} (AQI ${aqi.aqi}).${pm25} Keep outdoor time short, choose lighter activity, and use a mask if you will be out for long.`;
}

async function sendMorningSummaries(devices, state) {
  const now = new Date();
  const hour = hourInPakistan(now);
  if (hour < DAILY_SUMMARY_START_HOUR || hour >= DAILY_SUMMARY_END_HOUR) return null;

  const day = pakistanDateKey(now);
  let sent = 0;
  const summaries = state.sentDailySummaries || {};

  const candidates = devices.filter((device) => {
    const prefs = device.preferences || {};
    if (prefs.dailySummary === false) return false;
    if (summaries[device.expoPushToken] === day) return false;
    return canSendNonCriticalToday(state, device.expoPushToken, day);
  });

  if (!candidates.length) return null;

  for (const device of candidates) {
    const city = device.location?.city || 'your area';
    const hour = hourInPakistan(new Date());
    const timeGreeting = hour < 8 ? 'Early morning check' : 'Good morning';
    const response = await sendNativePush([device], {
      id: `${device.expoPushToken}:daily-summary:${day}`,
      title: `${timeGreeting} - ${city} outdoor advisory`,
      body: 'Before you head out, recheck AQI, heat, rain, and road signals. Adjust timing or route if any card looks elevated.',
      category: 'Summary',
      source: 'daily-summary',
      url: 'https://outdooradvisor.app',
      data: { day },
      priority: 'normal',
    });
    sent += response.attempted;
    summaries[device.expoPushToken] = day;
    incrementNonCritical(state, device.expoPushToken, day);
  }

  state.sentDailySummaries = summaries;
  return sent ? { type: 'daily-summary', sent } : null;
}

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
      if (age > 24 * 60 * 60 * 1000) continue;
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
  const city = device.location?.city || '';
  if (!city || /^selected$/i.test(city)) return true;
  if (alert.regions.some((region) => /punjab|sindh|balochistan|khyber|ajk|azad/i.test(region))) {
    return true;
  }
  return alert.regions.some((region) => city.toLowerCase().includes(region.toLowerCase()) || region.toLowerCase().includes(city.toLowerCase()));
}

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

function hourInPakistan(date) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    hour12: false,
  }).format(date));
}

function pakistanDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function loadState() {
  return (await kvGetJson(ALERT_STATE_KEY)) || {};
}

async function saveState(state) {
  await kvSetJson(ALERT_STATE_KEY, state);
}

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
