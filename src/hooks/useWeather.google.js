// Google Maps Platform Weather API implementation of the useWeather hook.
// Returns the EXACT same shape as the Open-Meteo version so the UI never needs to change.
//
// Endpoints used:
//   - GET https://weather.googleapis.com/v1/currentConditions:lookup
//   - GET https://weather.googleapis.com/v1/forecast/days:lookup
//
// NOTE: You must enable "Weather API" in your Google Cloud project and add it to
// the API restrictions list on your Maps API key.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApiJson } from '../config/api';
import * as persistentCache from '../utils/persistentCache';
import { mockWeatherData } from '../data/mockData';
import { CITIES } from '../data/cities';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_NS = 'weather_google';

function getCacheKey(lat, lon) {
  // Round to 3 decimals (~110 m) to let nearby requests share a cache entry.
  return `${lat.toFixed(3)}_${lon.toFixed(3)}`;
}

function getCached(key) {
  return persistentCache.get(CACHE_NS, key, CACHE_TTL);
}

function setCache(key, data) {
  persistentCache.set(CACHE_NS, key, data);
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
    };
  }
  return null;
}

// Map Google's `weatherCondition.type` enum to the WMO weather codes the rest of
// the app (weatherCodes.js, UI icons) already understands.
function mapConditionTypeToWmo(type) {
  if (!type) return 1;
  const t = String(type).toUpperCase();

  // Clear / cloudy
  if (t === 'CLEAR') return 0;
  if (t === 'MOSTLY_CLEAR') return 1;
  if (t === 'PARTLY_CLOUDY') return 2;
  if (t === 'MOSTLY_CLOUDY' || t === 'CLOUDY') return 3;

  // Fog / haze
  if (t.includes('FOG') || t.includes('HAZE') || t.includes('MIST')) return 45;

  // Thunderstorms
  if (t.includes('THUNDER') && (t.includes('HEAVY') || t.includes('SEVERE'))) return 96;
  if (t.includes('THUNDER')) return 95;
  if (t.includes('HAIL')) return 96;

  // Snow
  if (t.includes('SNOW') && t.includes('SHOWER')) return 85;
  if (t.includes('HEAVY_SNOW') || t.includes('SNOWSTORM') || t.includes('SNOW_STORM')) return 75;
  if (t.includes('LIGHT_SNOW')) return 71;
  if (t.includes('RAIN_AND_SNOW')) return 67;
  if (t.includes('SNOW')) return 73;

  // Rain showers
  if (t.includes('SHOWER') && t.includes('HEAVY')) return 82;
  if (t.includes('SHOWER')) return 80;

  // Steady rain
  if (t.includes('HEAVY_RAIN')) return 65;
  if (t.includes('LIGHT_RAIN')) return 61;
  if (t.includes('RAIN')) return 63;

  // Drizzle
  if (t.includes('DRIZZLE')) return 51;

  // Windy without precipitation
  if (t.includes('WINDY')) return 2;

  return 1;
}

// Cardinal → degrees fallback (Google usually returns degrees directly)
const CARDINAL_DEG = {
  NORTH: 0, N: 0, NORTHEAST: 45, NE: 45, EAST: 90, E: 90, SOUTHEAST: 135, SE: 135,
  SOUTH: 180, S: 180, SOUTHWEST: 225, SW: 225, WEST: 270, W: 270, NORTHWEST: 315, NW: 315,
};

function getNumeric(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && typeof obj[k] === 'number') return obj[k];
  }
  return null;
}

function parseCurrent(json) {
  if (!json || json.error) return null;
  const temp = json.temperature?.degrees ?? null;
  const feelsLike = json.feelsLikeTemperature?.degrees ?? json.heatIndex?.degrees ?? temp;
  const humidity = json.relativeHumidity ?? null;
  const windSpeed = json.wind?.speed?.value ?? null;
  const windGusts = json.wind?.gust?.value ?? null;
  const windDirDeg = json.wind?.direction?.degrees;
  const windDirCard = json.wind?.direction?.cardinal;
  const windDirection =
    windDirDeg != null ? windDirDeg : windDirCard ? CARDINAL_DEG[windDirCard] ?? null : null;
  const weatherCode = mapConditionTypeToWmo(json.weatherCondition?.type);

  return { temp, feelsLike, humidity, windSpeed, windGusts, windDirection, weatherCode };
}

