import { createClient } from '@supabase/supabase-js';
import { derivePremiumState } from '../../src/lib/premium.js';

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
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
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
    `&hourly=precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto&forecast_days=2`;
  const r = await withTimeout(fetch(url), 8000);
  if (!r.ok) throw new Error('Open-Meteo error');
  return r.json();
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

function extractXmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return m?.[1]?.trim() || null;
}

function cleanCdata(text) {
  return (text || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

async function fetchCapSummary() {
  const r = await withTimeout(fetch('https://cap-sources.s3.amazonaws.com/pk-pmd-en/rss.xml'), 8000);
  if (!r.ok) return [];
  const xml = await r.text();
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = extractXmlTag(m[1], 'title');
    const pub = extractXmlTag(m[1], 'pubDate');
    if (!t) continue;
    const title = cleanCdata(t);
    const tl = title.toLowerCase();
    const sev = /extreme|flash flood|cyclone/i.test(tl) ? 'Extreme'
      : /severe|warning|heavy rain|thunder/i.test(tl) ? 'Severe'
      : /moderate|advisory/i.test(tl) ? 'Moderate' : 'Minor';
    const age = pub ? Date.now() - new Date(pub).getTime() : Infinity;
    if (age < 48 * 3_600_000) items.push({ title, severity: sev });
  }
  return items.slice(0, 5);
}

async function fetchSynthesisData(lat, lon, googleApiKey) {
  const [meteo, aqiRes, alertsRes] = await Promise.allSettled([
    fetchOpenMeteo(lat, lon),
    fetchGoogleAqi(lat, lon, googleApiKey),
    fetchCapSummary(),
  ]);
  const w = meteo.status === 'fulfilled' ? meteo.value : null;
  const a = aqiRes.status === 'fulfilled' ? aqiRes.value : null;
  const alerts = alertsRes.status === 'fulfilled' ? alertsRes.value : [];
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
    capAlerts: alerts,
    tomorrowMax: tod?.temperature_2m_max?.[1] ?? null,
    tomorrowMin: tod?.temperature_2m_min?.[1] ?? null,
    tomorrowCode: tod?.weather_code?.[1] ?? null,
    tomorrowRain: tod?.precipitation_sum?.[1] ?? null,
  };
}

// ─── Synthesis: prompt + fallback ─────────────────────────────────────────────

function buildSynthesisPrompt(signals, locationName, pollenLabel) {
  const { temp, feelsLike, weatherLabel, windKph, uvIndex, aqi, pm25, rainNext3h,
          capAlerts, tomorrowMax, tomorrowMin, tomorrowCode, tomorrowRain } = signals;

  const now = new Date();
  const hour = now.getHours();
  const timeCtx = hour < 6 ? 'Before dawn' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 20 ? 'Evening' : 'Night';
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });

  const weatherLine = [
    temp != null ? `${Math.round(temp)}°C` : null,
    feelsLike != null ? `feels ${Math.round(feelsLike)}°C` : null,
    weatherLabel,
    windKph != null ? `wind ${Math.round(windKph)} km/h` : null,
    uvIndex != null ? `UV ${Math.round(uvIndex)} (${uvLabel(uvIndex)})` : null,
    rainNext3h != null ? `${Math.round(rainNext3h)}% rain next 3h` : null,
  ].filter(Boolean).join(' · ');

  const aqiLine = aqi != null
    ? `AQI ${aqi} (${aqiCat(aqi)})${pm25 != null ? ` · PM2.5 ${Math.round(pm25)}µg/m³` : ''}`
    : 'AQI unavailable';

  const alertsLine = capAlerts.length
    ? capAlerts.map((c) => `[${c.severity}] ${c.title}`).join(' | ')
    : 'No active PMD alerts';

  const tomorrowLine = tomorrowMax != null
    ? `${WMO_LABELS[tomorrowCode] ?? 'Variable'}, ${Math.round(tomorrowMin)}–${Math.round(tomorrowMax)}°C${tomorrowRain > 2 ? `, ${Math.round(tomorrowRain)}mm rain` : ''}`
    : 'Unavailable';

  return `
You are OutdoorAdvisor Pakistan — a calm, practical outdoor intelligence assistant.
Write a unified brief from live conditions. Be specific and grounded. No filler phrases.

LOCATION: ${locationName || 'Pakistan'} · ${day}, ${timeCtx}
WEATHER: ${weatherLine}
AIR QUALITY: ${aqiLine}${pollenLabel ? `\nPOLLEN: ${pollenLabel}` : ''}
ALERTS: ${alertsLine}
TOMORROW: ${tomorrowLine}

Return ONLY strict JSON — no markdown, no extra text:
{"severity":"go|caution|danger","headline":"","summary":"","actions":["",""],"window":""}

Rules:
- severity "danger" if: AQI > 200 OR Extreme/Severe alert OR thunderstorm imminent (code 95-99)
- severity "caution" if: AQI 100-200 OR Moderate alert OR active rain OR UV ≥ 8
- severity "go" otherwise
- headline: 8-12 words. The single most important signal right now.
- summary: exactly 2 sentences. First: what matters now (crossing weather+air). Second: outlook or key action.
- actions: exactly 2-3 short imperative phrases, max 8 words each. Most urgent first.
- window: best outdoor time in plain words ("Morning before 10 AM", "After 5 PM", "Wait for rain to clear", "All day fine") — or omit key entirely if genuinely unclear.
`.trim();
}

