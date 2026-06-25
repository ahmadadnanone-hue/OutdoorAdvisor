import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { derivePremiumState } from '../../src/lib/premium.js';
import {
  buildAskFallback,
  buildAskContext,
  buildAskPrompt,
  deriveAskVerdict,
  isAskAdvisoryFresh,
  isOutdoorQuestion,
  inferNhmpRoutePlan,
  matchNhmpRouteItems,
  matchOfficialItems,
  normalizeQuestion,
} from '../_lib/askOutdoorAdvisor.js';
import { kvCommand } from '../_lib/kv.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const ASK_DAILY_LIMIT = 10;
const ASK_TIME_ZONE = 'Asia/Karachi';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePremiumEmailAllowlist(input) {
  return String(input || '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function getSupabaseServerClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getRequestPremiumState(req) {
  const authHeader = req.headers?.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  const allowlistedEmails = parsePremiumEmailAllowlist(process.env.PREMIUM_EMAILS);

  if (!token) {
    return { isPremium: false, plan: 'free', userId: null, email: null };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { isPremium: false, plan: 'free', userId: null, email: null };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { isPremium: false, plan: 'free', userId: null, email: null };
    }
    const premiumState = derivePremiumState(data.user);
    const email = normalizeEmail(data.user.email);
    const userId = data.user.id || null;
    if (email && allowlistedEmails.includes(email)) {
      return { isPremium: true, plan: 'premium', userId, email };
    }
    return { ...premiumState, userId, email };
  } catch {
    return { isPremium: false, plan: 'free', userId: null, email: null };
  }
}

function getPakistanDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ASK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getNextPakistanMidnightIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const nextNoonUtc = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day) + 1,
    12,
    0,
    0
  ));
  const nextParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(nextNoonUtc).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${nextParts.year}-${nextParts.month}-${nextParts.day}T00:00:00+05:00`;
}

function getRequestIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function stableHash(value) {
  return createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 24);
}

async function consumeAskQuota(req, premiumState) {
  const subject = premiumState.userId || premiumState.email || `ip:${getRequestIp(req)}`;
  const dayKey = getPakistanDayKey();
  const key = `ask:quota:${dayKey}:${stableHash(subject)}`;
  const count = Number(await kvCommand(['INCR', key]));
  if (count === 1) {
    await kvCommand(['EXPIRE', key, 60 * 60 * 48]).catch(() => null);
  }
  return {
    limit: ASK_DAILY_LIMIT,
    used: Number.isFinite(count) ? count : ASK_DAILY_LIMIT,
    remaining: Math.max(0, ASK_DAILY_LIMIT - (Number.isFinite(count) ? count : ASK_DAILY_LIMIT)),
    allowed: Number.isFinite(count) && count <= ASK_DAILY_LIMIT,
    resetAt: getNextPakistanMidnightIso(),
  };
}

function extractTextFromResponse(json) {
  return (
    json?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join('')
      .trim() || ''
  );
}

function tryParseJson(text) {
  if (!text) return null;
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // Try 1: direct parse
  try { return JSON.parse(stripped); } catch {}

  // Try 2: replace literal newlines inside the text (Gemini sometimes emits bare \n in strings)
  const oneLiner = stripped.replace(/\r?\n/g, ' ');
  try { return JSON.parse(oneLiner); } catch {}

  // Try 3: extract first { ... } block and retry both forms
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = stripped.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
    try { return JSON.parse(slice.replace(/\r?\n/g, ' ')); } catch {}
  }

  return null;
}

function homeFallback(data) {
  const headline =
    data.decisionLabel === 'Better to limit exposure'
      ? 'Today needs a more careful plan.'
      : data.decisionLabel === 'Go with care'
      ? 'Most plans are still workable with a few adjustments.'
      : 'This looks like a comfortable outdoor window.';

  const summaryBits = [];
  if (data.aqi != null) summaryBits.push(`AQI is ${data.aqi}`);
  if (data.weatherLabel) summaryBits.push(`conditions are ${data.weatherLabel.toLowerCase()}`);
  if (data.feelsLike != null) summaryBits.push(`feels like ${Math.round(data.feelsLike)}°C`);
  if (data.humidity != null) summaryBits.push(`humidity is ${data.humidity}%`);
  if (data.pollenLabel) summaryBits.push(`${data.pollenLabel.toLowerCase()} pollen is present`);

  const tip =
    data.decisionLabel === 'Better to limit exposure'
      ? 'Keep outdoor time brief, avoid hard exertion, and use protection that matches the main risk.'
      : data.decisionLabel === 'Go with care'
      ? 'Go out if you need to, but choose shorter sessions, a better time window, and simple protection like shade, rain gear, or a mask.'
      : 'This is a good time for regular outdoor plans, especially lighter activity and errands.';

  return {
    provider: 'fallback',
    headline,
    summary: summaryBits.length
      ? `${data.locationName || 'Your area'} looks manageable because ${summaryBits.join(', ')}.`
      : `${data.locationName || 'Your area'} looks manageable for outdoor plans right now.`,
    tip,
  };
}

function travelFallback(data) {
  const hasClosures = (data.closureCount || 0) > 0;
  const hasFog = (data.fogCount || 0) > 0;
  const hasPmd = (data.pmdAlertCount || 0) > 0;
  const focusRouteName = data.focusRoute?.name;

  const headline = hasClosures
    ? 'Travel needs a route check first.'
    : hasFog || hasPmd
    ? 'Trips are still possible, but timing matters.'
    : 'Major routes look mostly workable right now.';

  const routeText = focusRouteName
    ? `${focusRouteName} is the route to watch.`
    : 'Check the route cards below before you leave.';

  const summaryParts = [];
  if (hasClosures) summaryParts.push(`${data.closureCount} closure alert${data.closureCount > 1 ? 's are' : ' is'} active`);
  if (hasFog) summaryParts.push(`${data.fogCount} fog advisory${data.fogCount > 1 ? 'ies are' : ' is'} active`);
  if (hasPmd) summaryParts.push(`PMD has ${data.pmdAlertCount} corridor weather alert${data.pmdAlertCount > 1 ? 's' : ''}`);

  const tip = hasClosures
    ? 'Recheck NHMP before motorway travel and expect slower movement or diversions.'
    : hasFog
    ? 'Leave more margin, drive slower, and favor daylight windows if you can.'
    : hasPmd
    ? 'Roads may still be open, but weather can change quickly on northern corridors.'
    : 'Use the live stop scan below to confirm weather and AQI along your route.';

  return {
    provider: 'fallback',
    headline,
    summary: summaryParts.length ? `${summaryParts.join('. ')}. ${routeText}` : routeText,
    tip,
  };
}

// ─── Synthesis: server-side data fetchers ─────────────────────────────────────

const WMO_LABELS = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  80:'Light showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm',
};
const UV_LABELS = ['Low','Low','Low','Moderate','Moderate','Moderate','High','High','Very High','Very High','Extreme','Extreme'];
const KNOWN_DESTINATION_COORDS = {
  islamabad: { name: 'Islamabad, Pakistan', lat: 33.6844, lon: 73.0479 },
  rawalpindi: { name: 'Rawalpindi, Pakistan', lat: 33.5651, lon: 73.0169 },
  lahore: { name: 'Lahore, Pakistan', lat: 31.5204, lon: 74.3587 },
  multan: { name: 'Multan, Pakistan', lat: 30.1575, lon: 71.5249 },
  murree: { name: 'Murree, Pakistan', lat: 33.907, lon: 73.3943 },
  muree: { name: 'Murree, Pakistan', lat: 33.907, lon: 73.3943 },
  skardu: { name: 'Skardu, Pakistan', lat: 35.2971, lon: 75.6333 },
  hunza: { name: 'Hunza, Pakistan', lat: 36.3167, lon: 74.65 },
  gilgit: { name: 'Gilgit, Pakistan', lat: 35.9208, lon: 74.3144 },
  karachi: { name: 'Karachi, Pakistan', lat: 24.8607, lon: 67.0011 },
  peshawar: { name: 'Peshawar, Pakistan', lat: 34.0151, lon: 71.5249 },
  faisalabad: { name: 'Faisalabad, Pakistan', lat: 31.4504, lon: 73.135 },
  'nathia gali': { name: 'Nathia Gali, Pakistan', lat: 34.0729, lon: 73.3813 },
  nathiagali: { name: 'Nathia Gali, Pakistan', lat: 34.0729, lon: 73.3813 },
  naran: { name: 'Naran, Pakistan', lat: 34.907, lon: 73.649 },
  kalam: { name: 'Kalam, Pakistan', lat: 35.4902, lon: 72.5796 },
};
function uvLabel(v) { return UV_LABELS[Math.min(Math.round(v || 0), UV_LABELS.length - 1)]; }
function aqiCat(n) {
  if (n == null) return null;
  if (n <= 50)  return 'Good';
  if (n <= 100) return 'Moderate';
  if (n <= 150) return 'Unhealthy for Sensitive Groups';
  if (n <= 200) return 'Unhealthy';
  if (n <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

async function fetchOpenMeteo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index,precipitation` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=10`;
  const r = await withTimeout(fetch(url), 8000);
  if (!r.ok) throw new Error('Open-Meteo error');
  return r.json();
}

function getApiOrigin(req) {
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (!host) return 'https://outdooradvisor.vercel.app';
  const proto = req.headers?.['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function fetchJsonOrNull(url, options) {
  try {
    const response = await withTimeout(fetch(url, options), 10000);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function forwardGeocode(placeName, apiKey) {
  if (!placeName) return null;

  if (apiKey) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', `${placeName}, Pakistan`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'en');
    const json = await fetchJsonOrNull(url);
    const result = json?.results?.[0];
    if (result?.geometry?.location) {
      return {
        name: result.formatted_address || placeName,
        lat: result.geometry.location.lat,
        lon: result.geometry.location.lng,
      };
    }
  }

  return await forwardGeocodeOsm(placeName) || resolveKnownDestination(placeName);
}

async function forwardGeocodeOsm(placeName) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', `${placeName}, Pakistan`);
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    const response = await withTimeout(fetch(url, {
      headers: {
        'User-Agent': 'OutdoorAdvisor/1.0 (support@outdooradvisor.app)',
        'Accept-Language': 'en',
      },
    }), 8000);
    const json = await response.json();
    const result = Array.isArray(json) ? json[0] : null;
    if (!response.ok || !result?.lat || !result?.lon) return null;
    return {
      name: result.display_name || `${placeName}, Pakistan`,
      lat: Number(result.lat),
      lon: Number(result.lon),
    };
  } catch {
    return null;
  }
}

function resolveKnownDestination(placeName) {
  const normalized = String(placeName || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return KNOWN_DESTINATION_COORDS[normalized] || null;
}

async function fetchNearbyPlaces(lat, lon, query, apiKey) {
  if (!apiKey || !query) return [];
  const isBroadDiscovery = /\bcamp|camping|mountain|valley|trek|hiking\b/i.test(query);
  const response = await fetchJsonOrNull('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.shortFormattedAddress,places.location,places.googleMapsUri,places.primaryType',
    },
    body: JSON.stringify({
      textQuery: isBroadDiscovery ? `${query} Pakistan` : query,
      pageSize: 6,
      ...(isBroadDiscovery
        ? {}
        : {
            rankPreference: 'DISTANCE',
            locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: 12000 } },
          }),
    }),
  });
  return (response?.places || []).map((place) => ({
    name: place.displayName?.text || '',
    address: place.shortFormattedAddress || '',
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    lat: place.location?.latitude ?? null,
    lon: place.location?.longitude ?? null,
    mapsUrl: place.googleMapsUri || null,
    type: place.primaryType || null,
  }));
}

function decodeGooglePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < String(encoded || '').length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return points;
}

function formatRouteDuration(value) {
  const seconds = Number(String(value || '').replace(/s$/, ''));
  if (!Number.isFinite(seconds)) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

async function fetchGoogleRoute(origin, destination, apiKey) {
  if (!apiKey || !origin || !destination) return null;
  const response = await fetchJsonOrNull('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.description,routes.routeLabels',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lon } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'en',
      units: 'METRIC',
    }),
  });
  const route = response?.routes?.[0];
  if (!route) return null;
  const points = decodeGooglePolyline(route.polyline?.encodedPolyline);
  return {
    distanceMeters: route.distanceMeters ?? null,
    distanceText: Number.isFinite(route.distanceMeters) ? `${Math.round(route.distanceMeters / 1000)} km` : null,
    durationText: formatRouteDuration(route.duration),
    description: route.description || null,
    points,
  };
}

function selectRouteSamplePoints(googleRoute, origin, destination) {
  const points = googleRoute?.points || [];
  if (points.length >= 5) {
    return [0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
      const point = points[Math.min(points.length - 1, Math.round((points.length - 1) * ratio))];
      return { ...point, name: index === 0 ? origin.name : index === 4 ? destination.name : `Route checkpoint ${index}` };
    });
  }
  return [
    origin,
    { name: 'Approximate route midpoint', lat: (origin.lat + destination.lat) / 2, lon: (origin.lon + destination.lon) / 2 },
    destination,
  ];
}

function selectRouteStopPoint(googleRoute, origin, destination) {
  const samples = selectRouteSamplePoints(googleRoute, origin, destination);
  const midpoint = samples[Math.floor(samples.length / 2)];
  if (midpoint) return { ...midpoint, name: 'route midpoint' };
  return {
    name: 'approximate route midpoint',
    lat: (Number(origin.lat) + Number(destination.lat)) / 2,
    lon: (Number(origin.lon) + Number(destination.lon)) / 2,
  };
}

function summarizeAskWeather(meteo) {
  if (meteo?.current && Array.isArray(meteo?.hourly) && !meteo?.hourly?.time) {
    const current = meteo.current;
    const nearRain = meteo.hourly.slice(0, 6).map((item) => item.precipProbability).filter(Number.isFinite);
    return {
      source: meteo.source || 'WeatherKit',
      observedAt: null,
      temp: current.temp ?? null,
      feelsLike: current.feelsLike ?? null,
      humidity: current.humidity ?? null,
      windKph: current.windSpeed ?? null,
      condition: WMO_LABELS[current.weatherCode] || current.conditionCode || 'Variable',
      rainNext3h: nearRain.length ? Math.max(...nearRain.slice(0, 3)) : null,
      rainNext6h: nearRain.length ? Math.max(...nearRain) : null,
      hourly: meteo.hourly.slice(0, 72).map((item) => ({
        time: item.time,
        temp: item.temp ?? null,
        feelsLike: null,
        rainChance: item.precipProbability ?? null,
        windKph: null,
        condition: WMO_LABELS[item.weatherCode] || item.conditionCode || 'Variable',
      })),
      daily: (meteo.daily || []).slice(0, 10).map((item) => ({
        date: item.date,
        min: item.minTemp ?? null,
        max: item.maxTemp ?? null,
        rainMm: item.precipSum ?? null,
        rainChance: item.precipProbability ?? null,
        condition: WMO_LABELS[item.weatherCode] || item.conditionCode || 'Variable',
      })),
      providerAlerts: (meteo.alerts || []).slice(0, 3),
    };
  }

  const current = meteo?.current || {};
  const hourly = meteo?.hourly || {};
  const daily = meteo?.daily || {};
  const nearRain = (hourly.precipitation_probability || []).slice(0, 6);
  return {
    observedAt: current.time || null,
    temp: current.temperature_2m ?? null,
    feelsLike: current.apparent_temperature ?? null,
    humidity: current.relative_humidity_2m ?? null,
    windKph: current.wind_speed_10m ?? null,
    condition: WMO_LABELS[current.weather_code] || 'Variable',
    rainNext3h: nearRain.length ? Math.max(...nearRain.slice(0, 3)) : null,
    rainNext6h: nearRain.length ? Math.max(...nearRain) : null,
    hourly: (hourly.time || []).slice(0, 72).map((time, index) => ({
      time,
      temp: hourly.temperature_2m?.[index] ?? null,
      feelsLike: hourly.apparent_temperature?.[index] ?? null,
      rainChance: hourly.precipitation_probability?.[index] ?? null,
      windKph: hourly.wind_speed_10m?.[index] ?? null,
      condition: WMO_LABELS[hourly.weather_code?.[index]] || 'Variable',
    })),
    daily: (daily.time || []).slice(0, 10).map((date, index) => ({
      date,
      min: daily.temperature_2m_min?.[index] ?? null,
      max: daily.temperature_2m_max?.[index] ?? null,
      rainMm: daily.precipitation_sum?.[index] ?? null,
      rainChance: daily.precipitation_probability_max?.[index] ?? null,
      condition: WMO_LABELS[daily.weather_code?.[index]] || 'Variable',
    })),
  };
}

function sanitizeClientWeatherSnapshot(snapshot, origin) {
  if (!snapshot?.current || !origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) return null;
  const updatedAt = Number(snapshot.updatedAt);
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > 30 * 60 * 1000) return null;

  const current = snapshot.current || {};
  const temp = Number(current.temp);
  const weatherCode = Number(current.weatherCode);
  const normalizedCurrent = {
    temp: Number.isFinite(temp) ? temp : null,
    feelsLike: Number.isFinite(Number(current.feelsLike)) ? Number(current.feelsLike) : null,
    humidity: Number.isFinite(Number(current.humidity)) ? Number(current.humidity) : null,
    windSpeed: Number.isFinite(Number(current.windSpeed)) ? Number(current.windSpeed) : null,
    weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
    conditionCode: current.conditionCode || null,
  };
  if (normalizedCurrent.temp == null && normalizedCurrent.feelsLike == null && normalizedCurrent.weatherCode == null) return null;

  return {
    current: normalizedCurrent,
    hourly: Array.isArray(snapshot.hourly) ? snapshot.hourly.slice(0, 72) : [],
    daily: Array.isArray(snapshot.daily) ? snapshot.daily.slice(0, 10) : [],
    alerts: [],
    source: snapshot.source || (snapshot.isUsingCache ? 'Cached app forecast' : 'App forecast'),
    cachedFromApp: true,
    updatedAt,
  };
}

function selectAskForecastWindow(weather, timeWindow) {
  const finiteMin = (values) => {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? Math.min(...numbers) : null;
  };
  const finiteMax = (values) => {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? Math.max(...numbers) : null;
  };
  const key = timeWindow?.key || 'now';
  if (key === 'next_week' || key === 'weekend') {
    const days = (weather?.daily || []).slice(key === 'weekend' ? 0 : 3, key === 'weekend' ? 7 : 10);
    if (!days.length) return { label: timeWindow?.label || key, summary: 'Extended forecast unavailable' };
    return {
      label: timeWindow.label,
      min: finiteMin(days.map((day) => day.min)),
      max: finiteMax(days.map((day) => day.max)),
      rainChance: finiteMax(days.map((day) => day.rainChance)),
      condition: days.map((day) => day.condition).find((condition) => /rain|storm|snow|fog/i.test(condition)) || days[0].condition,
      days,
    };
  }

  if (key.startsWith('tomorrow')) {
    const day = weather?.daily?.[1];
    const hours = (weather?.hourly || []).filter((item) => {
      const date = new Date(item.time);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const sameDay = date.getFullYear() === tomorrow.getFullYear() && date.getMonth() === tomorrow.getMonth() && date.getDate() === tomorrow.getDate();
      if (!sameDay) return false;
      if (key === 'tomorrow_morning') return date.getHours() >= 6 && date.getHours() <= 11;
      if (key === 'tomorrow_evening') return date.getHours() >= 17 && date.getHours() <= 22;
      return true;
    });
    return {
      label: timeWindow.label,
      min: day?.min ?? null,
      max: day?.max ?? null,
      rainChance: finiteMax([...hours.map((item) => item.rainChance), day?.rainChance]),
      condition: day?.condition || hours[0]?.condition || 'Variable',
      feelsLike: finiteMax(hours.map((item) => item.feelsLike)),
      windKph: finiteMax(hours.map((item) => item.windKph)),
    };
  }

  if (key === 'evening' || key === 'morning') {
    const hours = (weather?.hourly || []).filter((item) => {
      const date = new Date(item.time);
      const hour = date.getHours();
      return key === 'evening' ? hour >= 17 && hour <= 22 : hour >= 6 && hour <= 11;
    }).slice(0, 8);
    if (hours.length) {
      return {
        label: timeWindow.label,
        feelsLike: finiteMax(hours.map((item) => item.feelsLike)),
        rainChance: finiteMax(hours.map((item) => item.rainChance)),
        windKph: finiteMax(hours.map((item) => item.windKph)),
        condition: hours.find((item) => /rain|storm|snow|fog/i.test(item.condition))?.condition || hours[0].condition,
      };
    }
  }

  return {
    label: timeWindow?.label || 'right now',
    feelsLike: weather?.feelsLike ?? weather?.temp ?? null,
    rainChance: weather?.rainNext3h ?? null,
    windKph: weather?.windKph ?? null,
    condition: weather?.condition || 'Variable',
  };
}

function findBestActivityWindow(weather, activity) {
  const exposed = ['camping', 'hiking', 'cycling', 'running', 'football', 'cricket', 'picnic', 'fishing'].includes(activity);
  const candidates = (weather?.hourly || []).filter((item) => {
    const timestamp = new Date(item.time).getTime();
    return Number.isFinite(timestamp) && timestamp >= Date.now() - 30 * 60 * 1000;
  }).slice(0, 36);
  if (!candidates.length) return null;

  const ranked = candidates.map((item) => {
    const feels = Number(item.feelsLike ?? item.temp);
    const rain = Number(item.rainChance) || 0;
    const wind = Number(item.windKph) || 0;
    const temperaturePenalty = Number.isFinite(feels)
      ? Math.max(0, feels - (exposed ? 31 : 35)) * 5 + Math.max(0, 5 - feels) * 4
      : 10;
    return { item, score: rain * (exposed ? 1.5 : 0.8) + wind * (exposed ? 0.7 : 0.3) + temperaturePenalty };
  }).sort((a, b) => a.score - b.score);
  const best = ranked[0]?.item;
  if (!best) return null;
  const start = new Date(best.time);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const format = (date) => date.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
  return {
    label: `${format(start)}–${format(end)}`,
    condition: best.condition,
    rainChance: best.rainChance,
    feelsLike: best.feelsLike ?? best.temp,
    windKph: best.windKph,
  };
}

async function fetchAskWeather(originUrl, lat, lon) {
  const weatherKit = await fetchJsonOrNull(`${originUrl}/api/weatherkit?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  if (weatherKit?.current) return weatherKit;
  return fetchOpenMeteo(lat, lon).catch(() => null);
}

