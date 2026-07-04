// AI notification writer.
//
// Every push the alert engine dispatches (morning brief, evening planner, and
// all weather/AQI/official/route alerts) gets its title/body written by Gemini
// from a grounded evidence bundle — the same "analyse everything, then speak"
// approach as Ask OutdoorAdvisor. The deterministic rule engine still decides
// WHEN to alert and its verdict/severity are never changed here.
//
// Freshness model ("N analyses per day"):
// - AI copy is cached in engine state per rounded location + alert type.
// - A cache entry is valid for 24h / AI_NOTIFY_TIMES_PER_DAY (default 6 → ~4h),
//   shortened when the evidence itself is time-bound (e.g. rain arriving at a
//   known hour) and lengthened for static official advisories (PMD/NDMA text
//   does not change once issued).
// - While an entry is valid — or when Gemini is unavailable / the daily call
//   cap is reached — the previous AI analysis is reused.
// - If the evidence changes materially (coarse hash mismatch) a fresh Gemini
//   call is made, otherwise nothing is spent.
//
// Fallback: any failure (no GEMINI_API_KEY, timeout, bad JSON, cap exhausted
// with no reusable cache) leaves the rule-engine copy untouched, so the
// existing system remains the guaranteed delivery path.

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_TIMES_PER_DAY = 6;
const DEFAULT_DAILY_CALL_CAP = 80;
const GEMINI_TIMEOUT_MS = 12000;
const CACHE_RETENTION_MS = 48 * 60 * 60 * 1000;
const OFFICIAL_ALERT_TYPES = new Set(['pmd-critical', 'ndma', 'native-weather-alert']);

const DECISION_PREFIX = {
  avoid: 'Avoid outdoors',
  caution: 'Use caution',
  go: 'Good to go',
  plan: 'Plan ahead',
};

export function aiNotifierEnabled() {
  if (String(process.env.AI_NOTIFY_DISABLED || '') === '1') return false;
  return Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim());
}

export function getAiRefreshIntervalMs() {
  const times = Number(process.env.AI_NOTIFY_TIMES_PER_DAY || DEFAULT_TIMES_PER_DAY);
  const perDay = Number.isFinite(times) && times >= 1 ? Math.min(times, 48) : DEFAULT_TIMES_PER_DAY;
  return Math.round((24 * 60 * 60 * 1000) / perDay);
}

function getDailyCallCap() {
  const cap = Number(process.env.AI_NOTIFY_DAILY_CALL_CAP || DEFAULT_DAILY_CALL_CAP);
  return Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_CALL_CAP;
}

// Main entry: returns the candidate with AI title/body applied, or the
// original candidate when AI copy is unavailable.
export async function applyAiNotificationCopy({
  device,
  ctx,
  candidate,
  officialItems = [],
  city,
  state,
  now = new Date(),
  day,
}) {
  if (!aiNotifierEnabled()) return candidate;

  const evidence = buildNotificationEvidence({ device, ctx, candidate, officialItems, city, now });
  const hash = computeEvidenceHash(evidence, candidate);
  const cacheKey = buildCacheKey(device, candidate);
  state.aiCopy = state.aiCopy || {};
  const cached = state.aiCopy[cacheKey];
  const nowMs = now.getTime();

  if (cached?.hash === hash && nowMs < Number(cached.validUntil || 0)) {
    return decorate(candidate, cached);
  }

  const critical = candidate.severity === 'critical';
  if (!consumeAiBudget(state, day, critical)) {
    // Cap reached: reuse the previous analysis for the same situation even if
    // its refresh window elapsed; otherwise fall back to rule copy.
    if (cached?.hash === hash) return decorate(candidate, cached);
    return candidate;
  }

  try {
    const copy = await callGeminiNotification(evidence, candidate);
    const entry = {
      hash,
      title: copy.title,
      body: copy.body,
      at: nowMs,
      validUntil: computeValidUntil(candidate, nowMs),
    };
    state.aiCopy[cacheKey] = entry;
    return decorate(candidate, entry);
  } catch (error) {
    state.aiLastError = { message: error?.message || 'AI notification copy failed', at: nowMs };
    if (cached?.hash === hash) return decorate(candidate, cached);
    return candidate;
  }
}

