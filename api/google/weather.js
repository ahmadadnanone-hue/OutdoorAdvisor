const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || 'AIzaSyBXdDfjWp3RomuSpGtjPhOOitdIN5cVlYg';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function fetchGoogleJson(url) {
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Google Weather request failed (${response.status})`);
  }

  return json;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 10);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return sendJson(res, 400, { error: 'Valid lat and lon query params are required.' });
  }

  try {
    const currentUrl = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
    currentUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    currentUrl.searchParams.set('location.latitude', String(lat));
    currentUrl.searchParams.set('location.longitude', String(lon));
    currentUrl.searchParams.set('unitsSystem', 'METRIC');
    currentUrl.searchParams.set('languageCode', 'en');

    const forecastUrl = new URL('https://weather.googleapis.com/v1/forecast/days:lookup');
    forecastUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    forecastUrl.searchParams.set('location.latitude', String(lat));
    forecastUrl.searchParams.set('location.longitude', String(lon));
    forecastUrl.searchParams.set('days', String(days));
    forecastUrl.searchParams.set('pageSize', String(days));
    forecastUrl.searchParams.set('unitsSystem', 'METRIC');
    forecastUrl.searchParams.set('languageCode', 'en');

    const [currentConditions, forecast] = await Promise.all([
      fetchGoogleJson(currentUrl),
      fetchGoogleJson(forecastUrl),
    ]);

    return sendJson(res, 200, {
      currentConditions,
      forecastDays: forecast.forecastDays || [],
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Weather request failed.' });
  }
}
