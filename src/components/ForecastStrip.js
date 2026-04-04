import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getWeatherDescription } from '../utils/weatherCodes';
import AnimatedWeatherIcon from './AnimatedWeatherIcon';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDayName(dateString, index) {
  if (index === 0) return 'Today';
  const date = new Date(dateString);
  return DAY_NAMES[date.getDay()];
}

function ForecastItem({ item, index, colors, isDark, isLast, onPress }) {
  const weather = getWeatherDescription(item.weatherCode);
  const isToday = index === 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress && onPress(item)}
      style={[
        styles.item,
        {
          backgroundColor: isToday
            ? (isDark ? 'rgba(79,142,247,0.12)' : 'rgba(79,142,247,0.08)')
            : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
          borderColor: isToday ? (isDark ? 'rgba(79,142,247,0.3)' : 'rgba(79,142,247,0.2)') : 'transparent',
          borderWidth: isToday ? 1 : 0,
        },
        !isLast && { marginRight: 10 },
      ]}
    >
      <Text style={[styles.dayName, { color: isToday ? '#4F8EF7' : colors.text }]}>
        {getDayName(item.date, index)}
      </Text>
      <View style={styles.iconWrap}>
        <AnimatedWeatherIcon weatherCode={item.weatherCode} emoji={weather.icon} size={26} />
      </View>
      <Text style={[styles.highTemp, { color: colors.text }]}>
        {Math.round(item.maxTemp)}°
      </Text>
      <Text style={[styles.lowTemp, { color: colors.textSecondary }]}>
        {Math.round(item.minTemp)}°
      </Text>
      {item.precipProbability != null && item.precipProbability > 0 && (
        <Text style={styles.rainChance}>
          💧{item.precipProbability}%
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function ForecastStrip({ daily, loading, onDayPress }) {
  const { isDark, colors } = useTheme();

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: colors.card },
        cardShadow,
        cardBorder,
      ]}
    >
      <FlatList
        data={daily}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <ForecastItem
            item={item}
            index={index}
            colors={colors}
            isDark={isDark}
            isLast={daily && index === daily.length - 1}
            onPress={onDayPress}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapper: {
    borderRadius: 20,
    padding: 14,
  },
  listContent: {
    gap: 0,
  },
  item: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: 76,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconWrap: {
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  highTemp: {
    fontSize: 16,
    fontWeight: '700',
  },
  lowTemp: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 3,
  },
  rainChance: {
    fontSize: 10,
    color: '#38BDF8',
    marginTop: 4,
    fontWeight: '600',
  },
});
