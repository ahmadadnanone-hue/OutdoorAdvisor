import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard, GlassPill } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors, typography, statusColor } from '../../design';

/**
 * TravelSnapshotCard — high-density snapshot of road/road-advisory state.
 * Takes on a warning tint when things are not calm.
 *
 * Props:
 *   - level:  'calm' | 'elevated' | 'high'
 *   - title:  headline ("High travel caution")
 *   - body:   rationale paragraph
 *   - stats:  array of { label, value } shown as stat pills
 */
export default function TravelSnapshotCard({
  level = 'calm',
  title,
  body,
  stats = [],
}) {
  const statusKey =
    level === 'high' ? 'danger' : level === 'elevated' ? 'caution' : 'go';
  const s = statusColor(statusKey);
  const iconName =
    level === 'high' ? ICON.danger : level === 'elevated' ? ICON.warning : ICON.success;

  return (
    <GlassCard
      tintColor={level === 'calm' ? colors.cardGlass : s.tint}
      borderColor={level === 'calm' ? colors.cardStroke : s.stroke}
      contentStyle={styles.content}
    >
      <Text style={styles.eyebrow}>TRAVEL SNAPSHOT</Text>
      <View style={styles.headRow}>
        <Icon name={iconName} size={22} color={s.fg} />
        <Text style={[styles.title, { color: s.fg }]}>{title}</Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {stats.length ? (
        <View style={styles.pills}>
          {stats.map((st) => (
            <GlassPill
              key={st.label}
              label={`${st.value} ${st.label}`}
              compact
            />
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.textMuted,
    marginBottom: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    ...typography.cardSubtitle,
    flex: 1,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
});
