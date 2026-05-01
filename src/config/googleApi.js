import { fetchApiJson } from './api';

// Google Maps Platform API key
// IMPORTANT: Restrict this key in Google Cloud Console:
//   - Application restrictions: HTTP referrers
//     * https://outdooradvisor.vercel.app/*
//     * http://localhost:*
//   - API restrictions: only enable
//     * Maps JavaScript API
//     * Places API (New) / Places API
//     * Air Quality API
//     * Geocoding API
export const GOOGLE_MAPS_API_KEY = 'AIzaSyBXdDfjWp3RomuSpGtjPhOOitdIN5cVlYg';

// Libraries to load with the Maps JS API
export const GOOGLE_MAPS_LIBRARIES = ['places', 'marker'];

// Singleton loader for the Google Maps JS SDK (web only)
let loaderPromise = null;
export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    // (Geocoding API works via REST too, see reverseGeocode below)
    const existing = document.getElementById('google-maps-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-sdk';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=${GOOGLE_MAPS_LIBRARIES.join(',')}&v=weekly`;
    script.onload = () => resolve(window.google?.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loaderPromise;
}

// Reverse-geocode lat/lon → friendly "Area, City" label using Google Geocoding REST API.
// Returns a string like "DHA Phase 5, Lahore" or null on failure.
export async function reverseGeocode(lat, lon) {
  try {
    const json = await fetchApiJson(`/api/google/geocode?lat=${lat}&lon=${lon}`);
    if (json.status !== 'OK' || !json.results?.length) return null;

    // Walk results to collect the most specific area + the city/locality
    let area = null;
    let cityName = null;

    for (const result of json.results) {
      for (const comp of result.address_components || []) {
        const types = comp.types || [];
        if (!area && (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood'))) {
          area = comp.long_name;
        }
        if (!cityName && types.includes('locality')) {
          cityName = comp.long_name;
        }
        if (!cityName && types.includes('administrative_area_level_2')) {
          cityName = comp.long_name;
        }
      }
      if (area && cityName) break;
    }

    if (area && cityName) return `${area}, ${cityName}`;
    if (cityName) return cityName;
    if (area) return area;
    // Fallback to the first formatted address's short form
    return json.results[0].formatted_address?.split(',').slice(0, 2).join(',').trim() || null;
  } catch (e) {
    return null;
  }
}
