import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_NS = 'aqi';

function cacheKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function getCached(key) {
  return persistentCache.get(CACHE_NS, key, CACHE_TTL);
}

function setCache(key, data) {
  persistentCache.set(CACHE_NS, key, data);
}

/**
 * Fetch AQI for a location via Google Air Quality API.
 * Returns { aqi, pm25, pm10, category, dominantPollutant }
 */
export async function fetchAqiForLocation(lat, lon) {
  if (lat == null || lon == null) return { aqi: null, pm25: null, pm10: null };

  const key = cacheKey(lat, lon);
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const json = await fetchApiJson(`/api/google/aqi?lat=${lat}&lon=${lon}`);
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
  const currentCoords = useRef({ lat, lon });

  const fetchData = useCallback(async (la, lo) => {
    if (la == null || lo == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setIsUsingCache(false);

    const key = cacheKey(la, lo);
    const cached = getCached(key);
    if (cached) {
      const cachedEntry = persistentCache.getEntry(CACHE_NS, key);
      setAqi(cached.aqi);
      setPm25(cached.pm25);
      setPm10(cached.pm10);
      setCategory(cached.category);
      setIsUsingCache(true);
      setUpdatedAt(cachedEntry?.timestamp ?? Date.now());
      setLoading(false);
      return;
    }

    const result = await fetchAqiForLocation(la, lo);
    setAqi(result.aqi);
    setPm25(result.pm25);
    setPm10(result.pm10);
    setCategory(result.category);
    setUpdatedAt(Date.now());
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  const refresh = useCallback((nextLat, nextLon) => {
    const latToUse = nextLat ?? currentCoords.current.lat;
    const lonToUse = nextLon ?? currentCoords.current.lon;
    fetchData(latToUse, lonToUse);
  }, [fetchData]);

  useEffect(() => {
    currentCoords.current = { lat, lon };
    fetchData(lat, lon);
  }, [lat, lon, fetchData]);

  return { aqi, pm25, pm10, category, loading, error, isUsingCache, updatedAt, refresh };
}
