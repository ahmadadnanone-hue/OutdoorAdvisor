import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { CITIES } from '../data/cities';
import { reverseGeocode } from '../config/googleApi';
import * as persistentCache from '../utils/persistentCache';
import { saveLocationSnapshot } from '../utils/locationSnapshot';

const DEFAULT_CITY = CITIES.find((c) => c.name === 'Lahore');
const LOCATION_CACHE_NS = 'device_location';
const LOCATION_CACHE_KEY = 'current';
const LOCATION_CACHE_TTL = 10 * 60 * 1000;

function getDistance(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function findNearestCity(lat, lon) {
  let nearest = CITIES[0];
  let minDist = Infinity;

  for (const city of CITIES) {
    const dist = getDistance(lat, lon, city.lat, city.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = city;
    }
  }

  return nearest;
}

export default function useLocation() {
  const [location, setLocation] = useState({ lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });
  const [city, setCity] = useState(DEFAULT_CITY.name);
  const [isUsingDeviceLocation, setIsUsingDeviceLocation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLocation = useCallback(async (forceFresh = false) => {
    setLoading(true);
    setError(null);

    try {
      if (!forceFresh) {
        const cached = persistentCache.get(LOCATION_CACHE_NS, LOCATION_CACHE_KEY, LOCATION_CACHE_TTL);
        if (cached?.lat != null && cached?.lon != null) {
          setLocation({ lat: cached.lat, lon: cached.lon });
          setCity(cached.city || DEFAULT_CITY.name);
          setIsUsingDeviceLocation(cached.source !== 'manual');
          saveLocationSnapshot(cached).catch(() => {});
          setLoading(false);
          return cached;
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        const fallback = { lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon, city: DEFAULT_CITY.name, source: 'device' };
        setLocation({ lat: fallback.lat, lon: fallback.lon });
        setCity(fallback.city);
        setIsUsingDeviceLocation(true);
        persistentCache.set(LOCATION_CACHE_NS, LOCATION_CACHE_KEY, fallback);
        saveLocationSnapshot(fallback).catch(() => {});
        setError('Location permission denied. Defaulting to Lahore.');
        setLoading(false);
        return fallback;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = position.coords;

      // Set coords immediately so AQI/weather can start fetching at the precise point
      const nextLocation = { lat: latitude, lon: longitude };
      setLocation(nextLocation);

      // Try Google reverse-geocoding for a friendly "Area, City" label.
      // Fall back to nearest known city if it fails.
      const friendly = await reverseGeocode(latitude, longitude);
      const resolvedCity = friendly || findNearestCity(latitude, longitude).name;
      setCity(resolvedCity);
      setIsUsingDeviceLocation(true);
      const resolved = { ...nextLocation, city: resolvedCity, source: 'device' };
      persistentCache.set(LOCATION_CACHE_NS, LOCATION_CACHE_KEY, resolved);
      saveLocationSnapshot(resolved).catch(() => {});
      return resolved;
    } catch (err) {
      const fallback = { lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon, city: DEFAULT_CITY.name, source: 'device' };
      setLocation({ lat: fallback.lat, lon: fallback.lon });
      setCity(fallback.city);
      setIsUsingDeviceLocation(true);
      persistentCache.set(LOCATION_CACHE_NS, LOCATION_CACHE_KEY, fallback);
      saveLocationSnapshot(fallback).catch(() => {});
      setError(err.message || 'Failed to get location. Defaulting to Lahore.');
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const selectCity = useCallback((cityName) => {
    const found = CITIES.find((c) => c.name === cityName);
    if (found) {
      setCity(found.name);
      setIsUsingDeviceLocation(false);
      const nextLocation = { lat: found.lat, lon: found.lon };
      setLocation(nextLocation);
      persistentCache.set(LOCATION_CACHE_NS, LOCATION_CACHE_KEY, {
        ...nextLocation,
        city: found.name,
        source: 'manual',
      });
      saveLocationSnapshot({
        ...nextLocation,
        city: found.name,
        source: 'manual',
      }).catch(() => {});
    }
  }, []);

  // Accept any place { name, lat, lon } (e.g. from Google Places Autocomplete)
  const selectPlace = useCallback(({ name, lat, lon }) => {
    if (lat == null || lon == null) return;
    setCity(name || 'Selected');
    setIsUsingDeviceLocation(false);
    setLocation({ lat, lon });
    persistentCache.set(LOCATION_CACHE_NS, LOCATION_CACHE_KEY, {
      lat,
      lon,
      city: name || 'Selected',
      source: 'manual',
    });
    saveLocationSnapshot({
      lat,
      lon,
      city: name || 'Selected',
      source: 'manual',
    }).catch(() => {});
  }, []);

  return { location, city, isUsingDeviceLocation, loading, error, refresh: fetchLocation, selectCity, selectPlace };
}
