import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../design';

/**
 * Icon — single wrapper around Ionicons so we can swap icon libs later
 * without touching every caller.
 *
 * Props:
 *   - name:   any Ionicons name (prefer `-outline` variants for iOS feel)
 *   - size:   pixels (default 22)
 *   - color:  default colors.textPrimary
 *   - style:  passthrough
 *
 * Naming convention: always pass the Ionicons name directly, e.g.
 *   <Icon name="navigate-outline" />
 *
 * If we migrate to SF Symbols or a different library, add a translation
 * layer here — callers don't change.
 */
export default function Icon({
  name,
  size = 22,
  color = colors.textPrimary,
  style,
}) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

/**
 * Named icon shortcuts used across the app. Add new mappings here so we
 * stay consistent (don't re-pick a name for the same concept in 3 places).
 */
export const ICON = {
  // Navigation chrome
  home: 'home-outline',
  travel: 'navigate-outline',
  planner: 'map-outline',
  alerts: 'warning-outline',
  activities: 'fitness-outline',
  settings: 'settings-outline',
  design: 'sparkles-outline',

  // Location / weather
  location: 'location-outline',
  locationPin: 'location',
  weatherSunny: 'sunny-outline',
  weatherCloudy: 'cloudy-outline',
  weatherPartly: 'partly-sunny-outline',
  weatherRain: 'rainy-outline',
  weatherNight: 'moon-outline',
  wind: 'cloud-outline',
  humidity: 'water-outline',

  // POI & transport
  fuel: 'car-outline',
  ev: 'flash-outline',
  restaurant: 'restaurant-outline',
  hotel: 'bed-outline',
  hospital: 'medical-outline',
  police: 'shield-checkmark-outline',
  service: 'construct-outline',
  rest: 'cafe-outline',
  prayer: 'compass-outline',

  // UI affordances
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  chevronRight: 'chevron-forward',
  chevronLeft: 'chevron-back',
  close: 'close',
  check: 'checkmark',
  add: 'add',
  remove: 'remove',
  search: 'search-outline',
  refresh: 'refresh-outline',
  external: 'open-outline',
  info: 'information-circle-outline',

  // Safety / advisories
  warning: 'warning-outline',
  danger: 'alert-circle-outline',
  success: 'checkmark-circle-outline',
  shield: 'shield-outline',

  // Premium / misc
  premium: 'star-outline',

  // Route planning
  route: 'git-network-outline',
  flag: 'flag-outline',
  time: 'time-outline',
  speedometer: 'speedometer-outline',
};
