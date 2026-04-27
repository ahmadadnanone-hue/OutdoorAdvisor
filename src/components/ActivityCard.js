import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getActivitySummary } from '../utils/activityScoring';
import Icon from './Icon';

export default function ActivityCard({
  activity,
  aqi,
  weather,
  hourly,
  onPress,
  compact = false,
  emphasize = false,
  rankLabel = null,
}) {
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
        compact && styles.cardCompact,
        { backgroundColor: compact ? summary.color + '12' : colors.card },
        emphasize && { borderColor: summary.color + '55', borderWidth: 1.5 },
        compact && { borderColor: summary.color + '26', borderWidth: 1 },
        cardShadow,
        cardBorder,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left colored accent border */}
      <View style={[styles.accentBorder, { backgroundColor: summary.color }]} />

      <View style={styles.content}>
        {/* Left: icon + name */}
        <View style={styles.leftSection}>
          <Icon
            name={activity.icon || 'fitness-outline'}
            size={compact ? 20 : 22}
            color={summary.color}
            style={styles.activityIcon}
          />
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={compact ? 2 : 1}
          >
            {activity.name}
          </Text>
          {compact && (
            <Text style={[styles.metaLine, { color: colors.textSecondary }]} numberOfLines={1}>
              {summary.bestTime}
            </Text>
          )}
        </View>

        {/* Right: score + rank */}
        <View style={styles.rightSection}>
          {!!rankLabel && (
            <View style={[styles.rankBadge, { backgroundColor: summary.color + '20' }]}>
              <Text style={[styles.rankText, { color: summary.color }]}>{rankLabel}</Text>
            </View>
          )}
          <Text style={[styles.scoreValue, { color: summary.color }]}>{summary.score}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>/100</Text>
          {!compact && (
            <View style={[styles.statusBadge, { backgroundColor: summary.color + '26' }]}>
              <Text style={[styles.statusText, { color: summary.color }]}>
                {summary.label}
              </Text>
            </View>
          )}
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
    minHeight: 72,
  },
  cardCompact: {
    minHeight: 86,
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
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    gap: 8,
  },

  // Left: icon stacked above name
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  activityIcon: {
    marginBottom: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  metaLine: {
    fontSize: 11,
    marginTop: 1,
  },

  // Right: rank pill → score → /100
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
  },
  rankBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 2,
  },
  rankText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  scoreLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
