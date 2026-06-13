import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAskFallback,
  deriveAskVerdict,
  extractDestination,
  isAskAdvisoryFresh,
  isOutdoorQuestion,
  inferNhmpRoutePlan,
  matchNhmpRouteItems,
  matchOfficialItems,
  wantsNearbyEvidence,
  wantsRouteEvidence,
} from '../api/_lib/askOutdoorAdvisor.js';

test('recognizes supported outdoor questions and rejects unrelated questions', () => {
  assert.equal(isOutdoorQuestion('Should I go to Murree tomorrow evening?'), true);
  assert.equal(isOutdoorQuestion('Where can I play football right now?'), true);
  assert.equal(isOutdoorQuestion('Write me a poem about accounting'), false);
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

test('matches official items to relevant locations', () => {
  const alerts = [
    { title: 'Heavy rain warning for Murree and Rawalpindi' },
    { title: 'Heatwave warning for Jacobabad' },
  ];
  const matches = matchOfficialItems(alerts, ['Murree, Pakistan'], (item) => item.title);
  assert.equal(matches.length, 1);
  assert.match(matches[0].title, /Murree/);
});
