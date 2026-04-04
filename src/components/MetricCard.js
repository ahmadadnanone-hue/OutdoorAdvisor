import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import typography from '../theme/typography';
import CircularGauge from './CircularGauge';

/**
 * A themed card that displays a metric with a circular gauge.
 *
 * Props:
 *   title       - label text (e.g. "PM2.5")
 *   icon        - emoji string shown before the title
 *   value       - numeric value for the gauge
 *   unit        - unit string shown inside the gauge
 *   gaugeColor  - color for the filled arc
 *   maxValue    - upper bound of the gauge (default 100)
 *   onSetAlert  - optional callback; if provided, a "Set Alert" button is shown
 */
export default function MetricCard({
  title,
  icon,
  value,
  unit,
  gaugeColor,
  maxValue = 100,
  onSetAlert,
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Gauge */}
      <View style={styles.gaugeWrapper}>
        <CircularGauge
          value={value}
          maxValue={maxValue}
          label={title}
          unit={unit}
          size={120}
          color={gaugeColor}
          backgroundColor={colors.border}
        />
      </View>

      {/* Optional alert button */}
      {onSetAlert && (
        <TouchableOpacity
          style={[styles.alertButton, { borderColor: colors.border }]}
          onPress={onSetAlert}
          activeOpacity={0.7}
        >
          <Text style={[styles.alertButtonText, { color: colors.textSecondary }]}>
            Set Alert
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    // Subtle shadow (iOS + Android)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: typography.subtitle,
    marginRight: 6,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  gaugeWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  alertButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  alertButtonText: {
    fontSize: typography.caption,
    fontWeight: '500',
  },
});
