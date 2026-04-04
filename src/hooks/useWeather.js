import { useState, useEffect, useCallback, useRef } from 'react';
import { mockWeatherData } from '../data/mockData';
import { CITIES } from '../data/cities';

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const cache = {};

function getCacheKey(lat, lon) {
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

function getNearestCityName(lat, lon) {
  let nearest = CITIES[0].name;
  let minDist = Infinity;

  for (const city of CITIES) {
    const dLat = city.lat - lat;
    const dLon = city.lon - lon;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < minDist) {
      minDist = dist;
      nearest = city.name;
    }
  }

  return nearest;
}

function getFallback(lat, lon) {
  const cityName = getNearestCityName(lat, lon);
  const mock = mockWeatherData[cityName];
  if (mock) {
    return {
      current: {
        temp: mock.temp,
        feelsLike: mock.feelsLike,
        humidity: mock.humidity,
        windSpeed: mock.windSpeed,
        weatherCode: mock.weatherCode,
      },
      daily: mock.daily,
    };
  }
  return null;
}

function buildUrl(lat, lon) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia/Karachi&forecast_days=7`;
}

function parseResponse(json) {
  const current = {
    temp: json.current.temperature_2m,
    feelsLike: json.current.apparent_temperature,
    humidity: json.current.relative_humidity_2m,
    windSpeed: json.current.wind_speed_10m,
    weatherCode: json.current.weather_code,
  };

  const daily = json.daily.time.map((date, i) => ({
    date,
    maxTemp: json.daily.temperature_2m_max[i],
    minTemp: json.daily.temperature_2m_min[i],
    weatherCode: json.daily.weather_code[i],
  }));

  return { current, daily };
}

export async function fetchWeatherForLocation(lat, lon) {
  const key = getCacheKey(lat, lon);
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const response = await fetch(buildUrl(lat, lon));
    const json = await response.json();

    if (json.error) {
      throw new Error(json.reason || 'API returned error');
    }

    const result = parseResponse(json);
    setCache(key, result);
    return result;
  } catch (err) {
    const fallback = getFallback(lat, lon);
    if (fallback) return fallback;
    throw err;
  }
}

export default function useWeather(lat, lon) {
  const [current, setCurrent] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const latRef = useRef(lat);
  const lonRef = useRef(lon);

  const fetchData = useCallback(async (fetchLat, fetchLon) => {
    if (fetchLat == null || fetchLon == null) return;

    setLoading(true);
    setError(null);
    setIsUsingCache(false);

    const key = getCacheKey(fetchLat, fetchLon);
    const cached = getCached(key);
    if (cached) {
      setCurrent(cached.current);
      setDaily(cached.daily);
      setIsUsingCache(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(buildUrl(fetchLat, fetchLon));
      const json = await response.json();

      if (json.error) {
        throw new Error(json.reason || 'API returned error');
      }

      const result = parseResponse(json);
      setCache(key, result);
      setCurrent(result.current);
      setDaily(result.daily);
    } catch (err) {
      const fallback = getFallback(fetchLat, fetchLon);
      if (fallback) {
        setCurrent(fallback.current);
        setDaily(fallback.daily);
      }
      setError(err.message || 'Failed to fetch weather data');
      setIsUsingCache(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchData(latRef.current, lonRef.current);
  }, [fetchData]);

  useEffect(() => {
    latRef.current = lat;
    lonRef.current = lon;
    fetchData(lat, lon);
  }, [lat, lon, fetchData]);

  return { current, daily, loading, error, isUsingCache, refresh };
}
