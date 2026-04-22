/**
 * useAlerts — fetches active PMD CAP weather alerts for Pakistan.
 * Calls /api/alerts which proxies the public CAP RSS feed from S3.
 * Cache: 10 minutes.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';

const CACHE_NS  = 'pmd_alerts';
const CACHE_KEY = 'active';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

export default function useAlerts({ enabled = true } = {}) {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    try {
      if (!force) {
        const cached = persistentCache.get(CACHE_NS, CACHE_KEY, CACHE_TTL);
        if (cached) {
          setAlerts(cached);
          setLoading(false);
          return cached;
        }
      }

      const json = await fetchApiJson('/api/alerts');
      const data = json?.alerts ?? [];
      persistentCache.set(CACHE_NS, CACHE_KEY, data);
      setAlerts(data);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { alerts, loading, error, refresh: fetch };
}
