import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors, typography, spacing, statusColor } from '../../design';

/**
 * AdvisorySourceCard — compact card representing an official advisory
 * source (NHMP, PMD, NDMA). Shows name, primary metric, and status.
 *
 * Props:
 *   - name:     short source name, shown as eyebrow ("NHMP")
 *   - title:    main one-line headline ("10 routes to review first")
 *   - subtitle: secondary context ("25 routes clear")
 *   - status:   'ok' | 'caution' | 'danger' | 'unknown'
 *   - onPress:  if provided, card becomes tappable (for official source link)
 */
export default function AdvisorySourceCard({
  name,
  title,
  subtitle,
  status = 'unknown',
  onPress,
}) {
  const s = STATUS_MAP[status] || STATUS_MAP.unknown;
  return (
    <GlassCard
      onPress={onPress}
      hapticStyle={onPress ? 'selection' : null}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <View style={[styles.dot, { backgroundColor: s.fg }]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onPress ? (
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Official source</Text>
          <Icon name={ICON.external} size={14} color={colors.textSecondary} />
        </View>
      ) : null}
    </GlassCard>
  );
}

const STATUS_MAP = {
  ok: { fg: colors.accentGreen },
  caution: { fg: colors.accentOrange },
  danger: { fg: colors.accentRed },
  unknown: { fg: colors.textMuted },
};

const styles = StyleSheet.create({
  content: { padding: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    ...typography.sectionLabel,
    color: colors.textMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    ...typography.cardSubtitle,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  footerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
