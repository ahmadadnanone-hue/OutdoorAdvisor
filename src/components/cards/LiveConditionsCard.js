import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors, typography, spacing, radius } from '../../design';

// ─── Condition theme ──────────────────────────────────────────────────────────
// Returns card tint, border, and icon colour factoring in WMO code, heat, AQI.
// Priority: AQI danger > extreme heat > AQI unhealthy > high heat > AQI moderate
//           > weather code (rain/snow/clear/etc.)
function getConditionTheme(code, feelsLike, aqi) {
  const heat = feelsLike ?? null;
  const aqiNum = aqi ?? 0;

  // ── AQI hazardous / very unhealthy (>200) ─────────────────────────────────
  if (aqiNum > 200) return {
    tint:   'rgba(185,28,28,0.20)',    // deep red haze
    border: 'rgba(239,68,68,0.42)',
    icon:   '#FCA5A5',
  };

  // ── Extreme heat ≥45°C ────────────────────────────────────────────────────
  if (heat != null && heat >= 45) return {
    tint:   'rgba(220,38,38,0.20)',    // danger red-orange
    border: 'rgba(239,68,68,0.40)',
    icon:   '#FCA5A5',
  };

  // ── AQI unhealthy (151–200) ───────────────────────────────────────────────
  if (aqiNum > 150) return {
    tint:   'rgba(194,65,12,0.18)',    // deep orange-red
    border: 'rgba(234,88,12,0.38)',
    icon:   '#FB923C',
  };

  // ── High heat 38–44°C ─────────────────────────────────────────────────────
  if (heat != null && heat >= 38) return {
    tint:   'rgba(234,88,12,0.16)',    // warm amber-orange
    border: 'rgba(251,146,60,0.36)',
    icon:   '#FD8C3A',
  };

  // ── AQI moderate (101–150) ────────────────────────────────────────────────
  if (aqiNum > 100) return {
    tint:   'rgba(202,138,4,0.16)',    // amber-yellow
    border: 'rgba(234,179,8,0.34)',
    icon:   '#FDE047',
  };

  // ── Weather-code themes (cool / normal temps, clean air) ─────────────────

  if (code == null) return { tint: colors.cardGlassStrong, border: colors.cardStroke, icon: colors.accentCyan };

  // Thunderstorm
  if (code >= 95) return {
    tint:   'rgba(109,40,217,0.18)',
    border: 'rgba(139,92,246,0.40)',
    icon:   '#A78BFA',
  };
  // Snow / blizzard
  if (code >= 71 && code <= 77) return {
    tint:   'rgba(186,230,253,0.15)',
    border: 'rgba(186,230,253,0.36)',
    icon:   '#BAE6FD',
  };
  // Heavy showers / showers
  if (code >= 80 && code <= 82) return {
    tint:   'rgba(37,99,235,0.16)',
    border: 'rgba(59,130,246,0.38)',
    icon:   '#60A5FA',
  };
  // Heavy rain
  if (code >= 63 && code <= 65) return {
    tint:   'rgba(29,78,216,0.18)',
    border: 'rgba(59,130,246,0.42)',
    icon:   '#3B82F6',
  };
  // Light / moderate rain
  if (code >= 61 && code <= 62) return {
    tint:   'rgba(37,99,235,0.14)',
    border: 'rgba(96,165,250,0.34)',
    icon:   '#60A5FA',
  };
  // Drizzle
  if (code >= 51 && code <= 55) return {
    tint:   'rgba(56,189,248,0.13)',
    border: 'rgba(56,189,248,0.32)',
    icon:   '#38BDF8',
  };
  // Freezing rain
  if (code === 66 || code === 67) return {
    tint:   'rgba(148,163,184,0.16)',
    border: 'rgba(148,163,184,0.34)',
    icon:   '#CBD5E1',
  };
  // Fog / haze
  if (code === 45 || code === 48) return {
    tint:   'rgba(100,116,139,0.14)',
    border: 'rgba(100,116,139,0.28)',
    icon:   '#94A3B8',
  };
  // Overcast
  if (code === 3) return {
    tint:   'rgba(100,116,139,0.12)',
    border: 'rgba(148,163,184,0.28)',
    icon:   '#94A3B8',
  };
  // Partly cloudy
  if (code === 1 || code === 2) return {
    tint:   'rgba(155,200,255,0.13)',
    border: 'rgba(155,200,255,0.30)',
    icon:   colors.accentCyan,
  };
  // Clear sky — warm golden (pleasant conditions)
  return {
    tint:   'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.30)',
    icon:   '#FCD34D',
  };
}

