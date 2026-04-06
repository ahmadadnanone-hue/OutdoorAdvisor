import { useState, useEffect, useCallback, useRef } from 'react';
import { mockWeatherData } from '../data/mockData';
import { CITIES } from '../data/cities';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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
    const today = mock.daily?.[0] || {};
    return {
      current: {
        temp: mock.temp,
        feelsLike: mock.feelsLike,
        humidity: mock.humidity,
        windSpeed: mock.windSpeed,
        windGusts: today.windGusts ?? null,
        windDirection: today.windDirection ?? null,
        weatherCode: mock.weatherCode,
      },
      daily: mock.daily,
      hourly: [],
    };
  }
  return null;
}

function buildUrl(lat, lon) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,apparent_temperature,wind_gusts_10m&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_max,relative_humidity_2m_min,wind_direction_10m_dominant&timezone=Asia/Karachi&forecast_days=7`;
}

function parseResponse(json) {
  const current = {
    temp: json.current.temperature_2m,
    feelsLike: json.current.apparent_temperature,
    humidity: json.current.relative_humidity_2m,
    windSpeed: json.current.wind_speed_10m,
    windGusts: json.current.wind_gusts_10m ?? null,
    windDirection: json.current.wind_direction_10m ?? null,
    weatherCode: json.current.weather_code,
  };

  const d = json.daily;
  const daily = d.time.map((date, i) => ({
    date,
    maxTemp: d.temperature_2m_max[i],
    minTemp: d.temperature_2m_min[i],
    weatherCode: d.weather_code[i],
    precipitation: d.precipitation_sum?.[i] ?? null,
    precipProbability: d.precipitation_probability_max?.[i] ?? null,
    windSpeed: d.wind_speed_10m_max?.[i] ?? null,
    windGusts: d.wind_gusts_10m_max?.[i] ?? null,
    windDirection: d.wind_direction_10m_dominant?.[i] ?? null,
    uvIndex: d.uv_index_max?.[i] ?? null,
    sunrise: d.sunrise?.[i] ?? null,
    sunset: d.sunset?.[i] ?? null,
    feelsLikeMax: d.apparent_temperature_max?.[i] ?? null,
    feelsLikeMin: d.apparent_temperature_min?.[i] ?? null,
    humidityMax: d.relative_humidity_2m_max?.[i] ?? null,
    humidityMin: d.relative_humidity_2m_min?.[i] ?? null,
  }));

  const h = json.hourly;
  const hourly = (h?.time || []).slice(0, 24).map((time, i) => ({
    time,
    hourLabel: Number.isFinite(new Date(time).getHours()) ? new Date(time).getHours() : null,
    temp: h.temperature_2m?.[i] ?? null,
    feelsLike: h.apparent_temperature?.[i] ?? null,
    humidity: h.relative_humidity_2m?.[i] ?? null,
    precipProbability: h.precipitation_probability?.[i] ?? null,
    precipitation: h.precipitation?.[i] ?? null,
    weatherCode: h.weather_code?.[i] ?? null,
    windSpeed: h.wind_speed_10m?.[i] ?? null,
    windGusts: h.wind_gusts_10m?.[i] ?? null,
    windDirection: h.wind_direction_10m?.[i] ?? null,
    uvIndex: h.uv_index?.[i] ?? null,
    isDaytime: h.is_day?.[i] === 1,
  }));

  return { current, daily, hourly };
}

export async function fetchWeatherForLocation(lat, lon, options = {}) {
  const { force = false } = options;
  const key = getCacheKey(lat, lon);
  const cached = !force ? getCached(key) : null;
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
  const [hourly, setHourly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const latRef = useRef(lat);
  const lonRef = useRef(lon);

  const fetchData = useCallback(async (fetchLat, fetchLon, options = {}) => {
    if (fetchLat == null || fetchLon == null) return;
    const { force = false } = options;

    setLoading(true);
    setError(null);
    setIsUsingCache(false);

    const key = getCacheKey(fetchLat, fetchLon);
    const cached = !force ? getCached(key) : null;
    if (cached) {
      setCurrent(cached.current);
      setDaily(cached.daily);
      setHourly(cached.hourly || []);
      setIsUsingCache(true);
      setUpdatedAt(cache[key]?.timestamp ?? Date.now());
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
      setHourly(result.hourly || []);
      setUpdatedAt(Date.now());
    } catch (err) {
      const fallback = getFallback(fetchLat, fetchLon);
      if (fallback) {
        setCurrent(fallback.current);
        setDaily(fallback.daily);
        setHourly(fallback.hourly || []);
        setUpdatedAt(Date.now());
      }
      setError(err.message || 'Failed to fetch weather data');
      setIsUsingCache(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback((nextLat, nextLon, options = {}) => {
    const latToUse = nextLat ?? latRef.current;
    const lonToUse = nextLon ?? lonRef.current;
    return fetchData(latToUse, lonToUse, options);
  }, [fetchData]);

  useEffect(() => {
    latRef.current = lat;
    lonRef.current = lon;
    fetchData(lat, lon);
  }, [lat, lon, fetchData]);

  return { current, daily, hourly, loading, error, isUsingCache, updatedAt, refresh };
}
