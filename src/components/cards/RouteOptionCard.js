import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard, GlassPill } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors, typography, statusColor, radius } from '../../design';

/**
 * RouteOptionCard — a single route suggestion in the route results list.
 *
 * Props:
 *   - label:         "Fastest" | "Safest" | "Family friendly" | "EV friendly"
 *   - recommended:   show the cyan "Recommended" ribbon
 *   - duration:      "4h 38m"
 *   - distance:      "376 km"
 *   - via:           e.g. "M2 corridor"
 *   - riskScore:     number 0..100 (higher = safer)
 *   - advisory:      short advisory chip text, e.g. "1 active closure"
 *   - advisoryLevel: 'ok' | 'caution' | 'danger' (tints the advisory chip)
 *   - recommendation:one-line verdict ("Go with care", "High caution"…)
 *   - onPress
 */
export default function RouteOptionCard({
  label,
  recommended = false,
  duration,
  distance,
  via,
  riskScore,
  advisory,
  advisoryLevel = 'ok',
  recommendation,
  onPress,
}) {
  const verdict = verdictColor(recommendation);
  const risk = riskColor(riskScore);

  return (
    <GlassCard
      onPress={onPress}
      hapticStyle={onPress ? 'selection' : null}
      borderColor={recommended ? colors.accentCyanGlow : colors.cardStroke}
      contentStyle={styles.content}
    >
      <View style={styles.headRow}>
        <Text style={styles.label}>{label?.toUpperCase()}</Text>
        {recommended ? (
          <View style={styles.badge}>
            <Icon name={ICON.shield} size={12} color={colors.accentCyan} />
            <Text style={styles.badgeText}>Recommended</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricLeft}>
          <Text style={styles.duration}>{duration}</Text>
          <Text style={styles.distance}>
            {distance}
            {via ? ` · ${via}` : ''}
          </Text>
        </View>
        {riskScore != null ? (
          <View style={[styles.riskWrap, { borderColor: risk.stroke }]}>
            <Text style={[styles.riskScore, { color: risk.fg }]}>{riskScore}</Text>
            <Text style={styles.riskLabel}>RISK SCORE</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {advisory ? (
          <GlassPill
            label={advisory}
            compact
            leadingIcon={
              <Icon
                name={
                  advisoryLevel === 'danger'
                    ? ICON.danger
                    : advisoryLevel === 'caution'
                      ? ICON.warning
                      : ICON.success
                }
                size={12}
                color={statusColor(advisoryLevel).fg}
              />
            }
          />
        ) : null}
        {recommendation ? (
          <View style={styles.verdict}>
            <Icon name={ICON.info} size={12} color={verdict.fg} />
            <Text style={[styles.verdictText, { color: verdict.fg }]}>
              {recommendation}
            </Text>
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
}

function riskColor(score) {
  if (score == null) return statusColor('info');
  if (score >= 75) return statusColor('go');
  if (score >= 50) return statusColor('caution');
  return statusColor('danger');
}

function verdictColor(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('avoid') || t.includes('high caution')) return statusColor('danger');
  if (t.includes('care') || t.includes('caution')) return statusColor('caution');
  if (t.includes('recommended') || t.includes('clear')) return statusColor('go');
  return statusColor('info');
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  label: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accentCyanBg,
    borderWidth: 1,
    borderColor: colors.accentCyanGlow,
  },
  badgeText: {
    ...typography.micro,
    color: colors.accentCyan,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricLeft: { flex: 1 },
  duration: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  distance: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  riskWrap: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  riskScore: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  riskLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  verdictText: {
    ...typography.caption,
  },
});
