import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getWeatherDescription } from '../utils/weatherCodes';

export default function WeatherCard({ temp, feelsLike, humidity, windSpeed, weatherCode, loading }) {
  const { isDark, colors } = useTheme();
  const weather = getWeatherDescription(weatherCode);

  const cardShadow = !isDark
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      }
    : {};

  const cardBorder = isDark
    ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }
    : {};

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
      <Text style={styles.icon}>{weather.icon}</Text>
      <Text style={[styles.temp, { color: colors.text }]}>
        {temp != null ? `${Math.round(temp)}\u00B0` : '--'}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {weather.description}
      </Text>
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Feels like</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {feelsLike != null ? `${Math.round(feelsLike)}\u00B0` : '--'}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Humidity</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {humidity != null ? `${humidity}%` : '--'}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Wind</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {windSpeed != null ? `${windSpeed} km/h` : '--'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  icon: {
    fontSize: 48,
    marginBottom: 8,
  },
  temp: {
    fontSize: 40,
    fontWeight: '800',
  },
  description: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 30,
  },
});
