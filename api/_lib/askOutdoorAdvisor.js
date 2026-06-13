const OUTDOOR_TERMS = [
  'weather', 'rain', 'storm', 'thunder', 'wind', 'fog', 'smog', 'aqi', 'air quality',
  'heat', 'cold', 'temperature', 'forecast', 'outdoor', 'outside', 'walk', 'run',
  'running', 'cycle', 'cycling', 'football', 'cricket', 'golf', 'lunch', 'picnic',
  'hike', 'hiking', 'travel', 'trip', 'route', 'road', 'motorway', 'drive', 'driving',
  'go to', 'going to', 'visit', 'murree', 'multan', 'lahore', 'karachi', 'islamabad',
];

const ROUTE_TERMS = ['route', 'road', 'motorway', 'drive', 'driving', 'travel', 'trip', 'going to', 'go to'];
const NEARBY_TERMS = ['where', 'nearby', 'play', 'ground', 'park', 'lunch', 'restaurant', 'picnic'];
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
    /(?:going|driving|travel(?:ling)?|go|drive|trip)\s+to\s+([a-z][a-z .'-]{2,40}?)(?=\s+(?:tomorrow|today|tonight|this|right|now|on|at|in|by|via|from|after|before)|[?.!,]|$)/i,
    /(?:weather|forecast|rain|conditions?)\s+(?:for|in|at)\s+([a-z][a-z .'-]{2,40}?)(?=\s+(?:tomorrow|today|tonight|this|right|now|on|at|in|by|via|from|after|before)|[?.!,]|$)/i,
    /(?:visit|reach)\s+([a-z][a-z .'-]{2,40}?)(?=\s+(?:tomorrow|today|tonight|this|right|now|on|at|in|by|via|from|after|before)|[?.!,]|$)/i,
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

export function deriveAskVerdict({ weather = {}, aqi = null, officialMatches = [], routeMatches = [] }) {
  const feels = Number(weather.feelsLike ?? weather.temp);
  const lowestFeels = Number(weather.minFeelsLike ?? weather.feelsLike ?? weather.temp);
  const wind = Number(weather.windKph);
  const rain = Number(weather.rainNext3h);
  const officialText = officialMatches.map((item) => `${item.severity || ''} ${item.text || ''}`).join(' ');
  const routeText = routeMatches.map((item) => `${item.severity || ''} ${item.status || ''}`).join(' ');

  const critical =
    (Number.isFinite(feels) && feels >= 45) ||
    (aqi != null && Number(aqi) >= 250) ||
    containsHazard(officialText, /extreme|severe|flash flood|glof|landslide|cyclone|evacuat/i) ||
    containsHazard(routeText, /closed|closure|blocked|not allowed/i);

  if (critical) return 'avoid';

  const caution =
    (Number.isFinite(feels) && feels >= 36) ||
    (Number.isFinite(lowestFeels) && lowestFeels <= 0) ||
    (Number.isFinite(wind) && wind >= 35) ||
    (Number.isFinite(rain) && rain >= 45) ||
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
  verdict,
  targetName,
  weather,
  aqi,
  routeMatches,
  routeClarity,
  officialMatches,
  nearbyPlaces,
}) {
  const verdictLead = verdict === 'avoid'
    ? 'Avoid this plan for now.'
    : verdict === 'caution'
      ? 'You can go, but use caution.'
      : 'Conditions look workable.';

  const facts = [];
  if (weather?.feelsLike != null) facts.push(`feels like ${Math.round(weather.feelsLike)}°C`);
  if (weather?.rainNext3h != null) facts.push(`${Math.round(weather.rainNext3h)}% near-term rain chance`);
  if (aqi != null) facts.push(`AQI ${Math.round(aqi)}`);
  if (routeMatches?.length) facts.push(`${routeMatches.length} relevant NHMP route update${routeMatches.length === 1 ? '' : 's'}`);
  if (officialMatches?.length) facts.push(`${officialMatches.length} relevant official alert${officialMatches.length === 1 ? '' : 's'}`);

  const bullets = [];
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

  return {
    provider: 'fallback',
    verdict,
    headline: verdictLead,
    answer: `${targetName || 'Your area'} currently has ${facts.length ? facts.join(', ') : 'limited live evidence'}. Recheck shortly before leaving because conditions and road advisories can change.`,
    bullets: bullets.slice(0, 3),
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

Return strict JSON with exactly these keys:
{"headline":"<=9 words","answer":"<=80 words","bullets":["<=18 words","<=18 words","<=18 words"]}

USER QUESTION:
${question}

EVIDENCE:
${JSON.stringify(evidence, null, 2)}
`.trim();
}
