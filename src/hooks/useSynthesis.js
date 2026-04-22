/**
 * useSynthesis — unified outdoor intelligence hook.
 *
 * Calls /api/ai/briefing with kind:'synthesize'. The server fetches
 * Weather + AQI + CAP alerts in parallel and returns a single brief:
 *   { severity, headline, summary, actions[], window, provider }
 *
 * Refresh triggers:
 *   1. On mount / location change
 *   2. On app foreground if cache is >30 min stale
 *   3. Manual refresh() call
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchApiJson } from '../config/api';
import { supabase } from '../lib/supabase';
import * as persistentCache from '../utils/persistentCache';

const CACHE_NS  = 'synthesis_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 min — matches Vercel s-maxage

function cacheKey(lat, lon) {
  return `${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

function isFresh(entry) {
  return entry && Date.now() - entry.timestamp < CACHE_TTL;
}

export default function useSynthesis({ lat, lon, locationName, pollenLabel, enabled = true }) {
  const [synthesis, setSynthesis]   = useState(null);
  const [loading,   setLoading]     = useState(false);
  const [error,     setError]       = useState(null);
  const [fetchedAt, setFetchedAt]   = useState(null);
  const fetchingRef                 = useRef(false);
  const latRef                      = useRef(lat);
  const lonRef                      = useRef(lon);
  const locationNameRef             = useRef(locationName);
  const pollenRef                   = useRef(pollenLabel);

  // Keep refs up-to-date without causing re-renders
  latRef.current          = lat;
  lonRef.current          = lon;
  locationNameRef.current = locationName;
  pollenRef.current       = pollenLabel;

  const doFetch = useCallback(async ({ force = false } = {}) => {
    const curLat = latRef.current;
    const curLon = lonRef.current;
    if (!enabled || curLat == null || curLon == null) return;
    if (fetchingRef.current) return;

    const key = cacheKey(curLat, curLon);

    if (!force) {
      const entry = persistentCache.getEntry(CACHE_NS, key);
      if (isFresh(entry)) {
        setSynthesis(entry.data);
        setFetchedAt(entry.timestamp);
        setLoading(false);
        return entry.data;
      }
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const session = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token   = session?.data?.session?.access_token || '';

      const result = await fetchApiJson('/api/ai/briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kind:         'synthesize',
          lat:          curLat,
          lon:          curLon,
          locationName: locationNameRef.current,
          pollenLabel:  pollenRef.current,
        }),
      });

      const now = Date.now();
      persistentCache.set(CACHE_NS, key, result);
      setSynthesis(result);
      setFetchedAt(now);
      return result;
    } catch (err) {
      setError(err.message || 'Synthesis unavailable');
      return null;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [enabled]);

  // Fetch on mount + when location changes
  useEffect(() => {
    doFetch();
  }, [doFetch, lat, lon]);

  // Refresh on app foreground if cache is stale
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const key   = cacheKey(latRef.current ?? 0, lonRef.current ?? 0);
      const entry = persistentCache.getEntry(CACHE_NS, key);
      if (!isFresh(entry)) {
        doFetch();
      }
    });
    return () => sub.remove();
  }, [doFetch]);

  return {
    synthesis,
    loading,
    error,
    fetchedAt,
    refresh: (force = true) => doFetch({ force }),
  };
}
