const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || 'AIzaSyBXdDfjWp3RomuSpGtjPhOOitdIN5cVlYg';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=10800, stale-while-revalidate=21600');

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const days = Math.min(Math.max(Number(req.query.days) || 1, 1), 5);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return sendJson(res, 400, { error: 'Valid lat and lon query params are required.' });
  }

  try {
    const url = new URL('https://pollen.googleapis.com/v1/forecast:lookup');
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.set('location.latitude', String(lat));
    url.searchParams.set('location.longitude', String(lon));
    url.searchParams.set('days', String(days));
    url.searchParams.set('pageSize', String(days));
    url.searchParams.set('languageCode', 'en');
    url.searchParams.set('plantsDescription', 'false');

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok || json.error) {
      return sendJson(res, response.ok ? 502 : response.status, {
        error: json.error?.message || 'Google Pollen request failed.',
      });
    }

    return sendJson(res, 200, json);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Pollen request failed.' });
  }
}
