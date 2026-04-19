import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors as dc } from '../../design';

export default function DetailsSection({ weatherCurrent, feelsLikeTemp, feelsLikeColor, pm25, pm25Color, settings }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Current Details</Text>
      <View style={styles.grid}>
        <DetailCell icon="🌡️" value={settings.formatTempShort(feelsLikeTemp)} label="Feels Like" valueColor={feelsLikeColor} />
        <DetailCell
          icon="💨"
          value={weatherCurrent?.windSpeed != null ? `${Math.round(settings.convertWind(weatherCurrent.windSpeed))}` : '--'}
          label={`Wind ${settings.windUnitLabel}`}
          valueColor={dc.accentOrange}
        />
        <DetailCell icon="🌫️" value={pm25 != null ? String(pm25) : '--'} label="PM2.5" valueColor={pm25Color} />
        <DetailCell icon="🌤️" value={settings.formatTempShort(weatherCurrent?.temp)} label="Temp" valueColor={dc.accentCyan} />
      </View>
    </View>
  );
}

function DetailCell({ icon, value, label, valueColor }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellIcon}>{icon}</Text>
      <Text style={[styles.cellValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: dc.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    flex: 1, minWidth: '44%', alignItems: 'center', padding: 16,
    backgroundColor: dc.cardGlass, borderRadius: 18, borderWidth: 1, borderColor: dc.cardStrokeSoft,
  },
  cellIcon: { fontSize: 22, marginBottom: 6 },
  cellValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  cellLabel: { fontSize: 11, fontWeight: '600', color: dc.textMuted, marginTop: 4 },
});
