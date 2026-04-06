export const lightTheme = {
  background: '#F0F2F5',
  card: '#FFFFFF',
  text: '#1A1D26',
  textSecondary: '#6B7685',
  border: 'rgba(0,0,0,0.04)',
};

export const darkTheme = {
  background: '#0B1120',
  card: 'rgba(255,255,255,0.05)',
  text: '#E8ECF4',
  textSecondary: '#7A8BA7',
  border: 'rgba(255,255,255,0.06)',
};

export const aqiColors = {
  good: '#22C55E',
  moderate: '#EAB308',
  unhealthySensitive: '#F97316',
  unhealthy: '#EF4444',
  veryUnhealthy: '#8B5CF6',
  hazardous: '#991B1B',
};

export const common = {
  primary: '#4F8EF7',
  accent: '#38BDF8',
};

/**
 * Returns the appropriate color for a given AQI value.
 */
export function getAqiColor(aqi) {
  if (aqi <= 50) return aqiColors.good;
  if (aqi <= 100) return aqiColors.moderate;
  if (aqi <= 150) return aqiColors.unhealthySensitive;
  if (aqi <= 200) return aqiColors.unhealthy;
  if (aqi <= 300) return aqiColors.veryUnhealthy;
  return aqiColors.hazardous;
}

/**
 * Returns the AQI category string for a given AQI value.
 */
export function getAqiCategory(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Returns an activity status object { label, color } based on AQI.
 */
export function getActivityStatus(aqi) {
  if (aqi <= 100) {
    return { label: 'Safe', color: aqiColors.good };
  }
  if (aqi <= 175) {
    return { label: 'Caution', color: aqiColors.unhealthySensitive };
  }
  if (aqi <= 300) {
    return { label: 'Limit', color: aqiColors.unhealthy };
  }
  return { label: 'Avoid', color: aqiColors.hazardous };
}
