/**
 * useTouristWeather — PMD tourist station live weather + 3-day forecast.
 * Cache: 30 minutes (PMD updates twice daily).
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';

const CACHE_NS  = 'tourist_weather';
const CACHE_KEY = 'stations';
const CACHE_TTL = 30 * 60 * 1000;

export default function useTouristWeather({ enabled = true } = {}) {
  const [stations,  setStations]  = useState([]);
  const [bulletin,  setBulletin]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    try {
      if (!force) {
        const cached = persistentCache.get(CACHE_NS, CACHE_KEY, CACHE_TTL);
        if (cached) {
          setStations(cached.stations ?? []);
          setBulletin(cached.bulletin ?? null);
          setLoading(false);
          return cached;
        }
      }

      const json = await fetchApiJson('/api/tourist');
      const data = { stations: json?.stations ?? [], bulletin: json?.bulletin ?? null };
      persistentCache.set(CACHE_NS, CACHE_KEY, data);
      setStations(data.stations);
      setBulletin(data.bulletin);
      return data;
    } catch (err) {
      setError(err.message);
      return { stations: [], bulletin: null };
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stations, bulletin, loading, error, refresh: fetch };
}
