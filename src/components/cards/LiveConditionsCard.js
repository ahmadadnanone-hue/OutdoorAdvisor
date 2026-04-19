import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors, typography, spacing, radius } from '../../design';

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
  condition,
  tempLabel,
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
  return (
    <GlassCard strong contentStyle={styles.content} onPress={onPress} hapticStyle={onPress ? 'light' : null}>
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
          {weatherIconNode || <Icon name={weatherIcon} size={56} color={colors.accentCyan} />}
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
