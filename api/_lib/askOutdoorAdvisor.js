const OUTDOOR_TERMS = [
  'weather', 'rain', 'storm', 'thunder', 'wind', 'fog', 'smog', 'aqi', 'air quality',
  'heat', 'cold', 'temperature', 'forecast', 'outdoor', 'outside', 'walk', 'run',
  'running', 'cycle', 'cycling', 'football', 'cricket', 'golf', 'lunch', 'picnic',
  'hike', 'hiking', 'camp', 'camping', 'trek', 'trekking', 'mountain', 'valley',
  'sightseeing', 'fishing', 'swimming', 'travel', 'trip', 'route', 'road', 'motorway', 'drive', 'driving',
  'go to', 'going to', 'visit', 'murree', 'multan', 'lahore', 'karachi', 'islamabad',
  'skardu', 'hunza', 'nathia gali', 'kalam', 'shogran', 'next week', 'weekend',
];

const ROUTE_TERMS = ['route', 'road', 'motorway', 'drive', 'driving', 'travel', 'trip', 'going to', 'go to'];
const NEARBY_TERMS = ['where', 'nearby', 'play', 'ground', 'park', 'lunch', 'restaurant', 'picnic', 'camp', 'camping', 'trail', 'hike'];
const ACTIVITY_TERMS = {
  camping: ['camp', 'camping', 'campsite'],
  hiking: ['hike', 'hiking', 'trek', 'trekking', 'trail'],
  football: ['football', 'soccer'],
  cricket: ['cricket'],
  cycling: ['cycle', 'cycling', 'bike', 'biking'],
  running: ['run', 'running', 'jog'],
  picnic: ['picnic'],
  outdoor_dining: ['lunch', 'dinner', 'eat', 'restaurant', 'dining'],
  sightseeing: ['sightseeing', 'visit', 'tour'],
  fishing: ['fish', 'fishing'],
  swimming: ['swim', 'swimming'],
};
const ROUTE_HUBS = {
  peshawar: { lat: 34.0151, lon: 71.5249 },
  islamabad: { lat: 33.6844, lon: 73.0479 },
  murree: { lat: 33.907, lon: 73.3943 },
  thakot: { lat: 34.8054, lon: 72.9383 },
  diKhan: { lat: 31.8626, lon: 70.9019 },
  lahore: { lat: 31.5204, lon: 74.3587 },
  sialkot: { lat: 32.4945, lon: 74.5229 },
  pindiBhattian: { lat: 31.895, lon: 73.273 },
  abdulHakeem: { lat: 30.552, lon: 72.127 },
  multan: { lat: 30.1575, lon: 71.5249 },
  sukkur: { lat: 27.7244, lon: 68.8228 },
  hyderabad: { lat: 25.396, lon: 68.3578 },
  karachi: { lat: 24.8607, lon: 67.0011 },
};
const ROUTE_EDGES = [
  ['peshawar', 'islamabad', 'M1', 155],
  ['islamabad', 'pindiBhattian', 'M2', 225],
  ['pindiBhattian', 'lahore', 'M2', 135],
  ['lahore', 'abdulHakeem', 'M3', 230],
  ['pindiBhattian', 'abdulHakeem', 'M4', 180],
  ['abdulHakeem', 'multan', 'M4', 100],
  ['multan', 'sukkur', 'M5', 390],
  ['sukkur', 'hyderabad', 'N5', 330],
  ['hyderabad', 'karachi', 'M9', 136],
  ['lahore', 'sialkot', 'M11', 103],
  ['islamabad', 'diKhan', 'M14', 285],
  ['islamabad', 'thakot', 'E35', 180],
  ['islamabad', 'murree', 'N75', 60],
];