function parseDailyDay(day) {
  const iso = day.displayDate
    ? `${day.displayDate.year}-${String(day.displayDate.month).padStart(2, '0')}-${String(day.displayDate.day).padStart(2, '0')}`
    : (day.interval?.startTime || '').slice(0, 10);

  const dayPart = day.daytimeForecast || {};
  const nightPart = day.nighttimeForecast || {};

  // Prefer the daytime forecast for the "headline" condition of the day
  const condType = dayPart.weatherCondition?.type || nightPart.weatherCondition?.type;

  // Precipitation: sum both halves' qpf if present
  const dayQpf = dayPart.precipitation?.qpf?.quantity ?? 0;
  const nightQpf = nightPart.precipitation?.qpf?.quantity ?? 0;
  const precipitation = (dayQpf || 0) + (nightQpf || 0);

  // Probability: take the max of the two halves
  const dayProb = dayPart.precipitation?.probability?.percent ?? null;
  const nightProb = nightPart.precipitation?.probability?.percent ?? null;
  const precipProbability =
    dayProb != null || nightProb != null
      ? Math.max(dayProb ?? 0, nightProb ?? 0)
      : null;

  const windSpeed = dayPart.wind?.speed?.value ?? nightPart.wind?.speed?.value ?? null;
  const windGusts = dayPart.wind?.gust?.value ?? nightPart.wind?.gust?.value ?? null;
  const windDirDeg = dayPart.wind?.direction?.degrees;
  const windDirCard = dayPart.wind?.direction?.cardinal;
  const windDirection =
    windDirDeg != null ? windDirDeg : windDirCard ? CARDINAL_DEG[windDirCard] ?? null : null;

  const humidityMax = dayPart.relativeHumidity ?? null;
  const humidityMin = nightPart.relativeHumidity ?? null;

  return {
    date: iso,
    maxTemp: day.maxTemperature?.degrees ?? null,
    minTemp: day.minTemperature?.degrees ?? null,
    weatherCode: mapConditionTypeToWmo(condType),
    precipitation: precipitation || null,
    precipProbability,
    windSpeed,
    windGusts,
    windDirection,
    uvIndex: dayPart.uvIndex ?? null,
    sunrise: day.sunEvents?.sunriseTime ?? null,
    sunset: day.sunEvents?.sunsetTime ?? null,
    feelsLikeMax: day.feelsLikeMaxTemperature?.degrees ?? day.maxHeatIndex?.degrees ?? null,
    feelsLikeMin: day.feelsLikeMinTemperature?.degrees ?? null,
    humidityMax,
    humidityMin,
  };
}

function parseHourlyHour(hour) {
  const local = hour.displayDateTime || {};
  const intervalStart = hour.interval?.startTime || null;
  const fallbackIso = local.year
    ? `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T${String(local.hours ?? 0).padStart(2, '0')}:00:00`
    : null;
  const iso = intervalStart || fallbackIso;
  const displayHour =
    typeof local.hours === 'number'
      ? local.hours
      : intervalStart
      ? new Date(intervalStart).getHours()
      : null;
  const windDirDeg = hour.wind?.direction?.degrees;
  const windDirCard = hour.wind?.direction?.cardinal;
  const windDirection =
    windDirDeg != null ? windDirDeg : windDirCard ? CARDINAL_DEG[windDirCard] ?? null : null;

  return {
    time: iso,
    hourLabel: displayHour,
    temp: hour.temperature?.degrees ?? null,
    feelsLike: hour.feelsLikeTemperature?.degrees ?? hour.heatIndex?.degrees ?? null,
    weatherCode: mapConditionTypeToWmo(hour.weatherCondition?.type),
    precipProbability: hour.precipitation?.probability?.percent ?? null,
    precipitation: hour.precipitation?.qpf?.quantity ?? null,
    windSpeed: hour.wind?.speed?.value ?? null,
    windGusts: hour.wind?.gust?.value ?? null,
    windDirection,
    humidity: hour.relativeHumidity ?? null,
    uvIndex: hour.uvIndex ?? null,
    isDaytime: hour.isDaytime ?? null,
  };
}

async function fetchWeatherBundle(lat, lon, days = 7, options = {}) {
  const { force = false } = options;
  const json = await fetchApiJson(`/api/google/weather?lat=${lat}&lon=${lon}&days=${days}&hours=24${force ? `&_=${Date.now()}` : ''}`);
  return {
    current: parseCurrent(json.currentConditions),
    daily: (json.forecastDays || []).map(parseDailyDay),
    hourly: (json.forecastHours || []).map(parseHourlyHour),
  };
}

export async function fetchWeatherForLocation(lat, lon, options = {}) {
  const { force = false } = options;
  const key = getCacheKey(lat, lon);
  const cached = !force ? getCached(key) : null;
  if (cached) return cached;

  try {
    const result = await fetchWeatherBundle(lat, lon, 7, { force });
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
      const cachedEntry = persistentCache.getEntry(CACHE_NS, key);
      setCurrent(cached.current);
      setDaily(cached.daily);
      setHourly(cached.hourly || []);
      setIsUsingCache(true);
      setUpdatedAt(cachedEntry?.timestamp ?? Date.now());
      setLoading(false);
      return;
    }

    try {
      const result = await fetchWeatherBundle(fetchLat, fetchLon, 7, { force });
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
