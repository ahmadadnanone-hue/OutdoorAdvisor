import { fetchNdmaAdvisories, summarizeNdmaForBrief } from './_lib/ndmaAdvisories.js';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 20));
    const locationName = String(req.query.location || '').trim();
    const advisories = await fetchNdmaAdvisories({ limit });
    return sendJson(res, 200, {
      success: true,
      source: 'NDMA',
      sourceUrl: 'https://www.ndma.gov.pk/advisories',
      fetchedAt: new Date().toISOString(),
      advisories,
      brief: summarizeNdmaForBrief(advisories, locationName),
    });
  } catch (error) {
    return sendJson(res, 502, {
      success: false,
      source: 'NDMA',
      sourceUrl: 'https://www.ndma.gov.pk/advisories',
      error: error?.message || 'NDMA advisories unavailable.',
    });
  }
}
