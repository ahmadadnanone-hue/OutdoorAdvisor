/**
 * WeatherKit REST API client.
 *
 * Generates ES256 JWT on-device using @noble/curves (pure JS, zero native deps).
 * Token is cached for 25 minutes (Apple allows up to 30).
 *
 * API reference: https://developer.apple.com/documentation/weatherkitrestapi
 */
import { p256 } from '@noble/curves/nist';
import { WK } from '../config/weatherkit';

// ─── JWT helpers ─────────────────────────────────────────────────────────────
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const str2buf = (str) => new TextEncoder().encode(str);

/** Parse PKCS#8 PEM and return raw 32-byte private key scalar. */
function parsePem(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  // PKCS#8 EC P-256 private key: last 32 bytes are the scalar
  return der.slice(der.length - 32);
}

let _tokenCache = null; // { token, expiresAt }

export async function getWeatherKitToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && _tokenCache.expiresAt - now > 60) return _tokenCache.token;

  const header = { alg: 'ES256', kid: WK.KEY_ID, id: `${WK.TEAM_ID}.${WK.SERVICE_ID}` };
  const payload = { iss: WK.TEAM_ID, iat: now, exp: now + 1500, sub: WK.SERVICE_ID };

  const headerB64  = b64url(str2buf(JSON.stringify(header)));
  const payloadB64 = b64url(str2buf(JSON.stringify(payload)));
  const message    = `${headerB64}.${payloadB64}`;

  const msgHash = await crypto.subtle.digest('SHA-256', str2buf(message));
  const privKey = parsePem(WK.KEY_P8);
  const sig     = p256.sign(new Uint8Array(msgHash), privKey, { lowS: true });
  const sigB64  = b64url(sig.toCompactRawBytes());

  const token = `${message}.${sigB64}`;
  _tokenCache = { token, expiresAt: now + 1500 };
  return token;
}

// ─── WMO-style mapping from WeatherKit conditionCode ────────────────────────
// https://developer.apple.com/documentation/weatherkitrestapi/conditioncode
const CONDITION_TO_WMO = {
  Clear: 0, MostlyClear: 1, PartlyCloudy: 2, MostlyCloudy: 3, Cloudy: 45,
  Foggy: 45, Haze: 45, Windy: 51, Breezy: 51,
  Drizzle: 51, LightDrizzle: 51, HeavyDrizzle: 53,
  LightRain: 61, Rain: 63, HeavyRain: 65,
  IsolatedThunderstorms: 95, ScatteredThunderstorms: 95, Thunderstorms: 96, SevereThunderstorm: 99,
  Flurries: 71, LightSnow: 71, Snow: 73, HeavySnow: 75, Blizzard: 77,
  Sleet: 85, FreezingRain: 67, FreezingDrizzle: 66,
  SunShowers: 80, HeavyShowers: 82,
  BlowingDust: 45, Smoke: 45, Hot: 0, ScatteredShowers: 80,
};

function condCode(conditionCode) {
  return CONDITION_TO_WMO[conditionCode] ?? 0;
}

// ─── API fetch ────────────────────────────────────────────────────────────────
const WK_BASE = 'https://weatherkit.apple.com/api/v1';

export async function fetchWeatherKit(lat, lon, lang = 'en') {
  const token = await getWeatherKitToken();
  const sets  = 'currentWeather,forecastDaily,forecastHourly,weatherAlerts';
  const url   = `${WK_BASE}/weather/${lang}/${lat}/${lon}?dataSets=${sets}&timezone=auto`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WeatherKit ${res.status}`);
  return res.json();
}

// ─── Shape normalizer (matches useWeather.js contract) ───────────────────────
export function normalizeWeatherKit(json) {
  const c = json.currentWeather ?? {};
  const fh = json.forecastHourly?.hours ?? [];
  const fd = json.forecastDaily?.days ?? [];

  const current = {
    temp:          c.temperature      ?? null,
    feelsLike:     c.temperatureApparent ?? null,
    humidity:      c.humidity != null ? Math.round(c.humidity * 100) : null,
    windSpeed:     c.windSpeed        ?? null,
    windDirection: c.windDirection    ?? null,
    windGusts:     c.windGust         ?? null,   // ✅ WeatherKit has gusts!
    weatherCode:   condCode(c.conditionCode),
    uvIndex:       c.uvIndex          ?? null,
    pressure:      c.pressure         ?? null,
    visibility:    c.visibility       ?? null,
    conditionCode: c.conditionCode    ?? null,   // raw Apple code for richer UI later
    daylight:      c.daylight         ?? null,
  };

  const hourly = fh.slice(0, 24).map((h) => ({
    time:              h.forecastStart      ?? null,
    temp:              h.temperature        ?? null,
    humidity:          h.humidity != null ? Math.round(h.humidity * 100) : null,
    weatherCode:       condCode(h.conditionCode),
    precipProbability: h.precipitationChance != null ? Math.round(h.precipitationChance * 100) : null,
    conditionCode:     h.conditionCode      ?? null,
  }));

  const daily = fd.map((d) => ({
    date:          d.forecastStart       ?? null,
    maxTemp:       d.temperatureMax      ?? null,
    minTemp:       d.temperatureMin      ?? null,
    weatherCode:   condCode(d.conditionCode),
    precipSum:     d.precipitationAmount ?? null,
    precipProbability: d.precipitationChance != null ? Math.round(d.precipitationChance * 100) : null,
    uvIndex:       d.maxUvIndex          ?? null,
    windSpeed:     d.windSpeedAvg        ?? null,
    windGusts:     d.windGustSpeedMax    ?? null,
    windDirection: d.windDirectionAvg    ?? null,
    sunrise:       d.sunrise             ?? null,
    sunset:        d.sunset              ?? null,
    moonPhase:     d.moonPhase           ?? null,
    conditionCode: d.conditionCode       ?? null,

    // ForecastDetailModal extras
    feelsLikeMax:  d.temperatureApparentMax ?? null,
    feelsLikeMin:  d.temperatureApparentMin ?? null,
    humidityMax:   null, // not in daily
    humidityMin:   null,
    precipitation: d.precipitationAmount ?? null,
  }));

  const alerts = json.weatherAlerts?.alerts ?? [];

  return { current, hourly, daily, alerts };
}
