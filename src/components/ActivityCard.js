import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getActivitySummary } from '../utils/activityScoring';

export default function ActivityCard({ activity, aqi, weather, hourly, onPress }) {
  const { isDark, colors } = useTheme();
  const summary = getActivitySummary(activity, aqi ?? 0, weather, hourly);

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

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card },
        cardShadow,
        cardBorder,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left colored accent border */}
      <View
        style={[
          styles.accentBorder,
          { backgroundColor: summary.color },
        ]}
      />
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Text style={styles.icon}>{activity.emoji}</Text>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {activity.name}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: summary.color + '26' },
          ]}
        >
          <Text style={[styles.statusText, { color: summary.color }]}>
            {summary.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 56,
  },
  accentBorder: {
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  icon: {
    fontSize: 22,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
