/**
 * useWeather — Open-Meteo weather hook for iOS.
 *
 * Returns the same shape as the previous Google/OpenMeteo providers so no
 * screen code needs to change. Will be replaced by WeatherKit in Phase 12.
 *
 * Top-level shape:
 *   { current, hourly, daily, loading, error, isUsingCache, updatedAt, refresh }
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as persistentCache from '../utils/persistentCache';

const CACHE_NS  = 'weather_v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

const BASE = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_VARS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
  'wind_speed_10m', 'wind_direction_10m', 'weather_code',
  'uv_index', 'surface_pressure',
].join(',');

const HOURLY_VARS = [
  'temperature_2m', 'relative_humidity_2m',
  'weather_code', 'precipitation_probability',
].join(',');

const DAILY_VARS = [
  'temperature_2m_max', 'temperature_2m_min',
  'weather_code', 'precipitation_sum', 'uv_index_max',
  'wind_speed_10m_max', 'wind_direction_10m_dominant',
].join(',');

function buildUrl(lat, lon) {
  return (
    `${BASE}?latitude=${lat}&longitude=${lon}` +
    `&current=${CURRENT_VARS}` +
    `&hourly=${HOURLY_VARS}` +
    `&daily=${DAILY_VARS}` +
    `&timezone=auto&forecast_days=7`
  );
}

function parseResponse(json) {
  const c = json.current || {};
  const h = json.hourly  || {};
  const d = json.daily   || {};

  const current = {
    temp:          c.temperature_2m        ?? null,
    feelsLike:     c.apparent_temperature  ?? null,
    humidity:      c.relative_humidity_2m  ?? null,
    windSpeed:     c.wind_speed_10m        ?? null,
    windDirection: c.wind_direction_10m    ?? null,
    windGusts:     null, // not available in free tier
    weatherCode:   c.weather_code          ?? null,
    uvIndex:       c.uv_index              ?? null,
    pressure:      c.surface_pressure      ?? null,
  };

  const hourly = (h.time || []).slice(0, 24).map((time, i) => ({
    time,
    temp:              h.temperature_2m?.[i]           ?? null,
    humidity:          h.relative_humidity_2m?.[i]     ?? null,
    weatherCode:       h.weather_code?.[i]             ?? null,
    precipProbability: h.precipitation_probability?.[i] ?? null,
  }));

  const daily = (d.time || []).map((date, i) => ({
    date,
    tempMax:       d.temperature_2m_max?.[i]             ?? null,
    tempMin:       d.temperature_2m_min?.[i]             ?? null,
    weatherCode:   d.weather_code?.[i]                  ?? null,
    precipSum:     d.precipitation_sum?.[i]              ?? null,
    uvMax:         d.uv_index_max?.[i]                   ?? null,
    windSpeed:     d.wind_speed_10m_max?.[i]             ?? null,
    windDirection: d.wind_direction_10m_dominant?.[i]   ?? null,
  }));

  return { current, hourly, daily };
}

/** Standalone fetch — used by TravelScreen, RoutePlannerScreen, etc. */
export async function fetchWeatherForLocation(lat, lon) {
  const key    = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = persistentCache.get(CACHE_NS, key, CACHE_TTL);
  if (cached) return cached;

  const res = await fetch(buildUrl(lat, lon));
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = parseResponse(await res.json());
  persistentCache.set(CACHE_NS, key, data);
  return data;
}

/** React hook — matches the shape screens already destructure. */
export default function useWeather(lat, lon) {
  const [current,      setCurrent]      = useState(null);
  const [hourly,       setHourly]       = useState([]);
  const [daily,        setDaily]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [updatedAt,    setUpdatedAt]    = useState(null);
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
      const res = await fetch(buildUrl(lt, ln));
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
      const data = parseResponse(await res.json());
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
      if (!cancelRef.current) setError(e.message);
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

  return { current, hourly, daily, loading, error, isUsingCache, updatedAt, refresh };
}
