/**
 * homeUtils.js — pure helper functions for HomeScreen.
 * No React, no imports from components. Safe to import anywhere.
 */
import { ICON } from '../Icon';
import { colors as dc } from '../../design';

// ─── AQI ────────────────────────────────────────────────────────────────────

export function getAqiColor(aqi) {
  if (aqi == null) return dc.textMuted;
  if (aqi <= 50)  return dc.accentGreen;
  if (aqi <= 100) return dc.accentYellow;
  if (aqi <= 150) return dc.accentOrange;
  if (aqi <= 200) return dc.accentRed;
  if (aqi <= 300) return '#B877F5';
  return '#FF3B30';
}

export function getAqiCategory(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  return 'Very Unhealthy';
}

// ─── Weather code helpers ────────────────────────────────────────────────────

export function isRainCode(code) {
  return code != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);
}
export function isStormCode(code) {
  return code != null && [95, 96, 99].includes(code);
}
export function isFogCode(code) {
  return code != null && [45, 48].includes(code);
}

export function getWeatherIcon(code, isNightMode) {
  if (code == null) return isNightMode ? ICON.weatherNight : ICON.weatherPartly;
  if (code === 0)   return isNightMode ? ICON.weatherNight : ICON.weatherSunny;
  if (code <= 3)    return isNightMode ? ICON.weatherCloudy : ICON.weatherPartly;
  if (code <= 48)   return ICON.weatherCloudy;
  if (code <= 82)   return ICON.weatherRain;
  if (code <= 86)   return ICON.weatherCloudy;
  return ICON.weatherRain;
}

// ─── Wind ────────────────────────────────────────────────────────────────────

export function getWindDirectionLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function getUvLabel(uv) {
  if (uv <= 2)  return 'Low';
  if (uv <= 5)  return 'Moderate';
  if (uv <= 7)  return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

// ─── Decision ────────────────────────────────────────────────────────────────

export function decisionStatus(label) {
  if (label === 'Good to go')    return 'go';
  if (label === 'Go with care')  return 'caution';
  return 'danger';
}

export function getHomeDecision({ aqi, temp, feelsLike, weatherCode, pollenValue, windSpeed }) {
  const heatValue    = feelsLike ?? temp ?? null;
  const isStormy     = isStormCode(weatherCode);
  const isHeavyRain  = weatherCode != null && [65, 82].includes(weatherCode);
  const isRain       = isRainCode(weatherCode);
  const hasHighPollen = pollenValue != null && pollenValue >= 4;
  const hasStrongWind = windSpeed != null && windSpeed >= 35;

  if (isStormy || aqi > 200 || heatValue >= 47) {
    const reasons = [];
    if (isStormy)       reasons.push('thunderstorm risk');
    if (aqi > 200)      reasons.push(`AQI ${aqi}`);
    if (heatValue >= 47) reasons.push(`feels-like ${Math.round(heatValue)}°`);
    return {
      label: 'Better to limit exposure',
      tone:  'Strong risk is present right now.',
      body:  `If you still need to go out, keep it brief, avoid hard exertion, and use protection that matches the condition.${reasons.length ? ` Main factor: ${reasons.join(' · ')}.` : ''}`,
      color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.24)',
    };
  }

  if (aqi > 100 || heatValue >= 38 || isHeavyRain || hasHighPollen || hasStrongWind || isRain) {
    const guidance = [];
    if (aqi > 100)      guidance.push('wear an N95 if you are sensitive or staying out long');
    if (heatValue >= 38) guidance.push('go earlier or later and hydrate often');
    if (isHeavyRain)    guidance.push('use waterproof gear and slow down');
    else if (isRain)    guidance.push('take rain gear for shorter trips');
    if (hasHighPollen)  guidance.push('keep allergy medication or a mask handy');
    if (hasStrongWind)  guidance.push('avoid exposed routes and secure loose gear');
    return {
      label: 'Go with care',
      tone:  'Outdoor plans are still workable with a few precautions.',
      body:  guidance.length ? `Best approach: ${guidance.slice(0, 3).join(' · ')}.` : 'Conditions are manageable, but you will feel them more than on an easy-weather day.',
      color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.24)',
    };
  }

  return {
    label: 'Good to go',
    tone:  'Conditions are comfortable for most outdoor plans.',
    body:  'This is a good window for walks, errands, and regular outdoor activity without major adjustments.',
    color: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.24)',
  };
}