export function pruneAiWriterState(state, now = new Date()) {
  const cutoff = now.getTime() - CACHE_RETENTION_MS;
  for (const [key, entry] of Object.entries(state.aiCopy || {})) {
    if (!Number.isFinite(entry?.at) || entry.at < cutoff) delete state.aiCopy[key];
  }
}

export function getAiWriterStatus(state) {
  return {
    enabled: aiNotifierEnabled(),
    refreshIntervalMinutes: Math.round(getAiRefreshIntervalMs() / 60000),
    dailyCallCap: getDailyCallCap(),
    todayCalls: state?.aiBudget?.count || 0,
    cacheEntries: Object.keys(state?.aiCopy || {}).length,
    lastError: state?.aiLastError || null,
  };
}

// ─── Copy application ────────────────────────────────────────────────────────
function decorate(candidate, entry) {
  const body = withDecision(candidate.decision, stripDecisionPrefix(entry.body));
  return {
    ...candidate,
    title: truncate(entry.title, 60),
    body: truncate(body, 380),
    data: { ...(candidate.data || {}), ai: true },
  };
}

function withDecision(decision, text) {
  const prefix = DECISION_PREFIX[decision];
  return prefix ? `${prefix} — ${text}` : text;
}

function stripDecisionPrefix(text) {
  return String(text || '')
    .replace(/^(avoid outdoors?|use caution|good to go|plan ahead|caution|avoid)\s*[—:–-]\s*/i, '')
    .trim();
}

// ─── Budget (global daily cap on Gemini calls) ───────────────────────────────
function consumeAiBudget(state, day, critical) {
  const cap = getDailyCallCap();
  const record = state.aiBudget?.day === day ? state.aiBudget : { day, count: 0 };
  if (!critical && record.count >= cap) {
    state.aiBudget = record;
    return false;
  }
  state.aiBudget = { day, count: record.count + 1 };
  return true;
}

// ─── Evidence bundle ─────────────────────────────────────────────────────────
function buildNotificationEvidence({ device, ctx, candidate, officialItems, city, now }) {
  const wx = ctx?.wx || null;
  const aqi = ctx?.aqi || null;
  const timeZone = device.timezone || 'Asia/Karachi';

  return {
    alertType: candidate.type,
    severity: candidate.severity,
    verdict: candidate.decision,
    city: city || 'your pinned area',
    localTime: formatLocalTime(now, timeZone),
    trigger: candidate.data || {},
    ruleEngineCopy: { title: candidate.title, body: candidate.body },
    current: wx ? {
      temp: roundOrNull(wx.temp),
      feelsLike: roundOrNull(wx.feelsLike),
      humidity: roundOrNull(wx.humidity),
      windKph: roundOrNull(wx.windSpeed),
      gustsKph: roundOrNull(wx.windGusts),
      visibilityM: roundOrNull(wx.visibility),
      condition: conditionLabel(wx),
    } : null,
    nextHours: futureHours(wx, now, 12),
    daily: (wx?.daily || []).slice(0, 2).map((dayItem) => ({
      date: dayItem.date,
      maxTemp: roundOrNull(dayItem.maxTemp),
      minTemp: roundOrNull(dayItem.minTemp),
      rainChance: roundOrNull(dayItem.precipProbability),
      uvIndex: roundOrNull(dayItem.uvIndex),
    })),
    airQuality: aqi ? {
      aqi: roundOrNull(aqi.aqi),
      pm25: roundOrNull(aqi.pm25),
      category: aqi.category || null,
    } : null,
    officialAdvisories: (officialItems || []).slice(0, 4),
  };
}

function futureHours(wx, now, hours) {
  const nowMs = now.getTime();
  const maxMs = nowMs + hours * 60 * 60 * 1000;
  return (wx?.hourly || [])
    .filter((hour) => {
      const at = hour?.time ? new Date(hour.time).getTime() : NaN;
      return Number.isFinite(at) && at >= nowMs - 30 * 60 * 1000 && at <= maxMs;
    })
    .slice(0, 12)
    .map((hour) => ({
      time: hour.time,
      temp: roundOrNull(hour.temp),
      rainChance: roundOrNull(hour.precipProbability),
    }));
}

function conditionLabel(wx) {
  if (wx?.conditionCode) {
    return String(wx.conditionCode).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }
  return wx?.weatherCode != null ? `wmo-${wx.weatherCode}` : null;
}

