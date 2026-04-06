const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || 'AIzaSyBXdDfjWp3RomuSpGtjPhOOitdIN5cVlYg';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return sendJson(res, 400, { error: 'Valid lat and lon query params are required.' });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lon}`);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.set('language', 'en');
    url.searchParams.set(
      'result_type',
      'sublocality|neighborhood|locality|administrative_area_level_2|administrative_area_level_1'
    );

    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok || json.status !== 'OK') {
      return sendJson(res, response.ok ? 502 : response.status, {
        error: json.error_message || json.status || 'Google Geocoding failed.',
      });
    }

    return sendJson(res, 200, json);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Geocoding request failed.' });
  }
}