// ─── User / location ─────────────────────────────────────────────────────────

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function titleCaseWord(value) {
  const clean = String(value || '').replace(/[^a-zA-Z]/g, '');
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

export function getUserGreetingName(user) {
  const candidates = [
    user?.user_metadata?.first_name,
    user?.user_metadata?.firstName,
    user?.user_metadata?.name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.fullName,
  ].filter(Boolean);

  for (const c of candidates) {
    const formatted = titleCaseWord(String(c).trim().split(/\s+/)[0]);
    if (formatted) return formatted;
  }
  return titleCaseWord(String(user?.email || '').split('@')[0].split(/[._-]/)[0]);
}

export function getLocationDisplay(label, region) {
  if (!label) return { primary: 'Lahore', secondary: 'Pakistan' };
  // If an explicit region was stored (from Google Places or GPS), use it directly
  if (region != null && region !== '') {
    return { primary: String(label).trim(), secondary: String(region).trim() };
  }
  // Fallback: try to split a compound label like "Area, City"
  const parts = String(label).split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { primary: parts[0], secondary: parts.slice(1).join(', ') };
  // Single-word city from local Pakistan list — default to Pakistan
  return { primary: label, secondary: 'Pakistan' };
}

export function getActivityToneColor(label) {
  if (label === 'Good') return '#22C55E';
  if (label === 'Fair') return '#0EA5E9';
  if (label === 'Care') return '#F97316';
  return '#EF4444';
}

// ─── Insight text builders ────────────────────────────────────────────────────

export function getAqiInsight(aqi, pm25) {
  if (aqi == null) return 'Live AQI insight is unavailable right now. Pull to refresh or try another city.';
  if (aqi <= 50)  return `Air quality is excellent right now. PM2.5 is ${pm25 ?? '--'}, so outdoor plans are in a comfortable range for most people.`;
  if (aqi <= 100) return `Air quality is acceptable, but sensitive groups should keep an eye on symptoms. PM2.5 is ${pm25 ?? '--'}.`;
  if (aqi <= 150) return `Air quality is elevated for sensitive groups. Consider shorter outdoor sessions and lighter exertion. PM2.5 is ${pm25 ?? '--'}.`;
  if (aqi <= 200) return `Air quality is unhealthy. Limit prolonged outdoor activity and consider a mask for essential time outside. PM2.5 is ${pm25 ?? '--'}.`;
  return `Air quality is very poor right now. Keep outdoor exposure brief and shift activities indoors if possible. PM2.5 is ${pm25 ?? '--'}.`;
}

export function buildAqiHistoryInsight(history, currentAqi, pm25) {
  if (!history?.length) return getAqiInsight(currentAqi, pm25);
  const recent = history.slice(-6);
  const first  = recent[0];
  const last   = recent[recent.length - 1];
  const delta  = first?.aqi != null && last?.aqi != null ? last.aqi - first.aqi : null;
  const deltaText = delta == null || delta === 0
    ? 'AQI has been fairly steady in recent checks.'
    : delta > 0
    ? `AQI is up ${delta} points versus the oldest recent check.`
    : `AQI is down ${Math.abs(delta)} points versus the oldest recent check.`;
  const lines = recent.map((p) => {
    const time = new Date(p.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const pm   = p.pm25 != null ? ` · PM2.5 ${p.pm25}` : '';
    return `${time}: AQI ${p.aqi ?? '--'}${pm}`;
  }).join('\n');
  return `${deltaText}\n\nRecent AQI checks:\n${lines}`;
}

export function buildHourlyOutlook(hourly, settings, weatherLookup) {
  const next = (hourly || []).slice(0, 12);
  if (!next.length) return 'Next-12-hour outlook is unavailable right now.';
  return next.map((h) => {
    const label   = new Date(h.time || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    const weather = weatherLookup(h.weatherCode);
    const rain    = h.precipProbability != null ? ` · ${h.precipProbability}% rain` : '';
    return `${label}: ${settings.formatTempShort(h.temp)} · ${weather.description}${rain}`;
  }).join('\n');
}

export function getWindInsight({ windSpeed, windGusts, windDirectionLabel, gustsFromForecast, directionFromForecast, formatWind }) {
  const parts = [`Current wind speed is ${formatWind(windSpeed)}${windDirectionLabel && windDirectionLabel !== '--' ? ` from the ${windDirectionLabel}` : ''}.`];
  if (windGusts != null) parts.push(`Peak gusts are ${formatWind(windGusts)}.`);
  if (gustsFromForecast || directionFromForecast) parts.push('Some wind details are forecast-derived because live station data was incomplete for this location.');
  return parts.join(' ');
}

export function getPollenInsight(primary, types) {
  if (!primary) return 'Pollen insight is unavailable for this location right now.';
  const topTypes = types.filter((t) => t.value != null).slice(0, 3)
    .map((t) => `${t.displayName || t.code}: ${t.indexDisplayName || t.category || t.value}`).join(' · ');
  return `${primary.displayName || 'Pollen'} is the main pollen driver right now with a ${primary.indexDisplayName || primary.category || primary.value} reading.${topTypes ? ` Top pollen types: ${topTypes}.` : ''}`;
}
