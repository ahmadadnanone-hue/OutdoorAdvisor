const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || 'AIzaSyBXdDfjWp3RomuSpGtjPhOOitdIN5cVlYg';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

/**
 * POST body / query params:
 *   - lat, lon     (required, numeric)
 *   - radius       (meters, default 2500, clamped 500..8000)
 *   - types        (comma-separated Google Places v1 included types)
 *   - maxResults   (default 8, clamped 1..20)
 *
 * Example:
 *   /api/poi/nearby?lat=31.52&lon=74.35&radius=3000&types=gas_station,lodging
 *
 * Response: { places: [ { id, name, types, rating, userRatingCount, location:{lat,lon}, address } ] }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

  const src = req.method === 'POST' ? req.body || {} : req.query;
  const lat = Number(src.lat);
  const lon = Number(src.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return sendJson(res, 400, { error: 'Valid lat and lon are required.' });
  }

  const radiusRaw = Number(src.radius);
  const radius = Number.isFinite(radiusRaw) ? Math.min(8000, Math.max(500, radiusRaw)) : 2500;

  const maxResultsRaw = Number(src.maxResults);
  const maxResults = Number.isFinite(maxResultsRaw) ? Math.min(20, Math.max(1, maxResultsRaw)) : 8;

  const typesParam = typeof src.types === 'string'
    ? src.types
    : Array.isArray(src.types) ? src.types.join(',') : '';
  const includedTypes = typesParam
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (includedTypes.length === 0) {
    return sendJson(res, 400, { error: 'At least one Places type is required.' });
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.types,places.rating,places.userRatingCount,places.location,places.shortFormattedAddress,places.formattedAddress',
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius,
          },
        },
      }),
    });

    const json = await response.json();

    if (!response.ok || json.error) {
      return sendJson(res, response.ok ? 502 : response.status, {
        error: json.error?.message || 'Google Places nearby search failed.',
      });
    }

    const places = Array.isArray(json.places) ? json.places.map((p) => ({
      id: p.id,
      name: p.displayName?.text || '',
      types: p.types || [],
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      location: p.location ? { lat: p.location.latitude, lon: p.location.longitude } : null,
      address: p.shortFormattedAddress || p.formattedAddress || '',
    })) : [];

    return sendJson(res, 200, { places });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Places nearby request failed.' });
  }
}
