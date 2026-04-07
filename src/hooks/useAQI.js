import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_NS = 'aqi';
const HISTORY_NS = 'aqi_history';
const HISTORY_RETENTION_MS = 48 * 60 * 60 * 1000;
const MAX_HISTORY_POINTS = 12;

function cacheKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function getCached(key) {
  return persistentCache.get(CACHE_NS, key, CACHE_TTL);
}

function setCache(key, data) {
  persistentCache.set(CACHE_NS, key, data);
}

function getHistory(key) {
  const entry = persistentCache.getEntry(HISTORY_NS, key);
  const points = Array.isArray(entry?.data) ? entry.data : [];
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  return points.filter((point) => point?.timestamp && point.timestamp >= cutoff);
}

function setHistory(key, points) {
  persistentCache.set(HISTORY_NS, key, points);
}

function recordHistory(key, data) {
  if (data?.aqi == null && data?.pm25 == null && data?.pm10 == null) return;
  const points = getHistory(key);
  const latest = points[points.length - 1];
  const nextPoint = {
    timestamp: Date.now(),
    aqi: data.aqi ?? null,
    pm25: data.pm25 ?? null,
    pm10: data.pm10 ?? null,
    category: data.category ?? null,
  };

  if (
    latest &&
    latest.aqi === nextPoint.aqi &&
    latest.pm25 === nextPoint.pm25 &&
    latest.pm10 === nextPoint.pm10 &&
    nextPoint.timestamp - latest.timestamp < 15 * 60 * 1000
  ) {
    return;
  }

  setHistory(key, [...points, nextPoint].slice(-MAX_HISTORY_POINTS));
}

export function getAqiHistoryForLocation(lat, lon) {
  if (lat == null || lon == null) return [];
  return getHistory(cacheKey(lat, lon));
}

/**
 * Fetch AQI for a location via Google Air Quality API.
 * Returns { aqi, pm25, pm10, category, dominantPollutant }
 */
export async function fetchAqiForLocation(lat, lon, options = {}) {
  if (lat == null || lon == null) return { aqi: null, pm25: null, pm10: null };
  const { force = false } = options;

  const key = cacheKey(lat, lon);
  const cached = !force ? getCached(key) : null;
  if (cached) return cached;

  try {
    const json = await fetchApiJson(`/api/google/aqi?lat=${lat}&lon=${lon}${force ? `&_=${Date.now()}` : ''}`);
    if (json.error) throw new Error(json.error || 'Google AQI error');

    // Prefer USA EPA AQI (matches Pakistan context), fall back to Universal AQI
    const indexes = json.indexes || [];
    const usaEpa = indexes.find((i) => i.code === 'usa_epa');
    const uaqi = indexes.find((i) => i.code === 'uaqi');
    const primary = usaEpa || uaqi || indexes[0];

    const pollutants = json.pollutants || [];
    const getPollutant = (code) => {
      const p = pollutants.find((x) => x.code === code);
      if (!p || !p.concentration) return null;
      return Math.round(p.concentration.value);
    };

    const result = {
      aqi: primary?.aqi ?? null,
      pm25: getPollutant('pm25'),
      pm10: getPollutant('pm10'),
      category: primary?.category ?? null,
      dominantPollutant: primary?.dominantPollutant ?? null,
    };

    setCache(key, result);
    recordHistory(key, result);
    return result;
  } catch (err) {
    return { aqi: null, pm25: null, pm10: null, error: err.message };
  }
}

export default function useAQI(lat, lon) {
  const [aqi, setAqi] = useState(null);
  const [pm25, setPm25] = useState(null);
  const [pm10, setPm10] = useState(null);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [history, setHistoryState] = useState([]);
  const currentCoords = useRef({ lat, lon });

  const fetchData = useCallback(async (la, lo, options = {}) => {
    if (la == null || lo == null) {
      setLoading(false);
      return;
    }
    const { force = false } = options;
    setLoading(true);
    setError(null);
    setIsUsingCache(false);

    const key = cacheKey(la, lo);
    const cached = !force ? getCached(key) : null;
    if (cached) {
      const cachedEntry = persistentCache.getEntry(CACHE_NS, key);
      setAqi(cached.aqi);
      setPm25(cached.pm25);
      setPm10(cached.pm10);
      setCategory(cached.category);
      setIsUsingCache(true);
      setUpdatedAt(cachedEntry?.timestamp ?? Date.now());
      setHistoryState(getHistory(key));
      setLoading(false);
      return;
    }

    const result = await fetchAqiForLocation(la, lo, { force });
    setAqi(result.aqi);
    setPm25(result.pm25);
    setPm10(result.pm10);
    setCategory(result.category);
    setUpdatedAt(Date.now());
    setHistoryState(getHistory(key));
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  const refresh = useCallback((nextLat, nextLon, options = {}) => {
    const latToUse = nextLat ?? currentCoords.current.lat;
    const lonToUse = nextLon ?? currentCoords.current.lon;
    return fetchData(latToUse, lonToUse, options);
  }, [fetchData]);

  useEffect(() => {
    currentCoords.current = { lat, lon };
    fetchData(lat, lon);
  }, [lat, lon, fetchData]);

  return { aqi, pm25, pm10, category, loading, error, isUsingCache, updatedAt, history, refresh };
}