/**
 * LiveConditionsCard — the hero card on Home screen. Shows:
 *   - eyebrow "LIVE CONDITIONS"
 *   - city + country subtitle
 *   - big temperature metric with weather icon
 *   - condition text + feels-like
 *   - 3-stat row: AQI / Wind / Humidity
 *   - AQI snapshot section at the bottom
 *
 * Props:
 *   - city, country
 *   - weatherCode:   WMO integer — drives the card tint + icon colour
 *   - condition:     "Partly cloudy"
 *   - tempLabel:     "36°" (formatted by caller for unit preference)
 *   - feelsLikeLabel "Feels like 36°C"
 *   - weatherIcon:   Ionicons name (e.g. ICON.weatherPartly)
 *   - aqi:           108
 *   - aqiCategory:   "Unhealthy for Sensitive Groups"
 *   - aqiColor:      color the AQI number should glow in
 *   - pm25Label:     "PM2.5 39 μg/m³"
 *   - windLabel, humidityLabel
 */
export default function LiveConditionsCard({
  city,
  country,
  weatherCode,
  condition,
  tempLabel,
  feelsLike,          // raw °C number for theme computation
  feelsLikeLabel,
  weatherIcon = ICON.weatherPartly,
  weatherIconNode = null,
  aqi,
  aqiCategory,
  aqiColor = colors.accentOrange,
  pm25Label,
  windLabel,
  humidityLabel,
  onPress,
}) {
  const theme = getConditionTheme(weatherCode, feelsLike, aqi);

  return (
    <GlassCard
      strong
      tintColor={theme.tint}
      borderColor={theme.border}
      contentStyle={styles.content}
      onPress={onPress}
      hapticStyle={onPress ? 'light' : null}
    >
      <Text style={styles.eyebrow}>LIVE CONDITIONS</Text>

      {/* Location */}
      <View style={styles.locationRow}>
        <Icon name={ICON.locationPin} size={14} color={colors.accentCyan} />
        <Text style={styles.city}>{city}</Text>
      </View>
      {country ? <Text style={styles.country}>{country}</Text> : null}

      {/* Temperature + weather icon */}
      <View style={styles.tempRow}>
        <View style={styles.tempLeft}>
          {weatherIconNode || <Icon name={weatherIcon} size={56} color={theme.icon} />}
          <Text style={styles.condition}>{condition}</Text>
        </View>
        <View style={styles.tempRight}>
          <Text style={styles.temp}>{tempLabel}</Text>
          {feelsLikeLabel ? (
            <Text style={styles.feelsLike}>{feelsLikeLabel}</Text>
          ) : null}
        </View>
      </View>

      {/* Stat row */}
      <View style={styles.statRow}>
        <StatBlock label="AQI" value={String(aqi ?? '--')} valueColor={aqiColor} />
        <View style={styles.divider} />
        <StatBlock label="WIND" value={windLabel || '--'} />
        <View style={styles.divider} />
        <StatBlock label="HUMIDITY" value={humidityLabel || '--'} />
      </View>

      {/* AQI snapshot */}
      {aqiCategory ? (
        <View style={styles.aqiBlock}>
          <Text style={styles.aqiEyebrow}>AIR QUALITY SNAPSHOT</Text>
          <View style={styles.aqiRow}>
            <Text style={styles.aqiCategory}>{aqiCategory}</Text>
            <Text style={[styles.aqiBadge, { color: aqiColor }]}>{aqi ?? '--'}</Text>
          </View>
          {pm25Label ? <Text style={styles.pm25}>{pm25Label}</Text> : null}
        </View>
      ) : null}
    </GlassCard>
  );
}

function StatBlock({ label, value, valueColor }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22 },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.textMuted,
    marginBottom: 14,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  city: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  country: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  tempRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 22,
  },
  tempLeft: {
    alignItems: 'flex-start',
    gap: 4,
  },
  condition: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  tempRight: { alignItems: 'flex-end' },
  temp: {
    ...typography.metric,
    color: colors.textPrimary,
  },
  feelsLike: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardStrokeSoft,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.cardStrokeSoft,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    ...typography.sectionLabel,
    fontSize: 10,
    color: colors.textMuted,
  },
  statValue: {
    ...typography.rowLabel,
    color: colors.textPrimary,
  },
  aqiBlock: {
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardStrokeSoft,
  },
  aqiEyebrow: {
    ...typography.sectionLabel,
    color: colors.textMuted,
    marginBottom: 8,
  },
  aqiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aqiCategory: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  aqiBadge: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pm25: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
