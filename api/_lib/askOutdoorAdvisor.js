const OUTDOOR_TERMS = [
  'weather', 'rain', 'storm', 'thunder', 'wind', 'fog', 'smog', 'aqi', 'air quality',
  'heat', 'cold', 'temperature', 'forecast', 'outdoor', 'outside', 'walk', 'run',
  'running', 'cycle', 'cycling', 'football', 'cricket', 'golf', 'lunch', 'picnic',
  'hike', 'hiking', 'travel', 'trip', 'route', 'road', 'motorway', 'drive', 'driving',
  'go to', 'going to', 'visit', 'murree', 'multan', 'lahore', 'karachi', 'islamabad',
];

const ROUTE_TERMS = ['route', 'road', 'motorway', 'drive', 'driving', 'travel', 'trip', 'going to', 'go to'];
const NEARBY_TERMS = ['where', 'nearby', 'play', 'ground', 'park', 'lunch', 'restaurant', 'picnic'];

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

export function deriveAskVerdict({ weather = {}, aqi = null, officialMatches = [], routeMatches = [] }) {
  const feels = Number(weather.feelsLike ?? weather.temp);
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
    (Number.isFinite(feels) && (feels >= 36 || feels <= 5)) ||
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

export function buildAskFallback({ verdict, targetName, weather, aqi, routeMatches, officialMatches, nearbyPlaces }) {
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
  if (routeMatches?.[0]) bullets.push(`${routeMatches[0].route}: ${routeMatches[0].status}`);
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

Return strict JSON with exactly these keys:
{"headline":"<=9 words","answer":"<=80 words","bullets":["<=18 words","<=18 words","<=18 words"]}

USER QUESTION:
${question}

EVIDENCE:
${JSON.stringify(evidence, null, 2)}
`.trim();
}
