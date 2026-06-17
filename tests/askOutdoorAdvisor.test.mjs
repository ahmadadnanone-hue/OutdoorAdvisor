import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAskFallback,
  buildAskContext,
  classifyAskIntent,
  deriveAskVerdict,
  extractDestination,
  isAskAdvisoryFresh,
  isOutdoorQuestion,
  inferNhmpRoutePlan,
  matchNhmpRouteItems,
  matchOfficialItems,
  parseAskTimeWindow,
  wantsNearbyEvidence,
  wantsRouteEvidence,
} from '../api/_lib/askOutdoorAdvisor.js';

test('recognizes supported outdoor questions and rejects unrelated questions', () => {
  assert.equal(isOutdoorQuestion('Should I go to Murree tomorrow evening?'), true);
  assert.equal(isOutdoorQuestion('Where can I play football right now?'), true);
  assert.equal(isOutdoorQuestion('Where can I go camping in the mountains?'), true);
  assert.equal(isOutdoorQuestion('Where to play tennis now?'), true);
  assert.equal(isOutdoorQuestion('Write me a poem about accounting'), false);
});

test('classifies discovery, activity, trip, and forecast questions', () => {
  assert.equal(classifyAskIntent('Where can I go camping in the mountains?'), 'nearby_discovery');
  assert.equal(classifyAskIntent('Where to play tennis now?'), 'nearby_discovery');
  assert.equal(classifyAskIntent('Can I play football tonight?'), 'activity_advice');
  assert.equal(classifyAskIntent('Should I go to Skardu tomorrow?'), 'destination_trip');
  assert.equal(classifyAskIntent('What is the weather next week?'), 'simple_weather');
});

test('follow-up questions inherit destination and activity context', () => {
  const previous = buildAskContext('Should I go to Skardu for hiking tomorrow?');
  const followUp = buildAskContext('What about next week?', previous);
  assert.equal(followUp.destinationQuery, 'Skardu');
  assert.equal(followUp.activity, 'hiking');
  assert.equal(followUp.timeWindow.key, 'next_week');
  assert.equal(followUp.intent, 'destination_trip');
});

test('parses requested forecast windows', () => {
  assert.equal(parseAskTimeWindow('What about next week?').forecastDays, 10);
  assert.equal(parseAskTimeWindow('Tomorrow evening').key, 'tomorrow_evening');
});

test('extracts travel and forecast destinations', () => {
  assert.equal(extractDestination('Should I go to Murree tomorrow evening?'), 'Murree');
  assert.equal(extractDestination('What is the weather in Multan tomorrow?'), 'Multan');
  assert.equal(extractDestination('Where can I play football right now?'), '');
});

test('detects evidence requirements', () => {
  assert.equal(wantsRouteEvidence('I am going to Multan now. Check the motorway.'), true);
  assert.equal(wantsNearbyEvidence('Where can I play football right now?'), true);
  assert.equal(wantsRouteEvidence('Will it rain tomorrow?'), false);
});

test('maps Lahore to Multan to M3 and M4, never M1', () => {
  const plan = inferNhmpRoutePlan(
    { lat: 31.5204, lon: 74.3587 },
    { lat: 30.1575, lon: 71.5249 }
  );
  assert.deepEqual(plan.codes, ['M3', 'M4']);

  const matches = matchNhmpRouteItems([
    { route: 'M1 (Peshawar to Islamabad Motorway)', status: 'Road & Weather Clear' },
    { route: 'M3 (Lahore to Abdul Hakeem)', status: 'Road & Weather Clear' },
    { route: 'M4 (Abdul Hakeem to Multan)', status: 'Road & Weather Clear' },
  ], plan);
  assert.deepEqual(matches.map((item) => item.route.slice(0, 2)), ['M3', 'M4']);
});

test('maps Islamabad to Multan through M2 and M4', () => {
  const plan = inferNhmpRoutePlan(
    { lat: 33.6844, lon: 73.0479 },
    { lat: 30.1575, lon: 71.5249 }
  );
  assert.deepEqual(plan.codes, ['M2', 'M4']);
});

