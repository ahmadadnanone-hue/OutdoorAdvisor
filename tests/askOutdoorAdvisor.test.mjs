import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAskVerdict,
  extractDestination,
  isOutdoorQuestion,
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

test('matches official items to relevant locations', () => {
  const alerts = [
    { title: 'Heavy rain warning for Murree and Rawalpindi' },
    { title: 'Heatwave warning for Jacobabad' },
  ];
  const matches = matchOfficialItems(alerts, ['Murree, Pakistan'], (item) => item.title);
  assert.equal(matches.length, 1);
  assert.match(matches[0].title, /Murree/);
});
