import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import AnimatedWeatherIcon from '../AnimatedWeatherIcon';
import Icon from '../Icon';
import { getWeatherDescription } from '../../utils/weatherCodes';
import { getWindDirectionLabel, getUvLabel } from './homeUtils';
import { colors as dc } from '../../design';

function formatTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function ForecastDetailModal({ forecastDetail, onClose, settings }) {
  if (!forecastDetail) return null;
  const weather = getWeatherDescription(forecastDetail.weatherCode);
  const windDir = forecastDetail.windDirection != null ? getWindDirectionLabel(forecastDetail.windDirection) : '--';

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <ScrollView style={styles.card} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.day}>
            {new Date(forecastDetail.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <View style={styles.iconWrap}>
            <AnimatedWeatherIcon weatherCode={forecastDetail.weatherCode} size={64} />
          </View>
          <Text style={styles.desc}>{weather.description}</Text>

          <View style={styles.temps}>
            <TempCol label="High" value={settings.formatTempShort(forecastDetail.maxTemp)} primary />
            <View style={styles.tempDivider} />
            <TempCol label="Low" value={settings.formatTempShort(forecastDetail.minTemp)} />
          </View>

          <View style={styles.grid}>
            <FdCell icon="thermometer-outline" label="Feels Like" value={`${settings.formatTempShort(forecastDetail.feelsLikeMax)} / ${settings.formatTempShort(forecastDetail.feelsLikeMin)}`} />
            <FdCell icon="water-outline" label="Rain Chance" value={forecastDetail.precipProbability != null ? `${forecastDetail.precipProbability}%` : '--'} />
            <FdCell icon="rainy-outline" label="Precipitation" value={settings.formatPrecip(forecastDetail.precipitation)} />
            <FdCell icon="water" label="Humidity" value={forecastDetail.humidityMax != null ? `${forecastDetail.humidityMin}-${forecastDetail.humidityMax}%` : '--'} />
            <FdCell icon="cloud-outline" label="Wind" value={forecastDetail.windSpeed != null ? `${settings.formatWind(forecastDetail.windSpeed)} ${windDir}` : '--'} />
            <FdCell icon="speedometer-outline" label="Gusts" value={settings.formatWind(forecastDetail.windGusts)} />
            <FdCell icon="sunny-outline" label="UV Index" value={forecastDetail.uvIndex != null ? `${forecastDetail.uvIndex} ${getUvLabel(forecastDetail.uvIndex)}` : '--'} />
            <FdCell icon="partly-sunny-outline" label="Sun" value={`${formatTime(forecastDetail.sunrise)} - ${formatTime(forecastDetail.sunset)}`} />
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function TempCol({ label, value, primary }) {
  return (
    <View style={styles.tempCol}>
      <Text style={styles.tempLabel}>{label}</Text>
      <Text style={[styles.tempValue, { color: primary ? dc.textPrimary : dc.textSecondary }]}>{value}</Text>
    </View>
  );
}

function FdCell({ icon, label, value }) {
  return (
    <View style={styles.fdCell}>
      <View style={styles.fdIcon}>
        <Icon name={icon} size={18} color={dc.accentCyan} />
      </View>
      <Text style={styles.fdLabel}>{label}</Text>
      <Text style={styles.fdValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#151D2E', borderRadius: 24, width: '100%', maxHeight: '88%', borderWidth: 1, borderColor: dc.cardStroke },
  cardContent: { padding: 24, gap: 16 },
  day: { fontSize: 22, fontWeight: '800', color: dc.textPrimary, textAlign: 'center' },
  iconWrap: { alignItems: 'center', marginVertical: 4 },
  desc: { fontSize: 16, color: dc.textSecondary, textAlign: 'center' },
  temps: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  tempCol: { alignItems: 'center', gap: 4 },
  tempLabel: { fontSize: 12, fontWeight: '600', color: dc.textMuted },
  tempValue: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  tempDivider: { width: 1, height: 48, backgroundColor: dc.cardStrokeSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fdCell: { width: '47%', backgroundColor: dc.cardGlass, borderRadius: 14, padding: 14, gap: 4 },
  fdIcon: { width: 22, height: 22, justifyContent: 'center' },
  fdLabel: { fontSize: 11, fontWeight: '600', color: dc.textMuted },
  fdValue: { fontSize: 14, fontWeight: '700', color: dc.textPrimary },
  closeBtn: { backgroundColor: dc.accentCyan, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: dc.bgTop },
});
