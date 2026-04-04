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

/**
 * Returns a weather description and emoji icon for a WMO weather code.
 * @param {number} code - WMO weather code
 * @returns {{ description: string, icon: string }}
 */
export function getWeatherDescription(code) {
  return weatherCodeMap[code] || { description: 'Unknown', icon: '\uD83C\uDF21\uFE0F' };
}
