const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function component(longName, type) {
  if (!longName) return null;
  return { long_name: longName, short_name: longName, types: [type] };
}

async function fetchNominatimReverse(lat, lon) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OutdoorAdvisor/1.0 (support@outdooradvisor.app)',
      'Accept-Language': 'en',
    },
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error || 'OpenStreetMap reverse geocoding failed.');
  }

  const address = json.address || {};
  const area = address.neighbourhood || address.suburb || address.quarter || address.residential || address.city_district;
  const city = address.city || address.town || address.village || address.county || address.state_district;
  const state = address.state;
  const country = address.country;
  const formatted = [area, city, state, country].filter(Boolean).join(', ') || json.display_name || 'Selected location';
  const components = [
    component(area, 'sublocality'),
    component(city, 'locality'),
    component(city, 'administrative_area_level_2'),
    component(state, 'administrative_area_level_1'),
    component(country, 'country'),
  ].filter(Boolean);

  return {
    status: 'OK',
    source: 'OpenStreetMap Nominatim',
    results: [{
      formatted_address: formatted,
      address_components: components,
      geometry: { location: { lat, lng: lon } },
      types: ['street_address'],
    }],
  };
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
    if (GOOGLE_MAPS_API_KEY) {
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

      if (response.ok && json.status === 'OK') {
        return sendJson(res, 200, json);
      }
    }

    return sendJson(res, 200, await fetchNominatimReverse(lat, lon));
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Geocoding request failed.' });
  }
}
