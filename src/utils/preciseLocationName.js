import { AREAS } from '../data/cities';

export function distanceKm(a, b) {
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const lat1 = Number(a?.lat);
  const lon1 = Number(a?.lon);
  const lat2 = Number(b?.lat);
  const lon2 = Number(b?.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isBroadCityLabel(label, city) {
  const normalized = normalizeLabel(label);
  if (!normalized || /^pakistan$/i.test(normalized)) return true;
  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return true;
  const primary = parts[0];
  const rest = parts.slice(1).join(', ');
  return new RegExp(`^${city}$`, 'i').test(primary) && (!rest || /^pakistan$/i.test(rest));
}

export function getNearestKnownArea(location, maxDistanceKm = 2.5) {
  const nearest = AREAS
    .map((area) => ({ ...area, distance: distanceKm(location, area) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest && nearest.distance <= maxDistanceKm ? nearest : null;
}

export function getPreciseLocationName(location, locationName) {
  const label = normalizeLabel(locationName);
  const nearest = getNearestKnownArea(location);
  if (!nearest) return label;
  if (!isBroadCityLabel(label, nearest.city)) return label;
  return `${nearest.name}, ${nearest.city}`;
}

export function splitLocationLabel(label, fallbackRegion = 'Pakistan') {
  const parts = normalizeLabel(label).split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], region: parts.slice(1).join(', ') };
  }
  return { city: parts[0] || 'Lahore', region: fallbackRegion };
}
