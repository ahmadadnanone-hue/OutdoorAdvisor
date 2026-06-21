const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function buildOpenMeteoAqiUrl(lat, lon) {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'us_aqi,pm10,pm2_5');
  url.searchParams.set('timezone', 'auto');
  return url;
}

async function fetchOpenMeteoAqi(lat, lon) {
  const response = await fetch(buildOpenMeteoAqiUrl(lat, lon));
  const json = await response.json();
  if (!response.ok || json.error || !json.current) {
    throw new Error(json.reason || json.error || 'Open-Meteo air quality request failed.');
  }

  const current = json.current || {};
  const aqi = current.us_aqi ?? null;
  const pm25 = current.pm2_5 ?? null;
  const pm10 = current.pm10 ?? null;

  return {
    source: 'Open-Meteo Air Quality',
    indexes: aqi == null ? [] : [{
      code: 'usa_epa',
      displayName: 'US EPA AQI',
      aqi,
      category: aqi <= 50 ? 'Good'
        : aqi <= 100 ? 'Moderate'
          : aqi <= 150 ? 'Unhealthy for Sensitive Groups'
            : aqi <= 200 ? 'Unhealthy'
              : aqi <= 300 ? 'Very Unhealthy'
                : 'Hazardous',
      dominantPollutant: 'pm25',
    }],
    pollutants: [
      pm25 == null ? null : {
        code: 'pm25',
        displayName: 'PM2.5',
        concentration: { value: pm25, units: 'MICROGRAMS_PER_CUBIC_METER' },
      },
      pm10 == null ? null : {
        code: 'pm10',
        displayName: 'PM10',
        concentration: { value: pm10, units: 'MICROGRAMS_PER_CUBIC_METER' },
      },
    ].filter(Boolean),
    current,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return sendJson(res, 400, { error: 'Valid lat and lon query params are required.' });
  }

  try {
    if (GOOGLE_MAPS_API_KEY) {
      const response = await fetch(
        `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_MAPS_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: { latitude: lat, longitude: lon },
            extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION', 'DOMINANT_POLLUTANT_CONCENTRATION'],
            languageCode: 'en',
          }),
        }
      );

      const json = await response.json();

      if (response.ok && !json.error) {
        return sendJson(res, 200, json);
      }
    }

    return sendJson(res, 200, await fetchOpenMeteoAqi(lat, lon));
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Air quality request failed.' });
  }
}
