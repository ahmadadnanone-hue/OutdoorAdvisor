const WK_BASE = 'https://weatherkit.apple.com/api/v1';
const TOKEN_TTL_SECONDS = 25 * 60;

let tokenCache = null;

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function getWeatherKitConfig() {
  const teamId = process.env.WEATHERKIT_TEAM_ID?.trim();
  const keyId = process.env.WEATHERKIT_KEY_ID?.trim();
  const serviceId = (process.env.WEATHERKIT_SERVICE_ID || 'com.ahmadadnanone.outdooradvisor.weatherkit').trim();
  const privateKey = (process.env.WEATHERKIT_PRIVATE_KEY || process.env.WEATHERKIT_KEY_P8 || '')
    .replace(/\\n/g, '\n')
    .trim();

  if (!teamId || !keyId || !serviceId || !privateKey.includes('BEGIN PRIVATE KEY')) {
    return null;
  }

  return { teamId, keyId, serviceId, privateKey };
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parsePkcs8PrivateKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const der = Buffer.from(b64, 'base64');
  return der.subarray(der.length - 32);
}

async function getWeatherKitToken(config) {
  const { p256 } = await import('@noble/curves/nist.js');
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - now > 60) {
    return tokenCache.token;
  }

  const header = {
    alg: 'ES256',
    kid: config.keyId,
    id: `${config.teamId}.${config.serviceId}`,
  };
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    sub: config.serviceId,
  };

  const message = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const digest = await crypto.subtle.digest('SHA-256', Buffer.from(message));
  const signature = p256.sign(new Uint8Array(digest), parsePkcs8PrivateKey(config.privateKey), { lowS: true });
  const signatureBytes =
    typeof signature.toCompactRawBytes === 'function'
      ? signature.toCompactRawBytes()
      : signature;
  const token = `${message}.${base64Url(signatureBytes)}`;

  tokenCache = { token, expiresAt: now + TOKEN_TTL_SECONDS };
  return token;
}

const CONDITION_TO_WMO = {
  Clear: 0,
  MostlyClear: 1,
  PartlyCloudy: 2,
  MostlyCloudy: 3,
  Cloudy: 45,
  Foggy: 45,
  Haze: 45,
  Windy: 51,
  Breezy: 51,
  Drizzle: 51,
  LightDrizzle: 51,
  HeavyDrizzle: 53,
  LightRain: 61,
  Rain: 63,
  HeavyRain: 65,
  IsolatedThunderstorms: 95,
  ScatteredThunderstorms: 95,
  Thunderstorms: 96,
  SevereThunderstorm: 99,
  Flurries: 71,
  LightSnow: 71,
  Snow: 73,
  HeavySnow: 75,
  Blizzard: 77,
  Sleet: 85,
  FreezingRain: 67,
  FreezingDrizzle: 66,
  SunShowers: 80,
  HeavyShowers: 82,
  BlowingDust: 45,
  Smoke: 45,
  Hot: 0,
  ScatteredShowers: 80,
};

function conditionCodeToWmo(conditionCode) {
  return CONDITION_TO_WMO[conditionCode] ?? 0;
}

function normalizeWeatherKit(json) {
  const c = json.currentWeather ?? {};
  const fh = json.forecastHourly?.hours ?? [];
  const fd = json.forecastDaily?.days ?? [];

  return {
    current: {
      temp: c.temperature ?? null,
      feelsLike: c.temperatureApparent ?? null,
      humidity: c.humidity != null ? Math.round(c.humidity * 100) : null,
      windSpeed: c.windSpeed ?? null,
      windDirection: c.windDirection ?? null,
      windGusts: c.windGust ?? null,
      weatherCode: conditionCodeToWmo(c.conditionCode),
      uvIndex: c.uvIndex ?? null,
      pressure: c.pressure ?? null,
      visibility: c.visibility ?? null,
      conditionCode: c.conditionCode ?? null,
      daylight: c.daylight ?? null,
    },
    hourly: fh.slice(0, 24).map((h) => ({
      time: h.forecastStart ?? null,
      temp: h.temperature ?? null,
      humidity: h.humidity != null ? Math.round(h.humidity * 100) : null,
      weatherCode: conditionCodeToWmo(h.conditionCode),
      precipProbability: h.precipitationChance != null ? Math.round(h.precipitationChance * 100) : null,
      conditionCode: h.conditionCode ?? null,
    })),
    daily: fd.map((d) => ({
      date: d.forecastStart ?? null,
      maxTemp: d.temperatureMax ?? null,
      minTemp: d.temperatureMin ?? null,
      weatherCode: conditionCodeToWmo(d.conditionCode),
      precipSum: d.precipitationAmount ?? null,
      precipProbability: d.precipitationChance != null ? Math.round(d.precipitationChance * 100) : null,
      uvIndex: d.maxUvIndex ?? null,
      windSpeed: d.windSpeedAvg ?? null,
      windGusts: d.windGustSpeedMax ?? null,
      windDirection: d.windDirectionAvg ?? null,
      sunrise: d.sunrise ?? null,
      sunset: d.sunset ?? null,
      moonPhase: d.moonPhase ?? null,
      conditionCode: d.conditionCode ?? null,
      feelsLikeMax: d.temperatureApparentMax ?? null,
      feelsLikeMin: d.temperatureApparentMin ?? null,
      humidityMax: null,
      humidityMin: null,
      precipitation: d.precipitationAmount ?? null,
    })),
    alerts: json.weatherAlerts?.alerts ?? [],
    source: 'WeatherKit',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const lang = typeof req.query.lang === 'string' && req.query.lang.trim() ? req.query.lang.trim() : 'en';

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return sendJson(res, 400, { error: 'Valid lat and lon query params are required.' });
  }

  const config = getWeatherKitConfig();
  if (!config) {
    return sendJson(res, 501, { error: 'WeatherKit server credentials are not configured.' });
  }

  try {
    const token = await getWeatherKitToken(config);
    const url = `${WK_BASE}/weather/${encodeURIComponent(lang)}/${lat}/${lon}?dataSets=currentWeather,forecastDaily,forecastHourly,weatherAlerts&timezone=auto`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await response.json();

    if (!response.ok || json.reason) {
      return sendJson(res, response.ok ? 502 : response.status, {
        error: json.reason || json.message || 'WeatherKit request failed.',
      });
    }

    return sendJson(res, 200, normalizeWeatherKit(json));
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'WeatherKit request failed.' });
  }
}