function formatLocalTime(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function roundOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

// Coarse hash so minor fluctuations (1° temp, small AQI drift) reuse the
// cached analysis instead of spending a Gemini call.
function computeEvidenceHash(evidence, candidate) {
  const coarse = {
    type: candidate.type,
    verdict: candidate.decision,
    city: evidence.city,
    feels: bucket(evidence.current?.feelsLike, 2),
    condition: evidence.current?.condition || null,
    gusts: bucket(evidence.current?.gustsKph, 10),
    aqi: bucket(evidence.airQuality?.aqi, 25),
    pm25: bucket(evidence.airQuality?.pm25, 25),
    peakRain: bucket(Math.max(0, ...evidence.nextHours.map((hour) => hour.rainChance || 0)), 20),
    official: evidence.officialAdvisories.map((item) => item.key || item.title).join('|'),
    trigger: candidate.type === 'motorway' || candidate.type === 'route-closure'
      ? `${candidate.data?.routeId}:${candidate.data?.changeType}`
      : null,
    // Briefs cover a specific day; a new day is always a new situation.
    day: candidate.brief ? String(candidate.cooldownKey || '') : null,
  };
  return hashKey(JSON.stringify(coarse));
}

function bucket(value, size) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number / size) * size : null;
}

function hashKey(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

function buildCacheKey(device, candidate) {
  const lat = Number(device.location?.lat);
  const lon = Number(device.location?.lon);
  const coord = Number.isFinite(lat) && Number.isFinite(lon)
    ? `${lat.toFixed(2)},${lon.toFixed(2)}`
    : 'no-pin';
  return `${coord}:${candidate.type}`;
}

// How long this AI analysis stays valid before the next scheduled refresh.
// Time-bound evidence (rain arrival) expires sooner; static official advisory
// text stays valid longer.
function computeValidUntil(candidate, nowMs) {
  const interval = getAiRefreshIntervalMs();
  let validUntil = nowMs + interval;

  const rainAt = candidate.data?.rainAt ? new Date(candidate.data.rainAt).getTime() : NaN;
  if (Number.isFinite(rainAt) && rainAt > nowMs) {
    validUntil = Math.min(validUntil, rainAt);
  }
  if (OFFICIAL_ALERT_TYPES.has(candidate.type)) {
    validUntil = Math.max(validUntil, nowMs + 12 * 60 * 60 * 1000);
  }
  return validUntil;
}

// ─── Gemini ──────────────────────────────────────────────────────────────────
function buildNotificationPrompt(evidence, candidate) {
  const isBrief = Boolean(candidate.brief);
  return `
You are OutdoorAdvisor's push-notification writer for Pakistan.
Write ONE ${isBrief ? 'daily outdoor briefing' : 'alert'} notification using ONLY the supplied evidence. Never invent a forecast, road status, alert, place, or number.
The deterministic safety verdict is "${evidence.verdict}" and the alert type is "${evidence.alertType}". Do not soften, contradict, or restate the verdict — the app prepends it automatically, so do NOT begin the body with phrases like "Avoid outdoors" or "Use caution".
Lead with the most decision-useful specifics: exact numbers, timing (use the local times in the evidence), and what the user should do or when the better window is.
If officialAdvisories are present (PMD/NDMA/WeatherKit), name the source and hazard and reflect its timing or validity — e.g. a monsoon system arriving on a stated date applies until that date passes.
${isBrief ? 'Cover today end-to-end: current conditions, how the day evolves, air quality, any official warning, and the best/worst windows.' : 'Focus on the triggering hazard; mention other evidence only when it changes what the user should do.'}
Calm, practical, specific. No emojis, no marketing tone, no "recheck later" filler.
Return strict JSON with exactly: {"title":"<=55 characters, no verdict words","body":"<=300 characters"}

EVIDENCE:
${JSON.stringify(evidence, null, 2)}
`.trim();
}

async function callGeminiNotification(evidence, candidate) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
  const model = (process.env.AI_NOTIFY_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildNotificationPrompt(evidence, candidate) }] }],
        generationConfig: {
          temperature: 0.35,
          topP: 0.85,
          maxOutputTokens: 300,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    },
  );

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || `Gemini request failed (${response.status})`);
  }

  const text = json?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '';
  const parsed = tryParseJson(text);
  const title = String(parsed?.title || '').trim();
  const body = String(parsed?.body || '').trim();
  if (!title || !body) throw new Error('Gemini returned an invalid notification payload.');
  return { title, body };
}

function tryParseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
