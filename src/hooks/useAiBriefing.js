import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';

const CACHE_NS = 'ai_briefing_v2';
const GEMINI_CACHE_TTL = 20 * 60 * 1000;
const FALLBACK_CACHE_TTL = 2 * 60 * 1000;

function getCacheKey(kind, signature) {
  return `${kind}:${signature}`;
}

function getCacheTtl(result) {
  return result?.provider === 'gemini' ? GEMINI_CACHE_TTL : FALLBACK_CACHE_TTL;
}

export default function useAiBriefing({ kind, signature, payload, enabled = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const payloadRef = useRef(payload);

  payloadRef.current = payload;

  const fetchData = useCallback(async (options = {}) => {
    if (!enabled || !signature || !payloadRef.current) {
      setData(null);
      setLoading(false);
      return null;
    }

    const { force = false } = options;
    const cacheKey = getCacheKey(kind, signature);
    const cachedEntry = !force ? persistentCache.getEntry(CACHE_NS, cacheKey) : null;
    const cached =
      cachedEntry && Date.now() - cachedEntry.timestamp < getCacheTtl(cachedEntry.data)
        ? cachedEntry.data
        : null;

    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return cached;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchApiJson('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          payload: payloadRef.current,
        }),
      });
      persistentCache.set(CACHE_NS, cacheKey, result);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'AI summary unavailable');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, kind, signature]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  };
}
