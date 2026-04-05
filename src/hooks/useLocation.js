import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { CITIES } from '../data/cities';
import { reverseGeocode } from '../config/googleApi';

const DEFAULT_CITY = CITIES.find((c) => c.name === 'Lahore');

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocation({ lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });
        setCity(DEFAULT_CITY.name);
        setError('Location permission denied. Defaulting to Lahore.');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = position.coords;

      // Set coords immediately so AQI/weather can start fetching at the precise point
      setLocation({ lat: latitude, lon: longitude });

      // Try Google reverse-geocoding for a friendly "Area, City" label.
      // Fall back to nearest known city if it fails.
      const friendly = await reverseGeocode(latitude, longitude);
      if (friendly) {
        setCity(friendly);
      } else {
        const nearest = findNearestCity(latitude, longitude);
        setCity(nearest.name);
      }
    } catch (err) {
      setLocation({ lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });
      setCity(DEFAULT_CITY.name);
      setError(err.message || 'Failed to get location. Defaulting to Lahore.');
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
      setLocation({ lat: found.lat, lon: found.lon });
    }
  }, []);

  // Accept any place { name, lat, lon } (e.g. from Google Places Autocomplete)
  const selectPlace = useCallback(({ name, lat, lon }) => {
    if (lat == null || lon == null) return;
    setCity(name || 'Selected');
    setLocation({ lat, lon });
  }, []);

  return { location, city, loading, error, refresh: fetchLocation, selectCity, selectPlace };
}
