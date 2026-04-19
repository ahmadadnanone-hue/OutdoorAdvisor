import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ForecastStrip from '../ForecastStrip';
import HourlyForecastStrip from '../HourlyForecastStrip';
import { colors as dc } from '../../design';

export default function ForecastSection({ daily, hourly, weatherLoading, onDayPress }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>7-Day Forecast</Text>
      <ForecastStrip daily={daily} loading={weatherLoading} onDayPress={onDayPress} />
      <Text style={styles.subtitle}>Next 12 Hours</Text>
      <HourlyForecastStrip hourly={hourly} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: dc.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  subtitle: { fontSize: 13, fontWeight: '700', color: dc.textSecondary, marginTop: 6 },
});
