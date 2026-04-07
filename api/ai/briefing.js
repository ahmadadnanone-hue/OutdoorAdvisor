import { createClient } from '@supabase/supabase-js';
import { derivePremiumState } from '../../src/lib/premium.js';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
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
    return derivePremiumState(data.user);
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
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const { kind, payload } = req.body || {};
  if (!kind || !payload) {
    return sendJson(res, 400, { error: 'kind and payload are required.' });
  }

  const fallback = kind === 'travel' ? travelFallback(payload) : homeFallback(payload);
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  const premiumState = await getRequestPremiumState(req);

  if (!apiKey || !premiumState.isPremium) {
    return sendJson(res, 200, fallback);
  }

  try {
    const prompt = kind === 'travel' ? buildTravelPrompt(payload) : buildHomePrompt(payload);
    const result = await callGemini(model, apiKey, prompt);
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