function officialAlertText(item) {
  return [item?.event, item?.title, item?.description, item?.instruction, ...(item?.regions || [])]
    .filter(Boolean)
    .join(' ');
}

function ndmaAlertText(item) {
  return [item?.title, item?.hazard, item?.summary, ...(item?.regions || [])].filter(Boolean).join(' ');
}

async function buildAskEvidence(req, body, googleKey) {
  const question = normalizeQuestion(body.question);
  const context = buildAskContext(question, body.conversationContext || {});
  const origin = {
    name: String(body.preciseLocationName || body.locationName || 'Current location'),
    lat: Number(body.lat),
    lon: Number(body.lon),
  };
  const destinationQuery = context.destinationQuery;
  const destination = await forwardGeocode(destinationQuery, googleKey);
  const target = destination || origin;
  const localSnapshot = !destination ? sanitizeClientWeatherSnapshot(body.localWeatherSnapshot, origin) : null;
  const originUrl = getApiOrigin(req);
  const routeRequested = ['destination_trip', 'route_stop'].includes(context.intent) && Boolean(destination);
  const initialNearbyQuery = context.intent === 'nearby_discovery' || context.intent === 'activity_advice'
    ? question
    : context.intent === 'destination_trip' && destinationQuery
      ? `outdoor attractions in ${destinationQuery}, Pakistan`
      : '';

  const [meteo, aqiResult, pmd, ndma, nhmp] = await Promise.all([
    localSnapshot ? Promise.resolve(localSnapshot) : fetchAskWeather(originUrl, target.lat, target.lon),
    fetchGoogleAqi(target.lat, target.lon, googleKey).catch(() => null),
    fetchJsonOrNull(`${originUrl}/api/alerts`),
    fetchJsonOrNull(`${originUrl}/api/ndma?limit=12&location=${encodeURIComponent(target.name)}`),
    routeRequested ? fetchJsonOrNull(`${originUrl}/api/nhmp`) : Promise.resolve(null),
  ]);
  const weather = summarizeAskWeather(meteo);
  const forecastWindow = selectAskForecastWindow(weather, context.timeWindow);
  const bestActivityWindow = context.activity ? findBestActivityWindow(weather, context.activity) : null;
  const googleRoute = routeRequested ? await fetchGoogleRoute(origin, destination, googleKey) : null;
  const routeStopPoint = context.intent === 'route_stop' && destination
    ? selectRouteStopPoint(googleRoute, origin, destination)
    : null;
  const routeStopQuery = context.intent === 'route_stop'
    ? context.routeStopType === 'cafe'
      ? 'cafes tea coffee'
      : 'restaurants food dhaba'
    : '';
  const nearbyQuery = routeStopQuery || initialNearbyQuery;
  const nearbyPoint = routeStopPoint || target;
  const nearbyPlaces = nearbyQuery
    ? await fetchNearbyPlaces(nearbyPoint.lat, nearbyPoint.lon, nearbyQuery, googleKey)
    : [];

  const terms = [destinationQuery, target.name, origin.name];
  const pmdMatches = matchOfficialItems(pmd?.alerts, terms, officialAlertText).slice(0, 3).map((item) => ({
    source: 'PMD',
    severity: item.severity,
    text: officialAlertText(item).slice(0, 420),
    updatedAt: item.pubDate || item.onset || null,
  }));
  const ndmaMatches = matchOfficialItems(ndma?.advisories, terms, ndmaAlertText)
    .filter((item) => isAskAdvisoryFresh(item))
    .slice(0, 3)
    .map((item) => ({
      source: 'NDMA',
      severity: item.level,
      text: ndmaAlertText(item).slice(0, 420),
      updatedAt: item.date || null,
    }));
  const routePlan = destination ? inferNhmpRoutePlan(origin, destination) : { codes: [], known: false };
  const routeMatches = matchNhmpRouteItems(
    nhmp?.advisories,
    routePlan,
    [destinationQuery, destination?.name, origin.name]
  ).slice(0, 8).map((item) => ({
    route: item.route || item.sector || 'NHMP route',
    status: item.status || 'Status unavailable',
    severity: item.severity || 'unknown',
  }));
  const routeClarity = !routeRequested
    ? { status: 'not_requested', summary: null }
    : !nhmp?.success || nhmp?.stale
      ? {
          status: 'unavailable',
          summary: 'Live NHMP route clarity is unavailable; check NHMP directly before leaving.',
        }
      : routeMatches.some((item) => item.severity !== 'clear')
        ? {
            status: 'warning',
            summary: `${routeMatches.find((item) => item.severity !== 'clear').route}: ${routeMatches.find((item) => item.severity !== 'clear').status}`,
          }
        : routeMatches.length && routePlan.codes.length
          ? {
              status: 'clear',
              summary: `${routePlan.codes.join(' and ')} report Road & Weather Clear in the latest NHMP feed.`,
            }
        : {
            status: 'unconfirmed',
            summary: routePlan.codes.length
              ? `NHMP has no matching update for ${routePlan.codes.join(' → ')}; this does not confirm route clearance.`
              : 'No matching NHMP route update was found; this does not confirm the full route is clear.',
          };

  const [routeWeather, discoveryOptions] = await Promise.all([
    routeRequested
      ? Promise.all(selectRouteSamplePoints(googleRoute, origin, destination).map(async (point) => {
        const pointWeather = await fetchAskWeather(originUrl, point.lat, point.lon);
        const summary = summarizeAskWeather(pointWeather);
        const pointWindow = selectAskForecastWindow(summary, context.timeWindow);
        return {
          name: point.name,
          temp: summary.temp,
          feelsLike: pointWindow.feelsLike ?? pointWindow.max ?? summary.feelsLike,
          minFeelsLike: pointWindow.min ?? pointWindow.feelsLike ?? summary.feelsLike,
          condition: pointWindow.condition || summary.condition,
          rainNext6h: pointWindow.rainChance ?? summary.rainNext6h,
          windKph: pointWindow.windKph ?? summary.windKph,
        };
        }))
      : Promise.resolve([]),
    context.intent === 'nearby_discovery'
      ? Promise.all(nearbyPlaces.slice(0, 4).map(async (place) => {
          if (!Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lon))) return place;
          const placeWeather = summarizeAskWeather(await fetchAskWeather(originUrl, place.lat, place.lon));
          const placeWindow = selectAskForecastWindow(placeWeather, context.timeWindow);
          return {
            ...place,
            forecastWindow: placeWindow,
            weatherSummary: [
              placeWindow.condition,
              placeWindow.min != null && placeWindow.max != null ? `${Math.round(placeWindow.min)}–${Math.round(placeWindow.max)}°C` : null,
              placeWindow.rainChance != null ? `${Math.round(placeWindow.rainChance)}% rain` : null,
            ].filter(Boolean).join(', '),
          };
        }))
      : Promise.resolve([]),
  ]);
  const providerMatches = (weather.providerAlerts || []).map((item) => ({
    source: weather.source || 'WeatherKit',
    severity: item.severity || item.significance || 'warning',
    text: [item.summary, item.description, item.detailsUrl].filter(Boolean).join(' ').slice(0, 420),
    updatedAt: item.issuedTime || item.effectiveTime || null,
  })).filter((item) => item.text);
  const officialMatches = [...providerMatches, ...pmdMatches, ...ndmaMatches];
  const decisionWindow = context.intent === 'nearby_discovery' && discoveryOptions[0]?.forecastWindow
    ? discoveryOptions[0].forecastWindow
    : forecastWindow;
  const planWeather = {
    ...weather,
    feelsLike: decisionWindow.feelsLike ?? decisionWindow.max ?? weather.feelsLike,
    minFeelsLike: decisionWindow.min ?? decisionWindow.feelsLike ?? weather.feelsLike,
    rainNext3h: decisionWindow.rainChance ?? weather.rainNext3h,
    windKph: decisionWindow.windKph ?? weather.windKph,
  };
  const riskWeather = routeWeather.reduce((worst, point) => {
    const worstFeels = Number(worst.feelsLike);
    const worstLow = Number(worst.minFeelsLike ?? worst.feelsLike);
    const pointFeels = Number(point.feelsLike);
    return {
      feelsLike: Math.max(Number.isFinite(worstFeels) ? worstFeels : -100, Number.isFinite(pointFeels) ? pointFeels : -100),
      minFeelsLike: Math.min(Number.isFinite(worstLow) ? worstLow : 100, Number.isFinite(pointFeels) ? pointFeels : 100),
      windKph: Math.max(Number(worst.windKph) || 0, Number(point.windKph) || 0),
      rainNext3h: Math.max(Number(worst.rainNext3h) || 0, Number(point.rainNext6h) || 0),
    };
  }, planWeather);
  const verdict = deriveAskVerdict({
    activity: context.activity,
    weather: riskWeather,
    aqi: context.intent === 'nearby_discovery' ? null : aqiResult?.aqi,
    officialMatches,
    routeMatches,
  });

  return {
    question,
    context,
    verdict,
    target: { name: target.name, lat: target.lat, lon: target.lon },
    origin,
    weather,
    forecastWindow,
    bestActivityWindow,
    weatherProvider: weather.source || 'Open-Meteo fallback',
    airQuality: { aqi: aqiResult?.aqi ?? null, pm25: aqiResult?.pm25 ?? null },
    officialMatches,
    routeMatches,
    routePlan,
    routeClarity,
    googleRoute: googleRoute ? {
      distanceMeters: googleRoute.distanceMeters,
      distanceText: googleRoute.distanceText,
      durationText: googleRoute.durationText,
      description: googleRoute.description,
    } : null,
    routeWeather,
    nearbyPlaces,
    discoveryOptions,
    routeStopPoint,
    sourceStatus: {
      forecast: localSnapshot ? 'cached' : meteo ? 'live' : 'unavailable',
      airQuality: aqiResult ? 'live' : 'unavailable',
      PMD: pmd?.success ? 'live' : 'unavailable',
      NDMA: ndma?.success ? 'live' : 'unavailable',
      NHMP: routeRequested ? (nhmp?.success ? (nhmp.stale ? 'stale' : 'live') : 'unavailable') : 'not requested',
      GoogleRoute: routeRequested ? (googleRoute ? 'live' : 'unavailable') : 'not requested',
      places: nearbyQuery ? (nearbyPlaces.length ? 'live' : 'unavailable') : 'not requested',
    },
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchGoogleAqi(lat, lon, apiKey) {
  if (apiKey) {
    try {
      const r = await withTimeout(fetch(
        `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: { latitude: lat, longitude: lon },
            extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION'],
            languageCode: 'en',
          }),
        }
      ), 8000);
      if (r.ok) {
        const json = await r.json();
        if (!json.error) {
          const idx = json.indexes?.find((i) => i.code === 'uaqi') || json.indexes?.[0];
          const pm25 = json.pollutants?.find((p) => p.code === 'pm25');
          return { aqi: idx?.aqi ?? null, pm25: pm25?.concentration?.value ?? null, source: 'Google Air Quality' };
        }
      }
    } catch {
      // Fall through to Open-Meteo AQI below.
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
    const response = await withTimeout(fetch(url), 8000);
    const json = await response.json();
    if (!response.ok || json.error || !json.current) return null;
    return {
      aqi: json.current.us_aqi ?? null,
      pm25: json.current.pm2_5 ?? null,
      pm10: json.current.pm10 ?? null,
      source: 'Open-Meteo Air Quality',
    };
  } catch {
    return null;
  }
}

async function fetchSynthesisData(lat, lon, googleApiKey) {
  const [meteo, aqiRes] = await Promise.allSettled([
    fetchOpenMeteo(lat, lon),
    fetchGoogleAqi(lat, lon, googleApiKey),
  ]);
  const w = meteo.status === 'fulfilled' ? meteo.value : null;
  const a = aqiRes.status === 'fulfilled' ? aqiRes.value : null;
  const cur = w?.current;
  const hourlyRain = w?.hourly?.precipitation_probability?.slice(0, 3) ?? [];
  const tod = w?.daily;
  return {
    temp: cur?.temperature_2m ?? null,
    feelsLike: cur?.apparent_temperature ?? null,
    humidity: cur?.relative_humidity_2m ?? null,
    windKph: cur?.wind_speed_10m ?? null,
    weatherCode: cur?.weather_code ?? null,
    weatherLabel: WMO_LABELS[cur?.weather_code] ?? 'Variable',
    uvIndex: cur?.uv_index ?? null,
    rainNext3h: hourlyRain.length ? Math.max(...hourlyRain) : null,
    aqi: a?.aqi ?? null,
    pm25: a?.pm25 ?? null,
    tomorrowMax: tod?.temperature_2m_max?.[1] ?? null,
    tomorrowMin: tod?.temperature_2m_min?.[1] ?? null,
    tomorrowCode: tod?.weather_code?.[1] ?? null,
    tomorrowRain: tod?.precipitation_sum?.[1] ?? null,
  };
}

// ─── Synthesis: prompt + fallback ─────────────────────────────────────────────

function buildSynthesisPrompt(signals, locationName, pollenLabel) {
  const { temp, feelsLike, humidity, weatherLabel, windKph, uvIndex, aqi, pm25,
          rainNext3h, tomorrowMax, tomorrowMin, tomorrowCode, tomorrowRain } = signals;

  const now = new Date();
  const hour = now.getHours();
  const timeCtx = hour < 6 ? 'Before dawn' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 20 ? 'Evening' : 'Night';
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });

  // Heat index note — combination of heat + humidity is worse than either alone
  const heatNote = feelsLike != null && humidity != null && feelsLike >= 35 && humidity >= 50
    ? ` · HIGH HUMIDITY ${humidity}% amplifies heat`
    : humidity != null ? ` · humidity ${humidity}%` : '';

  const weatherLine = [
    temp != null ? `${Math.round(temp)}°C` : null,
    feelsLike != null ? `feels ${Math.round(feelsLike)}°C${heatNote}` : null,
    weatherLabel,
    windKph != null ? `wind ${Math.round(windKph)} km/h` : null,
    uvIndex != null ? `UV ${Math.round(uvIndex)} (${uvLabel(uvIndex)})` : null,
    rainNext3h != null ? `${Math.round(rainNext3h)}% rain next 3h` : null,
  ].filter(Boolean).join(' · ');

  const aqiLine = aqi != null
    ? `AQI ${aqi} (${aqiCat(aqi)})${pm25 != null ? ` · PM2.5 ${Math.round(pm25)}µg/m³` : ''}`
    : 'AQI unavailable';

  // UV risk context
  const uvNote = uvIndex != null
    ? uvIndex >= 11 ? 'UV EXTREME — sunburn in <15 min, cover up fully'
    : uvIndex >= 8  ? 'UV Very High — sunscreen + hat essential'
    : uvIndex >= 6  ? 'UV High — reapply sunscreen mid-day'
    : null
    : null;

  // Pollen context
  const pollenNote = pollenLabel
    ? `POLLEN: ${pollenLabel} — ${/high|very/i.test(pollenLabel) ? 'allergy sufferers stay indoors or mask up' : 'manageable for most people'}`
    : null;

  const tomorrowLine = tomorrowMax != null
    ? `${WMO_LABELS[tomorrowCode] ?? 'Variable'}, ${Math.round(tomorrowMin)}–${Math.round(tomorrowMax)}°C${tomorrowRain > 2 ? `, ${Math.round(tomorrowRain)}mm rain` : ''}`
    : 'Unavailable';

  const extraLines = [uvNote, pollenNote].filter(Boolean).join('\n');

  return `
You are OutdoorAdvisor Pakistan. Output ONLY the JSON object — no prose, no markdown.
KEEP VALUES SHORT: headline ≤60 chars, summary ≤120 chars, each action ≤40 chars.

LOCATION: ${locationName || 'Pakistan'} · ${day}, ${timeCtx}
WEATHER: ${weatherLine}
AIR QUALITY: ${aqiLine}${extraLines ? '\n' + extraLines : ''}
TOMORROW: ${tomorrowLine}

JSON schema (all fields required, no extra keys):
{"severity":"go|caution|danger","headline":"<≤10 words>","summary":"<2 sentences>","actions":["<verb phrase>","<verb phrase>"],"window":"<best time or null>"}

Severity rules (pick worst that applies):
- "danger": AQI>170, UV≥11, thunderstorm, feels≥42°C
- "caution": AQI 81-170, UV 6-10, active rain, feels 35-41°C, High pollen
- "go": everything else
Mention the 2 most impactful risks in summary. Tailor actions to the time of day.

CRITICAL CONSISTENCY RULES — your summary, actions, and window MUST agree with severity:
- danger severity → summary, actions, headline must all be cautionary / restrictive. Never write "good for outdoor activities" or suggest "go for a walk" in a danger brief.
- caution severity → suggest shorter outings, mention the specific risk.
- "window" must be a FUTURE time-of-day relative to ${timeCtx}. If it is currently ${timeCtx}, do NOT suggest a window already past (e.g. don't say "Morning" when it is Afternoon). Use null if no future safe window exists today.
- In summary text, reference the current period ("this ${timeCtx.toLowerCase()}") — never a different period.
- If weather is rain/thunderstorm/stormy, the brief MUST acknowledge it — do NOT write "clear skies".
`.trim();
}

function synthesisFallback(signals, locationName, pollenLabel) {
  const { aqi, weatherCode, temp, feelsLike } = signals ?? {};
  const RAIN_CODES = [51,53,55,61,63,65,80,81,82,95,96,99];
  const isRaining = weatherCode != null && RAIN_CODES.includes(weatherCode);
  const aqiNum = aqi ?? 0;
  const heatVal = feelsLike ?? temp ?? null;
  const isExtremeHeat = heatVal != null && heatVal >= 42; // matches prompt: danger feels≥42°C
  const isHot         = heatVal != null && heatVal >= 35; // matches prompt: caution feels 35-41°C

  // Thresholds match buildSynthesisPrompt severity rules exactly
  const severity = aqiNum > 170 || isExtremeHeat ? 'danger'
    : aqiNum > 80 || isRaining || isHot ? 'caution'
    : 'go';

  const headline = isExtremeHeat
    ? `Dangerous heat at ${Math.round(heatVal)}°C — stay indoors if possible.`
    : isHot && severity !== 'go'
    ? `Warm at ${Math.round(heatVal)}°C — avoid midday and stay hydrated.`
    : severity === 'danger'
    ? 'Conditions are difficult — plan outdoor exposure carefully.'
    : severity === 'caution'
    ? 'Some caution needed before heading outside.'
    : 'Conditions look workable for most outdoor plans today.';

  // Qualitative only — avoids contradicting the live card which uses a different AQI source (AQICN vs Google UAQI)
  const aqiNote = aqiNum > 170 ? 'Air quality is very poor — limit outdoor exposure.'
    : aqiNum > 80  ? 'Air quality is moderate — sensitive groups should take care.'
    : aqiNum > 0   ? 'Air quality is acceptable right now.'
    : '';

  const weatherNote = isRaining
    ? 'Rain is active — carry gear and add road margin.'
    : isExtremeHeat ? `Extreme heat at ${Math.round(heatVal)}°C. Avoid outdoor activity until evening.`
    : isHot ? `It feels like ${Math.round(heatVal)}°C — heat is the main risk right now.`
    : temp != null ? `It feels like ${Math.round(feelsLike ?? temp)}°C outside.`
    : 'Check the live conditions below.';
  const actions = [
    isExtremeHeat ? 'Stay indoors during 10 AM – 6 PM' : null,
    isHot && !isExtremeHeat ? 'Avoid 11 AM – 4 PM peak heat' : null,
    isHot ? 'Drink water every 20–30 minutes' : null,
    aqiNum > 170 ? 'Wear N95 mask outdoors' : null,
    aqiNum > 80 && aqiNum <= 170 ? 'Sensitive groups limit extended outdoor time' : null,
    isRaining ? 'Carry rain gear and drive carefully' : null,
    !isHot && !isRaining && severity === 'go' ? 'Morning or evening slots are ideal' : null,
  ].filter(Boolean).slice(0, 3);

  const window = isExtremeHeat ? 'After 6 PM when heat drops'
    : isHot ? 'Before 10 AM or after 5 PM'
    : null;

  return {
    provider: 'fallback',
    severity,
    headline,
    summary: [aqiNote, weatherNote].filter(Boolean).join(' ') || `${locationName || 'Your area'} — check the conditions below.`,
    actions: actions.length ? actions : ['Review the condition cards below'],
    window,
  };
}

// ─── Synthesis: Gemini call (extended schema) ──────────────────────────────────

async function callGeminiSynthesis(model, apiKey, prompt) {
  const response = await withTimeout(fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.85,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
        },
      }),
    }
  ), 12000);
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Gemini error (${response.status})`);
  const text = extractTextFromResponse(json);
  const parsed = tryParseJson(text);
  if (!parsed?.headline || !parsed?.summary || !parsed?.severity) {
    throw new Error(`Bad Gemini output: ${text?.slice(0, 500)}`);
  }
  return {
    provider: 'gemini',
    severity: ['go', 'caution', 'danger'].includes(parsed.severity) ? parsed.severity : 'caution',
    headline: parsed.headline,
    summary: parsed.summary,
    actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
    window: parsed.window || null,
  };
}

function buildHomePrompt(data) {
  return `
You are OutdoorAdvisor, a Pakistan-focused outdoor decision assistant.
Use only the structured data below. Be practical, calm, and slightly permissive unless there is clear harm.
Prefer "go smart" advice over "stay inside" unless the risk is truly meaningful.
Do not mention missing data. Do not invent facts.
Return strict JSON with exactly these keys:
{"headline":"","summary":"","tip":""}

Home data:
${JSON.stringify(data, null, 2)}
`.trim();
}

function buildTravelPrompt(data) {
  return `
You are OutdoorAdvisor, a Pakistan-focused travel and outdoor decision assistant.
Use only the route, NHMP, PMD, NDMA, and stop-condition data below.
Write a short grounded trip summary in plain language. Be practical, not alarmist.
Return strict JSON with exactly these keys:
{"headline":"","summary":"","tip":""}

Travel data:
${JSON.stringify(data, null, 2)}
`.trim();
}

async function callGemini(model, apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 220,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || `Gemini request failed (${response.status})`);
  }

  const text = extractTextFromResponse(json);
  const parsed = tryParseJson(text);
  if (!parsed?.headline || !parsed?.summary || !parsed?.tip) {
    throw new Error('Gemini returned an invalid summary payload.');
  }

  return parsed;
}

async function callGeminiAsk(model, apiKey, prompt) {
  const response = await withTimeout(fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          topP: 0.85,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
        },
      }),
    }
  ), 15000);

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Gemini request failed (${response.status})`);
  const parsed = tryParseJson(extractTextFromResponse(json));
  if (!parsed?.headline || !parsed?.answer) throw new Error('Gemini returned an invalid Ask payload.');
  return {
    headline: String(parsed.headline).slice(0, 100),
    answer: String(parsed.answer).slice(0, 1200),
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 5) : [],
    sections: Array.isArray(parsed.sections)
      ? parsed.sections.slice(0, 4).map((section) => ({
          title: String(section?.title || '').slice(0, 50),
          items: Array.isArray(section?.items) ? section.items.map(String).slice(0, 4) : [],
        })).filter((section) => section.title && section.items.length)
      : [],
  };
}

function buildAskScopePrompt(question, conversationContext = null) {
  return `
