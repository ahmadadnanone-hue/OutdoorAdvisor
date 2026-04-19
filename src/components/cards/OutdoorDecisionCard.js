import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors, typography, statusColor } from '../../design';

/**
 * OutdoorDecisionCard — status-tinted glass card with a calm, honest
 * verdict on outdoor plans. Used on Home below the LiveConditionsCard.
 *
 * Safety copy rule: never say "safe". Use "Go with care", "High caution",
 * "Avoid if possible".
 *
 * Props:
 *   - status:   'go' | 'caution' | 'danger'
 *   - title:    headline ("Go with care")
 *   - body:     one-line rationale
 *   - onPress:  optional "More info" handler
 */
export default function OutdoorDecisionCard({ status = 'go', title, body, onPress }) {
  const s = statusColor(status);
  const iconName =
    status === 'danger' ? ICON.danger : status === 'caution' ? ICON.warning : ICON.success;

  return (
    <GlassCard
      tintColor={s.tint}
      borderColor={s.stroke}
      onPress={onPress}
      hapticStyle={onPress ? 'light' : null}
      contentStyle={styles.content}
    >
      <Text style={styles.eyebrow}>OUTDOOR DECISION</Text>
      <View style={styles.headRow}>
        <Icon name={iconName} size={22} color={s.fg} />
        <Text style={[styles.title, { color: s.fg }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {onPress ? (
        <View style={styles.footer}>
          <Text style={[styles.more, { color: s.fg }]}>More info</Text>
          <Icon name={ICON.chevronRight} size={14} color={s.fg} />
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
    marginBottom: 6,
  },
  title: {
    ...typography.cardSubtitle,
    flex: 1,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  more: {
    ...typography.caption,
    fontWeight: '800',
  },
});
