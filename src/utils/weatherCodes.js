const weatherCodeMap = {
  0: { description: 'Clear sky', icon: '\u2600\uFE0F' },
  1: { description: 'Partly cloudy', icon: '\u26C5' },
  2: { description: 'Partly cloudy', icon: '\u26C5' },
  3: { description: 'Partly cloudy', icon: '\u26C5' },
  45: { description: 'Foggy', icon: '\uD83C\uDF2B\uFE0F' },
  48: { description: 'Foggy', icon: '\uD83C\uDF2B\uFE0F' },
  51: { description: 'Drizzle', icon: '\uD83C\uDF26\uFE0F' },
  53: { description: 'Drizzle', icon: '\uD83C\uDF26\uFE0F' },
  55: { description: 'Drizzle', icon: '\uD83C\uDF26\uFE0F' },
  61: { description: 'Rain', icon: '\uD83C\uDF27\uFE0F' },
  63: { description: 'Rain', icon: '\uD83C\uDF27\uFE0F' },
  65: { description: 'Rain', icon: '\uD83C\uDF27\uFE0F' },
  71: { description: 'Snow', icon: '\u2744\uFE0F' },
  73: { description: 'Snow', icon: '\u2744\uFE0F' },
  75: { description: 'Snow', icon: '\u2744\uFE0F' },
  80: { description: 'Showers', icon: '\uD83C\uDF27\uFE0F' },
  81: { description: 'Showers', icon: '\uD83C\uDF27\uFE0F' },
  82: { description: 'Showers', icon: '\uD83C\uDF27\uFE0F' },
  95: { description: 'Thunderstorm', icon: '\u26C8\uFE0F' },
  96: { description: 'Thunderstorm', icon: '\u26C8\uFE0F' },
  99: { description: 'Thunderstorm', icon: '\u26C8\uFE0F' },
};

// Swap a handful of daytime emojis for nighttime-appropriate ones.
// Only codes where the icon is obviously "day" (sun or sun-behind-cloud) need
// to change. Fog, rain, snow, storms read the same at night.
const nightIconOverrides = {
  0: '\uD83C\uDF19',          // Clear sky: 🌙 crescent moon
  1: '\u2601\uFE0F',          // Partly cloudy: ☁️
  2: '\u2601\uFE0F',          // Partly cloudy: ☁️
  3: '\u2601\uFE0F',          // Partly cloudy: ☁️
};

/**
 * Returns whether the given time should be treated as night.
 * Accepts optional ISO-string sunrise/sunset from the weather API for accuracy;
 * otherwise falls back to a rough 6am–6:30pm daylight window.
 *
 * @param {Date | number | string} [when=new Date()]
 * @param {string | null} [sunrise]  ISO 8601 timestamp
 * @param {string | null} [sunset]   ISO 8601 timestamp
 * @returns {boolean}
 */
export function isNight(when = new Date(), sunrise = null, sunset = null) {
  const t = typeof when === 'string' || typeof when === 'number' ? new Date(when) : when;
  if (sunrise && sunset) {
    const r = new Date(sunrise).getTime();
    const s = new Date(sunset).getTime();
    const nowMs = t.getTime();
    if (!Number.isNaN(r) && !Number.isNaN(s) && s > r) {
      return nowMs < r || nowMs > s;
    }
  }
  const hour = t.getHours() + t.getMinutes() / 60;
  return hour < 6 || hour >= 18.5;
}

/**
 * Returns a weather description and emoji icon for a WMO weather code.
 * When `options.isNight` is true, the sun-based icons (clear sky, partly
 * cloudy) are swapped for moon/cloud-only variants.
 *
 * @param {number} code - WMO weather code
 * @param {{ isNight?: boolean }} [options]
 * @returns {{ description: string, icon: string }}
 */
export function getWeatherDescription(code, options = {}) {
  const entry = weatherCodeMap[code] || { description: 'Unknown', icon: '\uD83C\uDF21\uFE0F' };
  if (options.isNight && nightIconOverrides[code]) {
    return { description: entry.description, icon: nightIconOverrides[code] };
  }
  return entry;
}
