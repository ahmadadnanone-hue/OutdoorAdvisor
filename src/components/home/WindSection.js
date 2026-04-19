import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors as dc } from '../../design';

export default function WindSection({ weatherCurrent, displayWindGusts, currentWindDirection, gustsFromForecast, directionFromForecast, settings, onInsightPress }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Wind</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onInsightPress}>
        <View style={styles.card}>
          <View style={styles.columns}>
            <WindCol
              value={weatherCurrent?.windSpeed != null ? `${Math.round(settings.convertWind(weatherCurrent.windSpeed))}` : '--'}
              unit={settings.windUnitLabel}
              label="Speed"
            />
            <View style={styles.divider} />
            <WindCol
              value={displayWindGusts != null ? `${Math.round(settings.convertWind(displayWindGusts))}` : '--'}
              unit={settings.windUnitLabel}
              label={gustsFromForecast ? 'Gusts*' : 'Gusts'}
            />
            <View style={styles.divider} />
            <WindCol
              value={currentWindDirection}
              unit=" "
              label={directionFromForecast ? 'Direction*' : 'Direction'}
            />
          </View>
          {(gustsFromForecast || directionFromForecast) && (
            <Text style={styles.footnote}>* Forecast-derived when live station data is unavailable.</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function WindCol({ value, unit, label }) {
  return (
    <View style={styles.col}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: dc.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  card: { backgroundColor: dc.cardGlass, borderRadius: 22, borderWidth: 1, borderColor: dc.cardStrokeSoft, padding: 18 },
  columns: { flexDirection: 'row', alignItems: 'center' },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  value: { fontSize: 28, fontWeight: '800', color: dc.textPrimary, letterSpacing: -0.5 },
  unit: { fontSize: 11, fontWeight: '600', color: dc.textMuted },
  label: { fontSize: 11, fontWeight: '600', color: dc.textSecondary },
  divider: { width: 1, height: 48, backgroundColor: dc.cardStrokeSoft },
  footnote: { fontSize: 11, color: dc.textMuted, marginTop: 12, lineHeight: 16 },
});
