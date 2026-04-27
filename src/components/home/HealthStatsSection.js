import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassCard } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors as dc } from '../../design';

function formatDistance(distanceKm) {
  if (distanceKm == null) return '--';
  return `${distanceKm.toFixed(distanceKm >= 10 ? 0 : 1)} km`;
}

function getHealthNote({ healthAuthorized, notificationsReady }) {
  if (!healthAuthorized) return 'Grant Health access to unlock smarter walk alerts.';
  if (notificationsReady) return 'Smart notifications active';
  return 'Enable notifications to receive timely outdoor nudges.';
}

export default function HealthStatsSection({
  steps = 0,
  distanceKm = 0,
  outdoorScore = 0,
  healthAuthorized = false,
  notificationsReady = false,
  loading = false,
  onRequestAccess,
}) {
  const note = loading
    ? 'Checking your daily activity and outdoor window…'
    : getHealthNote({ healthAuthorized, notificationsReady });

  return (
    <GlassCard style={styles.card} contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Health & Outdoor Score</Text>
          <Text style={styles.note}>{note}</Text>
        </View>
        {!healthAuthorized && onRequestAccess ? (
          <TouchableOpacity style={styles.accessButton} activeOpacity={0.8} onPress={onRequestAccess}>
            <Text style={styles.accessButtonText}>Enable</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Icon name={ICON.activities} size={18} color={dc.accentCyan} />
          <Text style={styles.metricValue}>{steps.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Steps today</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Icon name={ICON.locationPin} size={18} color={dc.accentGreen} />
          <Text style={styles.metricValue}>{formatDistance(distanceKm)}</Text>
          <Text style={styles.metricLabel}>Walked</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Icon name={ICON.design} size={18} color={dc.accentYellow} />
          <Text style={styles.metricValue}>{outdoorScore}/10</Text>
          <Text style={styles.metricLabel}>Outdoor score</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 2 },
  content: { padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: dc.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 },
  note: { fontSize: 13, lineHeight: 18, color: dc.textSecondary, maxWidth: '86%' },
  accessButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: dc.accentCyan + '22',
    borderWidth: 1,
    borderColor: dc.accentCyan + '44',
  },
  accessButtonText: { fontSize: 12, fontWeight: '700', color: dc.accentCyan },
  metricsRow: { flexDirection: 'row', alignItems: 'stretch', paddingRight: 70 },
  metric: { flex: 1, alignItems: 'center', gap: 6 },
  metricDivider: { width: 1, backgroundColor: dc.cardStrokeSoft, marginHorizontal: 10 },
  metricValue: { fontSize: 18, fontWeight: '700', color: dc.textPrimary },
  metricLabel: { fontSize: 11, fontWeight: '600', color: dc.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
});
