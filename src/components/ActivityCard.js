import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getActivitySummary } from '../utils/activityScoring';

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
        { backgroundColor: colors.card },
        emphasize && { borderColor: summary.color + '55', borderWidth: 1.5 },
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
          <View style={styles.identityRow}>
            <Text style={styles.icon}>{activity.emoji}</Text>
            <View style={styles.copyBlock}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {activity.name}
                </Text>
                {!!rankLabel && (
                  <View style={[styles.rankBadge, { backgroundColor: summary.color + '18' }]}>
                    <Text style={[styles.rankText, { color: summary.color }]}>{rankLabel}</Text>
                  </View>
                )}
              </View>
              {compact ? (
                <Text style={[styles.metaLine, { color: colors.textSecondary }]} numberOfLines={1}>
                  {summary.bestTime}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.rightSection}>
          <Text style={[styles.scoreValue, { color: summary.color }]}>{summary.score}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>/100</Text>
          {!compact && (
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
    minHeight: 82,
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
    flex: 1,
    paddingRight: 10,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 22,
  },
  copyBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  metaLine: {
    fontSize: 12,
    marginTop: 4,
  },
  rankBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 24,
  },
  scoreLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});
