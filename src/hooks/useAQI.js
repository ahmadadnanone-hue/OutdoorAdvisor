import { useState, useEffect, useCallback, useRef } from 'react';
import { mockAqiData } from '../data/mockData';

const WAQI_TOKEN = 'fa217d84d875678ab48bcbad199fdd0a059c4aa7';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const cache = {};

function getCached(cityName) {
  const entry = cache[cityName];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(cityName, data) {
  cache[cityName] = { data, timestamp: Date.now() };
}

function getFallback(cityName) {
  const key = Object.keys(mockAqiData).find(
    (k) => k.toLowerCase() === cityName.toLowerCase()
  );
  if (key) {
    const mock = mockAqiData[key];
    return { aqi: mock.aqi, pm25: mock.pm25, pm10: mock.pm10 };
  }
  return { aqi: null, pm25: null, pm10: null };
}

export async function fetchAqiForCity(cityName) {
  const cached = getCached(cityName);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.waqi.info/feed/${cityName}/?token=${WAQI_TOKEN}`
    );
    const json = await response.json();

    if (json.status !== 'ok') {
      throw new Error(json.data || 'API returned error');
    }

    const result = {
      aqi: json.data.aqi,
      pm25: json.data.iaqi?.pm25?.v ?? null,
      pm10: json.data.iaqi?.pm10?.v ?? null,
    };

    setCache(cityName, result);
    return result;
  } catch (err) {
    const fallback = getFallback(cityName);
    return fallback;
  }
}

export default function useAQI(cityName = 'lahore') {
  const [aqi, setAqi] = useState(null);
  const [pm25, setPm25] = useState(null);
  const [pm10, setPm10] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const currentCity = useRef(cityName);

  const fetchData = useCallback(async (city) => {
    setLoading(true);
    setError(null);
    setIsUsingCache(false);

    const cached = getCached(city);
    if (cached) {
      setAqi(cached.aqi);
      setPm25(cached.pm25);
      setPm10(cached.pm10);
      setIsUsingCache(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://api.waqi.info/feed/${city}/?token=${WAQI_TOKEN}`
      );
      const json = await response.json();

      if (json.status !== 'ok') {
        throw new Error(json.data || 'API returned error');
      }

      const result = {
        aqi: json.data.aqi,
        pm25: json.data.iaqi?.pm25?.v ?? null,
        pm10: json.data.iaqi?.pm10?.v ?? null,
      };

      setCache(city, result);
      setAqi(result.aqi);
      setPm25(result.pm25);
      setPm10(result.pm10);
    } catch (err) {
      const fallback = getFallback(city);
      setAqi(fallback.aqi);
      setPm25(fallback.pm25);
      setPm10(fallback.pm10);
      setError(err.message || 'Failed to fetch AQI data');
      setIsUsingCache(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchData(currentCity.current);
  }, [fetchData]);

  const fetchCityAqi = useCallback(
    (city) => {
      currentCity.current = city;
      fetchData(city);
    },
    [fetchData]
  );

  useEffect(() => {
    currentCity.current = cityName;
    fetchData(cityName);
  }, [cityName, fetchData]);

  return { aqi, pm25, pm10, loading, error, isUsingCache, refresh, fetchCityAqi };
}
