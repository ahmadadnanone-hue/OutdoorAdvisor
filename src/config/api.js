import { Platform } from 'react-native';

const DEFAULT_PRODUCTION_API_BASE_URL = 'https://routeadvisor.vercel.app';

export function getApiBaseUrl() {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  if (Platform.OS === 'web') {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return DEFAULT_PRODUCTION_API_BASE_URL;
    }
    return '';
  }

  return DEFAULT_PRODUCTION_API_BASE_URL;
}

export function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export async function fetchApiJson(path, options) {
  const response = await fetch(buildApiUrl(path), options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed with status ${response.status}`);
  }

  return response.json();
}
