import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNdmaAdvisory,
  parseNdmaAdvisories,
  shouldHighlightNdmaAdvisory,
} from '../api/_lib/ndmaAdvisories.js';

test('fresh generic NDMA advisories are highlighted while their hazard is still unknown', () => {
  const now = new Date('2026-06-15T12:00:00+05:00').getTime();
  const classification = classifyNdmaAdvisory('NDMA Weather Advisory - 15 June 2026');

  assert.equal(classification.important, false);
  assert.equal(shouldHighlightNdmaAdvisory({ ...classification, date: '2026-06-15' }, now), true);
});

test('old generic advisories are not highlighted indefinitely', () => {
  const now = new Date('2026-06-15T12:00:00+05:00').getTime();
  const classification = classifyNdmaAdvisory('NDMA Weather Advisory - 10 June 2026');

  assert.equal(shouldHighlightNdmaAdvisory({ ...classification, date: '2026-06-10' }, now), false);
});

test('parser promotes a newly published generic advisory into the national watch', () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const [year, month, day] = today.split('-');
  const monthName = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'Asia/Karachi',
  }).format(new Date(`${today}T12:00:00+05:00`));
  const html = `
    <a href="/storage/advisories/${monthName}${year}/latest.pdf">
      NDMA Weather Advisory - ${Number(day)} ${monthName} ${year}
    </a>
  `;

  const [advisory] = parseNdmaAdvisories(html);
  assert.equal(advisory.date, today);
  assert.equal(advisory.hazard, 'Weather advisory');
  assert.equal(advisory.important, true);
});
