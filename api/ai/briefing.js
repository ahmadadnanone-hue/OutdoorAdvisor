import { createClient } from '@supabase/supabase-js';
import { derivePremiumState } from '../../src/lib/premium.js';
import {
  buildAskFallback,
  buildAskPrompt,
  deriveAskVerdict,
  extractDestination,
  isAskAdvisoryFresh,
  isOutdoorQuestion,
  inferNhmpRoutePlan,
  matchNhmpRouteItems,
  matchOfficialItems,
  normalizeQuestion,
  wantsNearbyEvidence,
  wantsRouteEvidence,
} from '../_lib/askOutdoorAdvisor.js';

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
    return { isPremium: false, plan: 'free' };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { isPremium: false, plan: 'free' };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { isPremium: false, plan: 'free' };
    }
    const premiumState = derivePremiumState(data.user);
    const email = normalizeEmail(data.user.email);
    if (email && allowlistedEmails.includes(email)) {
      return { isPremium: true, plan: 'premium' };
    }
    return premiumState;
  } catch {
    return { isPremium: false, plan: 'free' };
  }
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
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto&forecast_days=3`;
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
  if (!placeName || !apiKey) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', `${placeName}, Pakistan`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('language', 'en');
  const json = await fetchJsonOrNull(url);
  const result = json?.results?.[0];
  if (!result?.geometry?.location) return null;
  return {
    name: result.formatted_address || placeName,
    lat: result.geometry.location.lat,
    lon: result.geometry.location.lng,
  };
}

async function fetchNearbyPlaces(lat, lon, query, apiKey) {
  if (!apiKey || !query) return [];
  const response = await fetchJsonOrNull('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.shortFormattedAddress',
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 4,
      rankPreference: 'DISTANCE',
      locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: 8000 } },
    }),
  });
  return (response?.places || []).map((place) => ({
    name: place.displayName?.text || '',
    address: place.shortFormattedAddress || '',
    rating: place.rating ?? null,
  }));
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
      hourly: meteo.hourly.slice(0, 30).map((item) => ({
        time: item.time,
        temp: item.temp ?? null,
        feelsLike: null,
        rainChance: item.precipProbability ?? null,
        windKph: null,
        condition: WMO_LABELS[item.weatherCode] || item.conditionCode || 'Variable',
      })),
      daily: (meteo.daily || []).slice(0, 3).map((item) => ({
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
    hourly: (hourly.time || []).slice(0, 30).map((time, index) => ({
      time,
      temp: hourly.temperature_2m?.[index] ?? null,
      feelsLike: hourly.apparent_temperature?.[index] ?? null,
      rainChance: hourly.precipitation_probability?.[index] ?? null,
      windKph: hourly.wind_speed_10m?.[index] ?? null,
      condition: WMO_LABELS[hourly.weather_code?.[index]] || 'Variable',
    })),
    daily: (daily.time || []).slice(0, 3).map((date, index) => ({
      date,
      min: daily.temperature_2m_min?.[index] ?? null,
      max: daily.temperature_2m_max?.[index] ?? null,
      rainMm: daily.precipitation_sum?.[index] ?? null,
      condition: WMO_LABELS[daily.weather_code?.[index]] || 'Variable',
    })),
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
  const origin = {
    name: String(body.locationName || 'Current location'),
    lat: Number(body.lat),
    lon: Number(body.lon),
  };
  const destinationQuery = extractDestination(question);
  const destination = await forwardGeocode(destinationQuery, googleKey);
  const target = destination || origin;
  const originUrl = getApiOrigin(req);

  const [meteo, aqiResult, pmd, ndma, nhmp] = await Promise.all([
    fetchAskWeather(originUrl, target.lat, target.lon),
    fetchGoogleAqi(target.lat, target.lon, googleKey).catch(() => null),
    fetchJsonOrNull(`${originUrl}/api/alerts`),
    fetchJsonOrNull(`${originUrl}/api/ndma?limit=12&location=${encodeURIComponent(target.name)}`),
    wantsRouteEvidence(question) ? fetchJsonOrNull(`${originUrl}/api/nhmp`) : Promise.resolve(null),
  ]);

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
  const routeRequested = wantsRouteEvidence(question);
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

  const nearbyQuery = wantsNearbyEvidence(question) ? question : '';
  const [nearbyPlaces, routeWeather] = await Promise.all([
    fetchNearbyPlaces(target.lat, target.lon, nearbyQuery, googleKey),
    wantsRouteEvidence(question) && destination
      ? Promise.all([
          { name: origin.name, lat: origin.lat, lon: origin.lon },
          {
            name: 'Approximate route midpoint',
            lat: (origin.lat + destination.lat) / 2,
            lon: (origin.lon + destination.lon) / 2,
          },
          { name: destination.name, lat: destination.lat, lon: destination.lon },
        ].map(async (point) => {
          const pointWeather = await fetchAskWeather(originUrl, point.lat, point.lon);
          const summary = summarizeAskWeather(pointWeather);
          return {
            name: point.name,
            temp: summary.temp,
            feelsLike: summary.feelsLike,
            condition: summary.condition,
            rainNext6h: summary.rainNext6h,
            windKph: summary.windKph,
          };
        }))
      : Promise.resolve([]),
  ]);
  const weather = summarizeAskWeather(meteo);
  const providerMatches = (weather.providerAlerts || []).map((item) => ({
    source: weather.source || 'WeatherKit',
    severity: item.severity || item.significance || 'warning',
    text: [item.summary, item.description, item.detailsUrl].filter(Boolean).join(' ').slice(0, 420),
    updatedAt: item.issuedTime || item.effectiveTime || null,
  })).filter((item) => item.text);
  const officialMatches = [...providerMatches, ...pmdMatches, ...ndmaMatches];
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
  }, weather);
  const verdict = deriveAskVerdict({
    weather: riskWeather,
    aqi: aqiResult?.aqi,
    officialMatches,
    routeMatches,
  });

  return {
    question,
    verdict,
    target: { name: target.name, lat: target.lat, lon: target.lon },
    origin,
    weather,
    weatherProvider: weather.source || 'Open-Meteo fallback',
    airQuality: { aqi: aqiResult?.aqi ?? null, pm25: aqiResult?.pm25 ?? null },
    officialMatches,
    routeMatches,
    routePlan,
    routeClarity,
    routeWeather,
    nearbyPlaces,
    sourceStatus: {
      forecast: meteo ? 'live' : 'unavailable',
      airQuality: aqiResult ? 'live' : 'unavailable',
      PMD: pmd?.success ? 'live' : 'unavailable',
      NDMA: ndma?.success ? 'live' : 'unavailable',
      NHMP: wantsRouteEvidence(question) ? (nhmp?.success ? (nhmp.stale ? 'stale' : 'live') : 'unavailable') : 'not requested',
      places: nearbyQuery ? (nearbyPlaces.length ? 'live' : 'unavailable') : 'not requested',
    },
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchGoogleAqi(lat, lon, apiKey) {
  if (!apiKey) return null;
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
  if (!r.ok) return null;
  const json = await r.json();
  const idx = json.indexes?.find((i) => i.code === 'uaqi') || json.indexes?.[0];
  const pm25 = json.pollutants?.find((p) => p.code === 'pm25');
  return { aqi: idx?.aqi ?? null, pm25: pm25?.concentration?.value ?? null };
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
          maxOutputTokens: 500,
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
    answer: String(parsed.answer).slice(0, 800),
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 3) : [],
  };
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
  const model     = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();

  // ── Ask OutdoorAdvisor: premium evidence-first conversational answers ────
  if (kind === 'ask') {
    const question = normalizeQuestion(body.question);
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!question || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return sendJson(res, 400, { error: 'question, lat, and lon are required.' });
    }
    if (!isOutdoorQuestion(question)) {
      return sendJson(res, 400, {
        error: 'Ask about weather, air quality, outdoor plans, nearby activities, or travel routes.',
      });
    }

    const premiumState = await getRequestPremiumState(req);
    if (!premiumState.isPremium) {
      return sendJson(res, 403, { error: 'Ask OutdoorAdvisor is available to signed-in premium members.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    const evidence = await buildAskEvidence(req, body, googleKey);
    const fallback = buildAskFallback({
      verdict: evidence.verdict,
      targetName: evidence.target.name,
      weather: evidence.weather,
      aqi: evidence.airQuality.aqi,
      routeMatches: evidence.routeMatches,
      routeClarity: evidence.routeClarity,
      officialMatches: evidence.officialMatches,
      nearbyPlaces: evidence.nearbyPlaces,
    });

    if (!geminiKey) return sendJson(res, 200, { ...fallback, evidence });

    try {
      const prompt = buildAskPrompt({ question, evidence, fallback });
      const result = await callGeminiAsk(model, geminiKey, prompt);
      return sendJson(res, 200, {
        provider: 'gemini',
        verdict: evidence.verdict,
        headline: result.headline,
        answer: result.answer,
        bullets: result.bullets,
        evidence,
      });
    } catch (error) {
      return sendJson(res, 200, { ...fallback, evidence, _debug: error?.message });
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