function synthesisFallback(signals, locationName, pollenLabel) {
  const { aqi, capAlerts, weatherCode, temp, feelsLike } = signals ?? {};
  const RAIN_CODES = [51,53,55,61,63,65,80,81,82,95,96,99];
  const isRaining = weatherCode != null && RAIN_CODES.includes(weatherCode);
  const aqiNum = aqi ?? 0;
  const hasExtreme = capAlerts?.some((a) => a.severity === 'Extreme' || a.severity === 'Severe');
  const hasMod = capAlerts?.some((a) => a.severity === 'Moderate');

  const severity = aqiNum > 200 || hasExtreme ? 'danger'
    : aqiNum > 100 || hasMod || isRaining ? 'caution'
    : 'go';

  const headline = severity === 'danger'
    ? 'Conditions are difficult — plan outdoor exposure carefully.'
    : severity === 'caution'
    ? 'Some caution needed before heading outside.'
    : 'Conditions look workable for most outdoor plans today.';

  const aqiNote = aqiNum > 150 ? `AQI is high at ${aqiNum} — limit extended exposure.`
    : aqiNum > 100 ? `AQI ${aqiNum} is moderate — sensitive groups take care.`
    : aqiNum > 0  ? `Air quality is good at AQI ${aqiNum}.`
    : '';

  const weatherNote = isRaining
    ? 'Rain is active — carry gear and add road margin.'
    : temp != null ? `It feels like ${Math.round(feelsLike ?? temp)}°C outside.`
    : 'Check the live conditions below.';

  const actions = [
    aqiNum > 150 ? 'Wear N95 mask outdoors' : null,
    isRaining ? 'Carry rain gear and drive carefully' : null,
    hasExtreme ? 'Review the PMD alert details below' : null,
    severity === 'go' && !isRaining ? 'Morning or evening slots are ideal' : null,
  ].filter(Boolean).slice(0, 3);

  return {
    provider: 'fallback',
    severity,
    headline,
    summary: [aqiNote, weatherNote].filter(Boolean).join(' ') || `${locationName || 'Your area'} — check the conditions below.`,
    actions: actions.length ? actions : ['Review the condition cards below'],
    window: null,
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
          maxOutputTokens: 400,
        },
      }),
    }
  ), 12000);
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Gemini error (${response.status})`);
  const text = extractTextFromResponse(json);
  const parsed = tryParseJson(text);
  if (!parsed?.headline || !parsed?.summary || !parsed?.severity) {
    throw new Error(`Bad Gemini output: ${text?.slice(0, 120)}`);
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
Use only the route, NHMP, PMD, and stop-condition data below.
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  const body = req.body || {};
  const { kind } = body;
  if (!kind) return sendJson(res, 400, { error: 'kind is required.' });

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '';
  const model     = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  // ── Synthesize: server fetches all sources, returns unified brief ─────────
  if (kind === 'synthesize') {
    const { lat, lon, locationName, pollenLabel } = body;
    if (!lat || !lon) return sendJson(res, 400, { error: 'lat and lon required for synthesize.' });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

    const signals = await fetchSynthesisData(Number(lat), Number(lon), googleKey);
    const fallback = synthesisFallback(signals, locationName, pollenLabel);

    // Synthesis is gated by GEMINI_API_KEY on the server — no token check needed.
    // Free/premium distinction is handled in the app UI (refresh limits, badge).
    if (!geminiKey) return sendJson(res, 200, fallback);

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
