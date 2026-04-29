import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import AnimatedWeatherIcon from './AnimatedWeatherIcon';

function formatHourLabel(time) {
  if (!time) return '--';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

export default function HourlyForecastStrip({ hourly = [] }) {
  const { colors, isDark } = useTheme();
  const { formatTempShort } = useSettings();

  if (!hourly.length) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Hourly forecast will appear when forecast-hour data is available.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.card }]}>
      <View style={styles.cueRow}>
        <Text style={[styles.cueText, { color: colors.textSecondary }]}>Swipe →</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {hourly.slice(0, 12).map((hour) => {
          return (
            <View
              key={hour.time}
              style={[
                styles.item,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              <Text style={[styles.hourLabel, { color: colors.textSecondary }]}>
                {hour.hourLabel != null ? formatHourLabel(`2000-01-01T${String(hour.hourLabel).padStart(2, '0')}:00:00`) : formatHourLabel(hour.time)}
              </Text>
              <AnimatedWeatherIcon weatherCode={hour.weatherCode} size={34} />
              <Text style={[styles.temp, { color: colors.text }]}>
                {formatTempShort(hour.temp)}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {hour.precipProbability != null ? `${hour.precipProbability}% rain` : 'Dry'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    padding: 14,
  },
  cueRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  cueText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingRight: 18,
  },
  item: {
    width: 82,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  hourLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  temp: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  meta: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