export function normalizeQuestion(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export function isOutdoorQuestion(question) {
  const text = normalizeQuestion(question).toLowerCase();
  return text.length >= 4 && OUTDOOR_TERMS.some((term) => text.includes(term));
}

export function wantsRouteEvidence(question) {
  const text = normalizeQuestion(question).toLowerCase();
  return ROUTE_TERMS.some((term) => text.includes(term));
}

export function wantsNearbyEvidence(question) {
  const text = normalizeQuestion(question).toLowerCase();
  return NEARBY_TERMS.some((term) => text.includes(term));
}

function containsTerm(text, term) {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(text);
}

export function extractAskActivity(question, previousContext = {}) {
  const text = normalizeQuestion(question).toLowerCase();
  for (const [activity, terms] of Object.entries(ACTIVITY_TERMS)) {
    if (terms.some((term) => containsTerm(text, term))) return activity;
  }
  return previousContext.activity || '';
}

export function parseAskTimeWindow(question, previousContext = {}) {
  const text = normalizeQuestion(question).toLowerCase();
  if (/next\s+week|coming\s+week/.test(text)) return { key: 'next_week', label: 'next week', forecastDays: 10 };
  if (/weekend/.test(text)) return { key: 'weekend', label: 'this weekend', forecastDays: 7 };
  if (/tomorrow/.test(text)) {
    if (/morning/.test(text)) return { key: 'tomorrow_morning', label: 'tomorrow morning', forecastDays: 3 };
    if (/evening|night/.test(text)) return { key: 'tomorrow_evening', label: 'tomorrow evening', forecastDays: 3 };
    return { key: 'tomorrow', label: 'tomorrow', forecastDays: 3 };
  }
  if (/tonight|this\s+evening|evening/.test(text)) return { key: 'evening', label: 'this evening', forecastDays: 3 };
  if (/morning/.test(text)) return { key: 'morning', label: 'this morning', forecastDays: 3 };
  if (/today/.test(text)) return { key: 'today', label: 'today', forecastDays: 3 };
  if (/right\s+now|now|currently/.test(text)) return { key: 'now', label: 'right now', forecastDays: 3 };
  return previousContext.timeWindow || { key: 'now', label: 'right now', forecastDays: 3 };
}

export function classifyAskIntent(question, previousContext = {}) {
  const text = normalizeQuestion(question).toLowerCase();
  const activity = extractAskActivity(question, previousContext);
  const destination = extractDestination(question) || previousContext.destinationQuery || '';
  const asksWhere = /\bwhere\b|\brecommend\b|\bsuggest\b|\bfind\b|\bbest place\b/.test(text);
  const routeRequested = wantsRouteEvidence(question) || Boolean(destination && /\bgo\b|\bvisit\b|\btrip\b|\btravel\b/.test(text));
  const weatherOnly = /\bweather\b|\brain\b|\bforecast\b|\btemperature\b|\bwind\b|\bfog\b|\bsmog\b|\baqi\b/.test(text);

  if (asksWhere && activity) return 'nearby_discovery';
  if (destination && (routeRequested || previousContext.intent === 'destination_trip')) return 'destination_trip';
  if (activity) return 'activity_advice';
  if (routeRequested) return 'destination_trip';
  if (weatherOnly) return 'simple_weather';
  return previousContext.intent || 'general_outdoor';
}

export function buildAskContext(question, previousContext = {}) {
  const destinationQuery = extractDestination(question) || previousContext.destinationQuery || '';
  const activity = extractAskActivity(question, previousContext);
  const timeWindow = parseAskTimeWindow(question, previousContext);
  const intent = classifyAskIntent(question, { ...previousContext, destinationQuery, activity, timeWindow });
  return { intent, destinationQuery, activity, timeWindow };
}

function distanceKm(a, b) {
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLon = toRad(Number(b.lon) - Number(a.lon));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestRouteHub(point, maxDistanceKm = 140) {
  if (!Number.isFinite(Number(point?.lat)) || !Number.isFinite(Number(point?.lon))) return null;
  const nearest = Object.entries(ROUTE_HUBS)
    .map(([id, coords]) => ({ id, distance: distanceKm(point, coords) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest?.distance <= maxDistanceKm ? nearest : null;
}

export function extractNhmpRouteCode(item) {
  const text = `${item?.route || ''} ${item?.sector || ''}`;
  const match = text.match(/\b(M|N|E)\s*-?\s*(\d{1,2})\b/i);
  return match ? `${match[1].toUpperCase()}${match[2]}` : '';
}

export function inferNhmpRoutePlan(origin, destination) {
  const start = nearestRouteHub(origin);
  const end = nearestRouteHub(destination);
  if (!start || !end || start.id === end.id) return { codes: [], known: false };

  const graph = {};
  for (const [from, to, code, distance] of ROUTE_EDGES) {
    (graph[from] ||= []).push({ to, code, distance });
    (graph[to] ||= []).push({ to: from, code, distance });
  }

  const distances = { [start.id]: 0 };
  const paths = { [start.id]: [] };
  const pending = new Set(Object.keys(ROUTE_HUBS));
  while (pending.size) {
    const current = [...pending].sort((a, b) => (distances[a] ?? Infinity) - (distances[b] ?? Infinity))[0];
    pending.delete(current);
    if (current === end.id || !Number.isFinite(distances[current])) break;
    for (const edge of graph[current] || []) {
      const nextDistance = distances[current] + edge.distance;
      if (nextDistance < (distances[edge.to] ?? Infinity)) {
        distances[edge.to] = nextDistance;
        paths[edge.to] = [...paths[current], edge.code];
      }
    }
  }

  const codes = [...new Set(paths[end.id] || [])];
  return {
    codes,
    known: codes.length > 0,
    originHub: start.id,
    destinationHub: end.id,
  };
}

export function matchNhmpRouteItems(items, routePlan, locationTerms = []) {
  if (routePlan?.codes?.length) {
    const codes = new Set(routePlan.codes);
    return (items || []).filter((item) => codes.has(extractNhmpRouteCode(item)));
  }
  return matchOfficialItems(items, locationTerms, (item) => `${item?.route || ''} ${item?.sector || ''}`)
    .filter((item) => !/^nhmp corridor$/i.test(String(item?.route || '').trim()));
}

export function extractDestination(question) {
  const text = normalizeQuestion(question);
  const patterns = [
    /(?:going|driving|travel(?:ling)?|go|drive|trip)\s+to\s+([a-z][a-z .'-]{2,40}?)(?=\s+(?:tomorrow|today|tonight|this|right|now|on|at|in|by|via|from|for|after|before)|[?.!,]|$)/i,
    /(?:weather|forecast|rain|conditions?)\s+(?:for|in|at)\s+([a-z][a-z .'-]{2,40}?)(?=\s+(?:tomorrow|today|tonight|this|right|now|on|at|in|by|via|from|for|after|before)|[?.!,]|$)/i,
    /(?:visit|reach)\s+([a-z][a-z .'-]{2,40}?)(?=\s+(?:tomorrow|today|tonight|this|right|now|on|at|in|by|via|from|for|after|before)|[?.!,]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function containsHazard(text, pattern) {
  return pattern.test(String(text || ''));
}

export function isAskAdvisoryFresh(item, now = Date.now(), maxAgeDays = 7) {
  const expiry = item?.expires || item?.validUntil || item?.end || item?.endsAt;
  if (expiry) {
    const expiryTime = new Date(expiry).getTime();
    if (Number.isFinite(expiryTime)) return expiryTime >= now;
  }

  const date = item?.updatedAt || item?.date || item?.pubDate || item?.onset || item?.issuedTime || item?.effectiveTime;
  if (!date) return false;

  const dateText = String(date);
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(dateText)
    ? new Date(`${dateText}T23:59:59+05:00`).getTime()
    : new Date(dateText).getTime();
  if (!Number.isFinite(timestamp)) return false;

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return timestamp <= now + 24 * 60 * 60 * 1000 && now - timestamp <= maxAgeMs;
}

export function deriveAskVerdict({ activity = '', weather = {}, aqi = null, officialMatches = [], routeMatches = [] }) {
  const feels = Number(weather.feelsLike ?? weather.temp);
  const lowestFeels = Number(weather.minFeelsLike ?? weather.feelsLike ?? weather.temp);
  const wind = Number(weather.windKph);
  const rain = Number(weather.rainNext3h);
  const officialText = officialMatches.map((item) => `${item.severity || ''} ${item.text || ''}`).join(' ');
  const routeText = routeMatches.map((item) => `${item.severity || ''} ${item.status || ''}`).join(' ');
  const exposedActivity = ['camping', 'hiking', 'cycling', 'running', 'football', 'cricket', 'picnic', 'fishing'].includes(activity);

  const critical =
    (Number.isFinite(feels) && feels >= 45) ||
    (aqi != null && Number(aqi) >= 250) ||
    containsHazard(officialText, /extreme|severe|flash flood|glof|landslide|cyclone|evacuat/i) ||
    containsHazard(routeText, /closed|closure|blocked|not allowed/i);

  if (critical) return 'avoid';

  const caution =
    (Number.isFinite(feels) && feels >= 36) ||
    (Number.isFinite(lowestFeels) && lowestFeels <= 0) ||
    (Number.isFinite(wind) && wind >= (exposedActivity ? 25 : 35)) ||
    (Number.isFinite(rain) && rain >= (exposedActivity ? 30 : 45)) ||
    (aqi != null && Number(aqi) >= 101) ||
    officialMatches.length > 0 ||
    routeMatches.some((item) => item.severity && item.severity !== 'clear');

  return caution ? 'caution' : 'go';
}

export function matchOfficialItems(items, terms, textBuilder) {
  const needles = [...new Set((terms || [])
    .flatMap((value) => String(value || '').toLowerCase().split(/[^a-z0-9]+/))
    .filter((value) => value.length >= 4))];

  if (!needles.length) return [];

  return (items || []).filter((item) => {
    const haystack = String(textBuilder(item) || '').toLowerCase();
    return needles.some((needle) => haystack.includes(needle));
  });
}

export function buildAskFallback({
  context,
  verdict,
  targetName,
  weather,
  forecastWindow,
  bestActivityWindow,
  aqi,
  routeMatches,
  routeClarity,
  googleRoute,
  officialMatches,
  nearbyPlaces,
  discoveryOptions,
}) {
  const verdictLead = verdict === 'avoid'
    ? 'Avoid this plan for now.'
    : verdict === 'caution'
      ? 'You can go, but use caution.'
      : 'Conditions look workable.';

  const window = forecastWindow || weather || {};
  const facts = [];
  if (window?.feelsLike != null) facts.push(`feels like ${Math.round(window.feelsLike)}°C`);
  else if (window?.min != null && window?.max != null) facts.push(`${Math.round(window.min)}–${Math.round(window.max)}°C`);
  if (window?.rainChance != null) facts.push(`${Math.round(window.rainChance)}% rain chance`);
  else if (weather?.rainNext3h != null) facts.push(`${Math.round(weather.rainNext3h)}% near-term rain chance`);
  if (aqi != null) facts.push(`AQI ${Math.round(aqi)}`);
  if (routeMatches?.length) facts.push(`${routeMatches.length} relevant NHMP route update${routeMatches.length === 1 ? '' : 's'}`);
  if (officialMatches?.length) facts.push(`${officialMatches.length} relevant official alert${officialMatches.length === 1 ? '' : 's'}`);

  const bullets = [];
  const sections = [];
  if (routeClarity?.summary) bullets.push(routeClarity.summary);
  else if (routeMatches?.[0]) bullets.push(`${routeMatches[0].route}: ${routeMatches[0].status}`);
  const feelsLike = Number(weather?.feelsLike);
  if (
    Number.isFinite(feelsLike) &&
    feelsLike > 0 &&
    feelsLike <= 18 &&
    verdict !== 'avoid'
  ) {
    bullets.push('Cool destination weather may suit a heat-escape trip; pack warm layers.');
  }
  if (officialMatches?.[0]) bullets.push(officialMatches[0].text);
  if (nearbyPlaces?.[0]) bullets.push(`Nearby option: ${nearbyPlaces[0].name}${nearbyPlaces[0].address ? `, ${nearbyPlaces[0].address}` : ''}`);
  if (context?.activity === 'camping') bullets.push('For camping, verify overnight rain, wind, access, water, and local permission before leaving.');
  if (context?.activity === 'hiking') bullets.push('For hiking, start in daylight and avoid exposed trails during rain, lightning, or strong wind.');
  if (bestActivityWindow?.label) {
    bullets.push(`Best upcoming ${context?.activity || 'outdoor'} window: ${bestActivityWindow.label} · ${bestActivityWindow.condition || 'workable'}.`);
  }

  const intent = context?.intent || 'general_outdoor';
  const timeLabel = context?.timeWindow?.label || 'right now';
  if (intent === 'nearby_discovery') {
    const options = (discoveryOptions?.length ? discoveryOptions : nearbyPlaces || []).slice(0, 4);
    return {
      provider: 'fallback',
      verdict: options.length ? verdict : 'plan',
      headline: options.length ? `Shortlist for ${context?.activity || 'your plan'}` : 'Choose a destination first',
      answer: options.length
        ? `These options best match your ${context?.activity || 'outdoor'} request. Compare access, forecast, and official alerts before committing.`
        : 'I could not verify strong place matches yet. Name a preferred region or travel distance for a more reliable shortlist.',
      bullets: options.map((option) => `${option.name}${option.rating ? ` · ${option.rating}★` : ''}${option.weatherSummary ? ` · ${option.weatherSummary}` : ''}`).slice(0, 4),
      sections: options.length ? [{ title: 'Suggested places', items: options.map((option) => option.name).slice(0, 4) }] : [],
    };
  }

  if (intent === 'destination_trip') {
    sections.push({
      title: 'Journey',
      items: [
        googleRoute?.durationText ? `${googleRoute.distanceText} · about ${googleRoute.durationText}` : null,
        routeClarity?.summary,
      ].filter(Boolean),
    });
    sections.push({
      title: 'Destination',
      items: [
        `${targetName}: ${facts.join(', ') || 'forecast evidence is limited'} for ${timeLabel}.`,
        officialMatches?.[0]?.text,
        nearbyPlaces?.length ? `Ideas: ${nearbyPlaces.slice(0, 3).map((place) => place.name).join(', ')}.` : null,
      ].filter(Boolean),
    });
  } else if (intent === 'activity_advice') {
    sections.push({
      title: 'Plan',
      items: [
        `${context?.activity || 'Outdoor activity'} conditions for ${timeLabel}: ${facts.join(', ') || 'limited evidence'}.`,
        bestActivityWindow?.label ? `Best upcoming window: ${bestActivityWindow.label} (${bestActivityWindow.condition || 'workable'}).` : null,
        nearbyPlaces?.[0] ? `Place option: ${nearbyPlaces[0].name}` : null,
      ].filter(Boolean),
    });
  }

  return {
    provider: 'fallback',
    verdict,
    headline: verdictLead,
    answer: `${targetName || 'Your area'} has ${facts.length ? facts.join(', ') : 'limited evidence'} for ${timeLabel}. ${intent === 'simple_weather' ? '' : 'Recheck shortly before leaving because conditions and advisories can change.'}`.trim(),
    bullets: bullets.slice(0, 4),
    sections,
  };
}

export function buildAskPrompt({ question, evidence, fallback }) {
  return `
You are Ask OutdoorAdvisor, a Pakistan-focused weather, outdoor, and travel decision assistant.
Answer ONLY from the supplied evidence. Never invent a road status, forecast, place, alert, or source.
The deterministic safety verdict is "${fallback.verdict}" and MUST NOT be softened or changed.
If a requested source is unavailable, say so briefly. Keep the answer concise and practical.
Cool destination weather is not automatically bad: people may travel specifically for cooler conditions. Present it as a benefit unless freezing, ice, snow, strong wind, or a current official warning creates a real risk.
Use only fresh/current advisories in the supplied evidence. For route questions, clearly state whether NHMP has a relevant warning, no relevant warning was found, or live route clarity is unavailable.

Tailor the answer to EVIDENCE.context.intent. Simple weather questions may be brief. Activity, discovery, and trip questions must give specific recommendations and explicitly use the relevant places, route, forecast window, and official alerts.
Do not repeat generic phrases such as "recheck before leaving" as the main answer. If named places, route codes, route duration, best activity window, or specific alerts exist, mention them.
Follow-up questions inherit destination/activity context from EVIDENCE.context.

Return strict JSON with exactly these keys:
{"headline":"<=9 words","answer":"<=100 words","bullets":["<=22 words","<=22 words","<=22 words","<=22 words"],"sections":[{"title":"<=3 words","items":["<=24 words","<=24 words"]}]}

USER QUESTION:
${question}

EVIDENCE:
${JSON.stringify(evidence, null, 2)}
`.trim();
}
