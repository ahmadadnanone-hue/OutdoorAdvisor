// Weather provider selector.
//
// To switch providers, change the PROVIDER constant below:
//   - 'google'    → Google Maps Platform Weather API (paid, hyperlocal, same key as Maps/Places)
//   - 'openmeteo' → Open-Meteo (free, city-level, no key)
//
// The two implementations return IDENTICAL shapes, so no UI code needs to change.
//
// Files:
//   ./useWeather.google.js     → Google implementation
//   ./useWeather.openmeteo.js  → Open-Meteo implementation (original, kept as backup)

import googleProvider, { fetchWeatherForLocation as googleFetch } from './useWeather.google';
import openMeteoProvider, { fetchWeatherForLocation as openMeteoFetch } from './useWeather.openmeteo';

const PROVIDER = 'google'; // <-- change to 'openmeteo' to revert

const useWeatherImpl = PROVIDER === 'google' ? googleProvider : openMeteoProvider;
const fetchImpl = PROVIDER === 'google' ? googleFetch : openMeteoFetch;

export const fetchWeatherForLocation = fetchImpl;
export default useWeatherImpl;