You are a strict scope classifier for Ask OutdoorAdvisor.
Decide if the user's message belongs inside a Pakistan-focused outdoor decision app.

IN SCOPE:
- weather, rain, storm, heat, cold, fog, smog, AQI, UV, pollen, air quality
- outdoor plans, sports, walking, running, camping, hiking, lunch/dining outdoors
- nearby places for outdoor activities or route stops
- travel timing, destination trips, road/motorway/NHMP/PMD/NDMA safety, route conditions
- follow-up questions that rely on prior outdoor/travel/weather context
- short follow-ups like "what about tomorrow", "and rain?", "route?", "nearby?", or "best time?" when PRIOR CONTEXT is outdoor/travel/weather

OUT OF SCOPE:
- general homework, coding, finance, politics, entertainment, relationships, medical/legal advice unrelated to outdoor conditions
- messages with no actionable outdoor, weather, travel, route, or place intent
- math or factual trivia like "what is 2+2" even when PRIOR CONTEXT exists

Return strict JSON only:
{"inScope":true,"intent":"weather|activity|nearby|travel|route_stop|official_alert|follow_up|out_of_scope","reason":"<=12 words"}

PRIOR CONTEXT:
${JSON.stringify(conversationContext || {}, null, 2)}

USER MESSAGE:
${question}
`.trim();
}

function isLikelyAskFollowUp(question) {
  const text = normalizeQuestion(question).toLowerCase();
  if (!text || text.length > 120) return false;
  return (
    /^(what about|how about|and|also|then|tomorrow|today|tonight|now|later|route|road|rain|weather|aqi|there|nearby|best time|is it safe|should i)$/i.test(text) ||
    /^(what about|how about|and|also)\b/.test(text) ||
    /\b(tomorrow|tonight|later|now|rain|route|road|aqi|weather|nearby|best time|safe|there)\??$/.test(text)
  );
}

function isClearlyOutOfScopeQuestion(question) {
  const text = normalizeQuestion(question).toLowerCase();
  if (!text) return true;
  if (isOutdoorQuestion(text)) return false;
  return (
    /\b(what\s+is|calculate|solve|math|equation|poem|joke|story|essay|code|javascript|python|translate|capital of|president|prime minister|stock|crypto)\b/.test(text) ||
    /^\s*\d+\s*[-+*/x÷]\s*\d+\s*\??\s*$/.test(text) ||
    /\b\d+\s*[-+*/x÷]\s*\d+\b/.test(text)
  );
}

function buildDeterministicScope(question, conversationContext = {}, reason = 'Gemini scope unavailable') {
  const hasPriorOutdoorContext = Boolean(conversationContext?.intent || conversationContext?.destinationQuery || conversationContext?.activity);
  const outdoor = isOutdoorQuestion(question);
  const followUp = hasPriorOutdoorContext && isLikelyAskFollowUp(question) && !isClearlyOutOfScopeQuestion(question);
  return {
    provider: 'deterministic-scope',
    inScope: outdoor || followUp,
    intent: outdoor ? 'weather' : followUp ? 'follow_up' : 'out_of_scope',
    reason,
  };
}

async function classifyAskScope(model, apiKey, question, conversationContext = null) {
  if (!apiKey) {
    return buildDeterministicScope(question, conversationContext, 'Gemini scope unavailable');
  }

  const response = await withTimeout(fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildAskScopePrompt(question, conversationContext) }] }],
        generationConfig: {
          temperature: 0.05,
          topP: 0.7,
          maxOutputTokens: 160,
          responseMimeType: 'application/json',
        },
      }),
    }
  ), 10000);

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Gemini scope failed (${response.status})`);
  const parsed = tryParseJson(extractTextFromResponse(json));
  if (typeof parsed?.inScope !== 'boolean') throw new Error('Gemini returned an invalid scope payload.');
  const clearlyOutOfScope = isClearlyOutOfScopeQuestion(question);
  return {
    provider: 'gemini-scope',
    inScope: clearlyOutOfScope ? false : Boolean(parsed.inScope),
    intent: clearlyOutOfScope ? 'out_of_scope' : String(parsed.intent || (parsed.inScope ? 'weather' : 'out_of_scope')).slice(0, 40),
    reason: clearlyOutOfScope ? 'Clearly outside outdoor scope' : String(parsed.reason || '').slice(0, 100),
  };
}

