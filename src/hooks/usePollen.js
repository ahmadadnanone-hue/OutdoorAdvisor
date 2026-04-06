import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';

const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_NS = 'pollen';

function getCacheKey(lat, lon) {
  return `${lat.toFixed(3)}_${lon.toFixed(3)}`;
}

function getCached(key) {
  return persistentCache.get(CACHE_NS, key, CACHE_TTL);
}

function setCache(key, data) {
  persistentCache.set(CACHE_NS, key, data);
}

function normaliseTypeInfo(typeInfo) {
  const indexInfo = typeInfo?.indexInfo || {};

  return {
    code: typeInfo?.code || null,
    displayName: typeInfo?.displayName || null,
    inSeason: Boolean(typeInfo?.inSeason),
    value: indexInfo.value ?? null,
    category: indexInfo.category || null,
    indexDisplayName: indexInfo.displayName || null,
    recommendations: typeInfo?.healthRecommendations || [],
  };
}

function buildSummary(json) {
  const today = json?.dailyInfo?.[0];
  const types = (today?.pollenTypeInfo || [])
    .map(normaliseTypeInfo)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const primary = types.find((type) => type.value != null) || null;

  return {
    regionCode: json?.regionCode || null,
    date: today?.date || null,
    primary,
    types,
  };
}

export async function fetchPollenForLocation(lat, lon, options = {}) {
  if (lat == null || lon == null) return { primary: null, types: [] };
  const { force = false } = options;

  const key = getCacheKey(lat, lon);
  const cached = !force ? getCached(key) : null;
  if (cached) return cached;

  try {
    const json = await fetchApiJson(`/api/google/pollen?lat=${lat}&lon=${lon}&days=1${force ? `&_=${Date.now()}` : ''}`);
    const result = buildSummary(json);
    setCache(key, result);
    return result;
  } catch (error) {
    return { primary: null, types: [], error: error.message };
  }
}

export default function usePollen(lat, lon) {
  const [primary, setPrimary] = useState(null);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const coordsRef = useRef({ lat, lon });

  const fetchData = useCallback(async (nextLat, nextLon, options = {}) => {
    if (nextLat == null || nextLon == null) {
      setLoading(false);
      return;
    }
    const { force = false } = options;

    setLoading(true);
    setError(null);
    setIsUsingCache(false);

    const key = getCacheKey(nextLat, nextLon);
    const cached = !force ? getCached(key) : null;
    if (cached) {
      setPrimary(cached.primary);
      setTypes(cached.types || []);
      setIsUsingCache(true);
      setLoading(false);
      return;
    }

    const result = await fetchPollenForLocation(nextLat, nextLon, { force });
    setPrimary(result.primary);
    setTypes(result.types || []);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  const refresh = useCallback((nextLat, nextLon, options = {}) => {
    const latToUse = nextLat ?? coordsRef.current.lat;
    const lonToUse = nextLon ?? coordsRef.current.lon;
    return fetchData(latToUse, lonToUse, options);
  }, [fetchData]);

  useEffect(() => {
    coordsRef.current = { lat, lon };
    fetchData(lat, lon);
  }, [lat, lon, fetchData]);

  return { primary, types, loading, error, isUsingCache, refresh };
}