test('deterministic verdict never softens closures or extreme heat', () => {
  assert.equal(deriveAskVerdict({
    weather: { feelsLike: 46, rainNext3h: 10, windKph: 5 },
    aqi: 40,
    officialMatches: [],
    routeMatches: [],
  }), 'avoid');

  assert.equal(deriveAskVerdict({
    weather: { feelsLike: 28, rainNext3h: 10, windKph: 5 },
    aqi: 40,
    officialMatches: [],
    routeMatches: [{ severity: 'closed', status: 'Motorway closed due to fog' }],
  }), 'avoid');
});

test('cool destination weather is workable while freezing conditions remain cautionary', () => {
  assert.equal(deriveAskVerdict({
    weather: { feelsLike: 5, rainNext3h: 5, windKph: 8 },
    aqi: 40,
    officialMatches: [],
    routeMatches: [],
  }), 'go');

  assert.equal(deriveAskVerdict({
    weather: { feelsLike: 7, minFeelsLike: -1, rainNext3h: 5, windKph: 8 },
    aqi: 40,
    officialMatches: [],
    routeMatches: [],
  }), 'caution');
});

test('exposed activities use stricter rain and wind thresholds', () => {
  assert.equal(deriveAskVerdict({
    activity: 'camping',
    weather: { feelsLike: 20, rainNext3h: 35, windKph: 10 },
    aqi: 40,
    officialMatches: [],
    routeMatches: [],
  }), 'caution');
});

test('drops old advisories while retaining current or explicitly valid advisories', () => {
  const now = new Date('2026-06-13T12:00:00+05:00').getTime();
  assert.equal(isAskAdvisoryFresh({ date: '2026-06-01' }, now), false);
  assert.equal(isAskAdvisoryFresh({ date: '2026-06-10' }, now), true);
  assert.equal(isAskAdvisoryFresh({
    date: '2026-06-01',
    validUntil: '2026-06-14T12:00:00+05:00',
  }, now), true);
});

test('fallback explains cool-weather benefit and route clarity', () => {
  const result = buildAskFallback({
    verdict: 'go',
    targetName: 'Skardu',
    weather: { feelsLike: 9, rainNext3h: 5 },
    aqi: 65,
    routeMatches: [],
    routeClarity: {
      status: 'unavailable',
      summary: 'Live NHMP route clarity is unavailable; check NHMP directly before leaving.',
    },
    officialMatches: [],
    nearbyPlaces: [],
  });

  assert.match(result.bullets[0], /route clarity is unavailable/i);
  assert.match(result.bullets[1], /cool destination weather/i);
});

test('discovery fallback recommends named places instead of current-condition boilerplate', () => {
  const result = buildAskFallback({
    context: { intent: 'nearby_discovery', activity: 'camping', timeWindow: { label: 'this weekend' } },
    verdict: 'go',
    targetName: 'Lahore',
    weather: { feelsLike: 35 },
    discoveryOptions: [
      { name: 'Upper Kachura Lake', rating: 4.7, weatherSummary: 'Clear sky, 8–19°C, 10% rain' },
      { name: 'Shogran', rating: 4.6, weatherSummary: 'Partly cloudy, 9–20°C, 20% rain' },
    ],
  });
  assert.match(result.headline, /shortlist/i);
  assert.match(result.bullets[0], /Upper Kachura Lake/);
  assert.doesNotMatch(result.answer, /currently has/i);
});

test('matches official items to relevant locations', () => {
  const alerts = [
    { title: 'Heavy rain warning for Murree and Rawalpindi' },
    { title: 'Heatwave warning for Jacobabad' },
  ];
  const matches = matchOfficialItems(alerts, ['Murree, Pakistan'], (item) => item.title);
  assert.equal(matches.length, 1);
  assert.match(matches[0].title, /Murree/);
});
