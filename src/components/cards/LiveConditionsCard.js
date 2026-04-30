import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors, typography, spacing, radius } from '../../design';

// ─── Condition theme ──────────────────────────────────────────────────────────
// Returns card tint, border, icon colour, and tempColor factoring in WMO code, heat, AQI.
// Priority: AQI danger > extreme heat > AQI unhealthy > high heat > AQI moderate
//           > weather code (rain/snow/clear/etc.)
function getTempColor(temp, code) {
  if (temp == null) return colors.textPrimary;
  const isSunny = code === 0 || code === 1;
  if (temp >= 38 && isSunny) return '#FF3B30';   // blazing red
  if (temp >= 38) return '#FF6B35';              // deep orange-red
  if (temp >= 34) return '#FF9500';              // amber orange
  if (temp >= 30) return '#FFD60A';              // warm yellow
  if (temp >= 20) return colors.textPrimary;     // neutral white
  if (temp >= 15) return '#BAE6FD';              // light cool blue
  if (temp >= 5)  return '#60A5FA';              // blue (cold)
  return '#BAE6FD';                              // ice blue (freezing)
}

function getConditionTheme(code, feelsLike, aqi, temp) {
  const heat = feelsLike ?? null;
  const aqiNum = aqi ?? 0;
  const tempColor = getTempColor(temp ?? feelsLike, code);

  // ── AQI hazardous / very unhealthy (>170) ────────────────────────────────
  if (aqiNum > 170) return {
    tint:   'rgba(185,28,28,0.34)',
    border: 'rgba(239,68,68,0.65)',
    icon:   '#FCA5A5',
    tempColor,
  };

  // ── Extreme heat ≥42°C feels-like ────────────────────────────────────────
  if (heat != null && heat >= 42) return {
    tint:   'rgba(220,38,38,0.32)',
    border: 'rgba(239,68,68,0.62)',
    icon:   '#FCA5A5',
    tempColor,
  };

  // ── AQI unhealthy (121–170) ───────────────────────────────────────────────
  if (aqiNum > 120) return {
    tint:   'rgba(194,65,12,0.30)',
    border: 'rgba(234,88,12,0.58)',
    icon:   '#FB923C',
    tempColor,
  };

  // ── High heat 35–41°C feels-like ─────────────────────────────────────────
  if (heat != null && heat >= 35) return {
    tint:   'rgba(234,88,12,0.26)',
    border: 'rgba(251,146,60,0.56)',
    icon:   '#FD8C3A',
    tempColor,
  };

  // ── AQI moderate (80–120) ─────────────────────────────────────────────────
  if (aqiNum > 80) return {
    tint:   'rgba(202,138,4,0.26)',
    border: 'rgba(234,179,8,0.54)',
    icon:   '#FDE047',
    tempColor,
  };

  // ── Weather-code themes (cool / normal temps, clean air) ─────────────────

  if (code == null) return { tint: colors.cardGlassStrong, border: colors.cardStroke, icon: colors.accentCyan, tempColor };

  // Thunderstorm
  if (code >= 95) return {
    tint:   'rgba(109,40,217,0.30)',
    border: 'rgba(139,92,246,0.60)',
    icon:   '#A78BFA',
    tempColor,
  };
  // Snow / blizzard
  if (code >= 71 && code <= 77) return {
    tint:   'rgba(186,230,253,0.24)',
    border: 'rgba(186,230,253,0.55)',
    icon:   '#BAE6FD',
    tempColor,
  };
  // Heavy showers / showers
  if (code >= 80 && code <= 82) return {
    tint:   'rgba(37,99,235,0.26)',
    border: 'rgba(59,130,246,0.56)',
    icon:   '#60A5FA',
    tempColor,
  };
  // Heavy rain
  if (code >= 63 && code <= 65) return {
    tint:   'rgba(29,78,216,0.28)',
    border: 'rgba(59,130,246,0.60)',
    icon:   '#3B82F6',
    tempColor,
  };
  // Light / moderate rain
  if (code >= 61 && code <= 62) return {
    tint:   'rgba(37,99,235,0.22)',
    border: 'rgba(96,165,250,0.52)',
    icon:   '#60A5FA',
    tempColor,
  };
  // Drizzle
  if (code >= 51 && code <= 55) return {
    tint:   'rgba(56,189,248,0.20)',
    border: 'rgba(56,189,248,0.50)',
    icon:   '#38BDF8',
    tempColor,
  };
  // Freezing rain
  if (code === 66 || code === 67) return {
    tint:   'rgba(148,163,184,0.24)',
    border: 'rgba(148,163,184,0.52)',
    icon:   '#CBD5E1',
    tempColor,
  };
  // Fog / haze
  if (code === 45 || code === 48) return {
    tint:   'rgba(100,116,139,0.22)',
    border: 'rgba(100,116,139,0.46)',
    icon:   '#94A3B8',
    tempColor,
  };
  // Overcast
  if (code === 3) return {
    tint:   'rgba(100,116,139,0.18)',
    border: 'rgba(148,163,184,0.44)',
    icon:   '#94A3B8',
    tempColor,
  };
  // Partly cloudy
  if (code === 1 || code === 2) return {
    tint:   'rgba(155,200,255,0.20)',
    border: 'rgba(155,200,255,0.48)',
    icon:   colors.accentCyan,
    tempColor,
  };
  // Clear sky — warm golden (pleasant conditions)
  return {
    tint:   'rgba(251,191,36,0.20)',
    border: 'rgba(251,191,36,0.48)',
    icon:   '#FCD34D',
    tempColor,
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
  temp,               // raw °C actual temperature for dynamic color
  feelsLike,          // raw °C number for card theme (heat tint)
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
  const theme = getConditionTheme(weatherCode, feelsLike, aqi, temp);

  return (
    <GlassCard
      strong
      intensity={42}
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
          <Text style={[styles.temp, { color: theme.tempColor }]}>{tempLabel}</Text>
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