function buildOutOfScopeAskResponse(scope, quota) {
  return {
    provider: 'scope-guard',
    verdict: 'plan',
    headline: 'Ask an outdoor question',
    answer: 'I can help when your question is about weather, AQI, outdoor timing, nearby places, camping, travel routes, or official PMD/NDMA/NHMP alerts. This message looks outside that scope.',
    bullets: [
      'Try: “Should I go to Murree tomorrow evening?”',
      'Try: “Where can I play tennis near me right now?”',
      quota ? `${quota.remaining} Ask queries left today.` : null,
    ].filter(Boolean),
    sections: [],
    scope,
    quota,
  };
}

function buildAskQuotaResponse(quota) {
  return {
    provider: 'quota-limit',
    verdict: 'plan',
    headline: 'Daily Ask limit reached',
    answer: `You have used ${quota.limit} Ask OutdoorAdvisor queries today. Your limit resets at midnight Pakistan time.`,
    bullets: [
      'Core weather, AQI, travel advisories, and alerts still work normally.',
      `Next reset: ${quota.resetAt}`,
    ],
    sections: [],
    quota,
  };
}

function isSpecificAskResult(result, evidence) {
  if (evidence?.context?.intent === 'simple_weather') return true;
  const text = [
    result?.headline,
    result?.answer,
    ...(result?.bullets || []),
    ...(result?.sections || []).flatMap((section) => [section.title, ...(section.items || [])]),
  ].join(' ').toLowerCase();
  const tokens = [
    evidence?.context?.activity,
    String(evidence?.target?.name || '').split(/[,\s]/)[0],
    ...(evidence?.routePlan?.codes || []),
    evidence?.routeStopPoint?.name,
    ...(evidence?.nearbyPlaces || []).slice(0, 3).map((place) => String(place.name || '').split(/\s/)[0]),
    ...(evidence?.discoveryOptions || []).slice(0, 3).map((place) => String(place.name || '').split(/\s/)[0]),
  ].map((value) => String(value || '').trim().toLowerCase()).filter((value) => value.length >= 2);
  return tokens.some((token) => text.includes(token));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  const body = req.body || {};
  const { kind } = body;
  if (!kind) return sendJson(res, 400, { error: 'kind is required.' });

  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
  const googleKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const model     = (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();

  // ── Ask OutdoorAdvisor: premium evidence-first conversational answers ────
  if (kind === 'ask') {
    const question = normalizeQuestion(body.question);
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!question || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return sendJson(res, 400, { error: 'question, lat, and lon are required.' });
    }

    const premiumState = await getRequestPremiumState(req);
    if (!premiumState.isPremium) {
      return sendJson(res, 403, { error: 'Ask OutdoorAdvisor is available to signed-in premium members.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    let quota;
    try {
      quota = await consumeAskQuota(req, premiumState);
    } catch (error) {
      return sendJson(res, 200, {
        provider: 'quota-unavailable',
        verdict: 'plan',
        headline: 'Ask is busy',
        answer: 'Ask OutdoorAdvisor could not verify the daily query limit right now. Please try again in a moment.',
        bullets: [],
        sections: [],
        quota: { limit: ASK_DAILY_LIMIT, remaining: 0, allowed: false },
        _debug: error?.message,
      });
    }
    if (!quota.allowed) {
      return sendJson(res, 200, buildAskQuotaResponse(quota));
    }

    let scope;
    try {
      scope = await classifyAskScope(model, geminiKey, question, body.conversationContext || null);
    } catch (error) {
      scope = buildDeterministicScope(question, body.conversationContext || {}, error?.message || 'Gemini scope failed');
    }
    if (!scope.inScope) {
      return sendJson(res, 200, buildOutOfScopeAskResponse(scope, quota));
    }

    const evidence = await buildAskEvidence(req, body, googleKey);
    const fallback = buildAskFallback({
      context: evidence.context,
      verdict: evidence.verdict,
      targetName: evidence.target.name,
      weather: evidence.weather,
      forecastWindow: evidence.forecastWindow,
      bestActivityWindow: evidence.bestActivityWindow,
      aqi: evidence.airQuality.aqi,
      routeMatches: evidence.routeMatches,
      routeClarity: evidence.routeClarity,
      googleRoute: evidence.googleRoute,
      officialMatches: evidence.officialMatches,
      nearbyPlaces: evidence.nearbyPlaces,
      discoveryOptions: evidence.discoveryOptions,
      routeStopPoint: evidence.routeStopPoint,
    });

    if (!geminiKey) return sendJson(res, 200, { ...fallback, evidence, scope, quota });

    try {
      const prompt = buildAskPrompt({ question, evidence, fallback });
      const result = await callGeminiAsk(model, geminiKey, prompt);
      if (!isSpecificAskResult(result, evidence)) {
        return sendJson(res, 200, { ...fallback, evidence, scope, quota, provider: 'fallback-specificity-guard' });
      }
      return sendJson(res, 200, {
        provider: 'gemini',
        verdict: evidence.verdict,
        headline: result.headline,
        answer: result.answer,
        bullets: result.bullets,
        sections: result.sections.length ? result.sections : fallback.sections,
        evidence,
        scope,
        quota,
      });
    } catch (error) {
      return sendJson(res, 200, { ...fallback, evidence, scope, quota, _debug: error?.message });
    }
  }

  // ── Synthesize: server fetches all sources, returns unified brief ─────────
  if (kind === 'synthesize') {
    const { lat, lon, locationName, pollenLabel } = body;
    if (!lat || !lon) return sendJson(res, 400, { error: 'lat and lon required for synthesize.' });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

    const signals = await fetchSynthesisData(Number(lat), Number(lon), googleKey);
    const fallback = synthesisFallback(signals, locationName, pollenLabel);

    const premiumState = await getRequestPremiumState(req);
    if (!geminiKey || !premiumState.isPremium) return sendJson(res, 200, fallback);

    try {
      const prompt = buildSynthesisPrompt(signals, locationName, pollenLabel);
      const result = await callGeminiSynthesis(model, geminiKey, prompt);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 200, { ...fallback, _debug: err?.message, _model: model });
    }
  }

  // ── Home / Travel: existing device-payload briefing ───────────────────────
  const { payload } = body;
  if (!payload) return sendJson(res, 400, { error: 'payload is required.' });

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const fallback = kind === 'travel' ? travelFallback(payload) : homeFallback(payload);
  const premiumState = await getRequestPremiumState(req);

  if (!geminiKey || !premiumState.isPremium) return sendJson(res, 200, fallback);

  try {
    const prompt = kind === 'travel' ? buildTravelPrompt(payload) : buildHomePrompt(payload);
    const result = await callGemini(model, geminiKey, prompt);
    return sendJson(res, 200, {
      provider: 'gemini',
      headline: result.headline,
      summary: result.summary,
      tip: result.tip,
    });
  } catch {
    return sendJson(res, 200, fallback);
  }
}
