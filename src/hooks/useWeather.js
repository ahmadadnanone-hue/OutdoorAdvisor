/**
 * useWeather — server-side WeatherKit proxy (primary) with Open-Meteo fallback.
 *
 * WeatherKit gives us wind gusts, sunrise/sunset, moon phase, alerts,
 * precipitationChance per day, and Apple's conditionCode.
 *
 * Shape returned (same contract all screens rely on):
 *   { current, hourly, daily, loading, error, isUsingCache, updatedAt, refresh }
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';

const CACHE_NS  = 'weatherkit_v1';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

// ─── Open-Meteo fallback ──────────────────────────────────────────────────────
const OM_BASE     = 'https://api.open-meteo.com/v1/forecast';
const OM_CURRENT  = 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,uv_index,surface_pressure,wind_gusts_10m,is_day';
const OM_HOURLY   = 'temperature_2m,relative_humidity_2m,weather_code,precipitation_probability';
const OM_DAILY    = 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,uv_index_max,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset,precipitation_probability_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min,wind_gusts_10m_max';

function buildOmUrl(lat, lon) {
  return `${OM_BASE}?latitude=${lat}&longitude=${lon}&current=${OM_CURRENT}&hourly=${OM_HOURLY}&daily=${OM_DAILY}&timezone=auto&forecast_days=7`;
}

function parseOpenMeteo(json) {
  const c = json.current || {};
  const h = json.hourly  || {};
  const d = json.daily   || {};
  return {
    current: {
      temp:          c.temperature_2m       ?? null,
      feelsLike:     c.apparent_temperature ?? null,
      humidity:      c.relative_humidity_2m ?? null,
      windSpeed:     c.wind_speed_10m       ?? null,
      windDirection: c.wind_direction_10m   ?? null,
      windGusts:     c.wind_gusts_10m       ?? null,
      weatherCode:   c.weather_code         ?? null,
      uvIndex:       c.uv_index             ?? null,
      pressure:      c.surface_pressure     ?? null,
      daylight:      c.is_day != null ? c.is_day === 1 : null,
    },
    hourly: (h.time || []).slice(0, 24).map((time, i) => ({
      time,
      temp:              h.temperature_2m?.[i]            ?? null,
      humidity:          h.relative_humidity_2m?.[i]      ?? null,
      weatherCode:       h.weather_code?.[i]              ?? null,
      precipProbability: h.precipitation_probability?.[i] ?? null,
    })),
    daily: (d.time || []).map((date, i) => ({
      date,
      maxTemp:          d.temperature_2m_max?.[i]                ?? null,
      minTemp:          d.temperature_2m_min?.[i]                ?? null,
      weatherCode:      d.weather_code?.[i]                      ?? null,
      precipSum:        d.precipitation_sum?.[i]                 ?? null,
      precipProbability:d.precipitation_probability_max?.[i]     ?? null,
      uvIndex:          d.uv_index_max?.[i]                      ?? null,
      windSpeed:        d.wind_speed_10m_max?.[i]                ?? null,
      windDirection:    d.wind_direction_10m_dominant?.[i]       ?? null,
      windGusts:        d.wind_gusts_10m_max?.[i]                ?? null,
      sunrise:          d.sunrise?.[i]                           ?? null,
      sunset:           d.sunset?.[i]                            ?? null,
      feelsLikeMax:     d.apparent_temperature_max?.[i]          ?? null,
      feelsLikeMin:     d.apparent_temperature_min?.[i]          ?? null,
      humidityMax:      d.relative_humidity_2m_max?.[i]          ?? null,
      humidityMin:      d.relative_humidity_2m_min?.[i]          ?? null,
      precipitation:    d.precipitation_sum?.[i]                 ?? null,
    })),
    alerts: [],
  };
}

async function fetchWeatherKitProxy(lat, lon) {
  return fetchApiJson(`/api/weatherkit?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
}

async function fetchOpenMeteo(lat, lon) {
  const res = await fetch(buildOmUrl(lat, lon));
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return parseOpenMeteo(await res.json());
}

/** Standalone fetch used by TravelScreen etc. */
export async function fetchWeatherForLocation(lat, lon) {
  const key    = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = persistentCache.get(CACHE_NS, key, CACHE_TTL);
  if (cached) return cached;

  let data;
  try {
    data = await fetchWeatherKitProxy(lat, lon);
  } catch {
    data = await fetchOpenMeteo(lat, lon);
  }
  persistentCache.set(CACHE_NS, key, data);
  return data;
}

/** React hook — returns same shape as before. */
export default function useWeather(lat, lon) {
  const [current,      setCurrent]      = useState(null);
  const [hourly,       setHourly]       = useState([]);
  const [daily,        setDaily]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [updatedAt,    setUpdatedAt]    = useState(null);
  const [source,       setSource]       = useState('WeatherKit proxy');
  const cancelRef = useRef(false);

  const load = useCallback(async (lt, ln, opts = {}) => {
    if (lt == null || ln == null) return;
    cancelRef.current = false;
    setLoading(true);

    const key    = `${lt.toFixed(2)}:${ln.toFixed(2)}`;
    const cached = !opts.force && persistentCache.get(CACHE_NS, key, CACHE_TTL);

    if (cached) {
      if (!cancelRef.current) {
        setCurrent(cached.current);
        setHourly(cached.hourly  || []);
        setDaily(cached.daily   || []);
        setIsUsingCache(true);
        setUpdatedAt(Date.now());
        setError(null);
        setLoading(false);
      }
      return;
    }

    try {
      let data;
      data = await fetchWeatherKitProxy(lt, ln);
      if (!cancelRef.current) setSource(data.source || 'WeatherKit proxy');

      persistentCache.set(CACHE_NS, key, data);
      if (!cancelRef.current) {
        setCurrent(data.current);
        setHourly(data.hourly  || []);
        setDaily(data.daily   || []);
        setIsUsingCache(false);
        setUpdatedAt(Date.now());
        setError(null);
      }
    } catch (e) {
      try {
        const data = await fetchOpenMeteo(lt, ln);
        persistentCache.set(CACHE_NS, key, data);
        if (!cancelRef.current) {
          setCurrent(data.current);
          setHourly(data.hourly  || []);
          setDaily(data.daily   || []);
          setIsUsingCache(false);
          setUpdatedAt(Date.now());
          setSource('Open-Meteo (fallback)');
          setError(null);
        }
      } catch (e2) {
        if (!cancelRef.current) setError(e2.message);
      }
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    load(lat, lon);
    return () => { cancelRef.current = true; };
  }, [lat, lon, load]);

  const refresh = useCallback((lt, ln, opts) => load(lt ?? lat, ln ?? lon, opts), [lat, lon, load]);

  return { current, hourly, daily, loading, error, isUsingCache, updatedAt, refresh, source };
}
