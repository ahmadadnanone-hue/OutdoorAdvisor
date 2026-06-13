import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSuddenWeatherCandidates,
  getFutureHourly,
  getRainSoonSignal,
} from '../api/_lib/alertEngine.js';

const NOW = new Date('2026-06-13T10:00:00.000Z');

function hourly(hoursFromNow, probability, weatherCode = 0) {
  return {
    time: new Date(NOW.getTime() + hoursFromNow * 60 * 60 * 1000).toISOString(),
    precipProbability: probability,
    weatherCode,
    conditionCode: null,
  };
}

test('future hourly filter ignores past hours and respects lead time', () => {
  const wx = { hourly: [hourly(-2, 90), hourly(1, 20), hourly(3, 70), hourly(5, 95)] };
  assert.deepEqual(
    getFutureHourly(wx, { now: NOW, leadHours: 3 }).map((item) => item.precipProbability),
    [20, 70],
  );
});

test('rain-soon signal reports the configured future probability', () => {
  const wx = { hourly: [hourly(-1, 100), hourly(1, 55), hourly(2, 75)] };
  const signal = getRainSoonSignal(wx, {
    now: NOW,
    probabilityThreshold: 70,
    leadHours: 3,
  });
  assert.equal(signal.probability, 75);
  assert.equal(signal.minutes, 120);
  assert.match(signal.label, /75% rain risk/);
});

test('sudden rain candidate explains a sharp probability jump', () => {
  const device = {
    preferences: { rainAlerts: true, windAlerts: false, fogWarnings: false, heatAlerts: false, severeAqiWarnings: false },
    thresholds: { rainProbabilityAlert: 60, rainProbabilityJump: 25, rainLeadHours: 3 },
  };
  const candidates = buildSuddenWeatherCandidates({
    device,
    wx: { hourly: [hourly(1, 75)], windGusts: 10, visibility: 10000, feelsLike: 30 },
    aqi: null,
    previous: { at: NOW.getTime() - 20 * 60 * 1000, rainProbability: 20, windGusts: 10, visibility: 10000, feelsLike: 30, aqi: null },
    city: 'Lahore',
    now: NOW,
  });
  assert.equal(candidates[0].type, 'sudden-rain');
  assert.match(candidates[0].body, /20% to 75%/);
});

test('old snapshots do not trigger sudden-change alerts', () => {
  const candidates = buildSuddenWeatherCandidates({
    device: { preferences: { rainAlerts: true }, thresholds: {} },
    wx: { hourly: [hourly(1, 90)] },
    aqi: null,
    previous: { at: NOW.getTime() - 7 * 60 * 60 * 1000, rainProbability: 0 },
    city: 'Lahore',
    now: NOW,
  });
  assert.deepEqual(candidates, []);
});
