/**
 * SynthesisCard — unified outdoor intelligence card.
 *
 * Replaces the old OutdoorDecisionCard + AI briefing GlassCard pair.
 * Shows a single, authoritative read pulling from every data source:
 * weather, AQI, CAP alerts, pollen, and tomorrow's forecast.
 *
 * Free users see a rule-based brief (same card layout, no AI).
 * Premium users see the Gemini-synthesized brief.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  LayoutAnimation, UIManager, Platform, ActivityIndicator,
} from 'react-native';
import { GlassCard } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors as dc, statusColor } from '../../design';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Severity helpers ─────────────────────────────────────────────────────────
function severityToStatus(severity) {
  if (severity === 'danger')  return 'danger';
  if (severity === 'caution') return 'caution';
  return 'go';
}

function severityIcon(severity) {
  if (severity === 'danger')  return ICON.danger;
  if (severity === 'caution') return ICON.warning;
  return ICON.success;
}

function ageLabel(fetchedAt) {
  if (!fetchedAt) return null;
  const mins = Math.floor((Date.now() - fetchedAt) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ─── Action bullet ────────────────────────────────────────────────────────────
function ActionBullet({ text, fg }) {
  return (
    <View style={styles.actionRow}>
      <View style={[styles.actionDot, { backgroundColor: fg }]} />
      <Text style={[styles.actionText, { color: dc.textSecondary }]}>{text}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SynthesisCard({
  synthesis,
  loading,
  fetchedAt,
  isPremium,
  onRefresh,
}) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }, []);

  // Derive display values
  const severity = synthesis?.severity ?? 'go';
  const status   = severityToStatus(severity);
  const s        = statusColor(status);
  const icon     = severityIcon(severity);

  const headline = synthesis?.headline ?? (loading ? null : 'Gathering live conditions…');
  const summary  = synthesis?.summary  ?? null;
  const actions  = synthesis?.actions  ?? [];
  const window   = synthesis?.window   ?? null;
  const isAI     = synthesis?.provider === 'gemini';
  const age      = ageLabel(fetchedAt);

  return (
    <GlassCard
      tintColor={s.tint}
      borderColor={s.stroke}
      contentStyle={styles.content}
    >
      {/* ── Header row ── */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>OUTDOOR BRIEF</Text>
          {/* AI badge — always visible: cyan for Gemini, muted for rule-based */}
          <View style={[styles.aiBadge, !isAI && styles.aiBadgeMuted]}>
            <Icon name="sparkles" size={9} color={isAI ? dc.accentCyan : dc.textMuted} />
            <Text style={[styles.aiBadgeText, !isAI && styles.aiBadgeTextMuted]}>AI</Text>
          </View>
          {!!age && <Text style={styles.ageText}>{age}</Text>}
        </View>
        <Icon
          name={expanded ? ICON.chevronUp : ICON.chevronDown}
          size={14}
          color={dc.textMuted}
        />
      </TouchableOpacity>

      {/* ── Headline ── */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={styles.headlineTap}>
        {loading && !headline ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={s.fg} />
            <Text style={[styles.loadingText, { color: s.fg }]}>Reading all conditions…</Text>
          </View>
        ) : (
          <View style={styles.headlineRow}>
            <Icon name={icon} size={20} color={s.fg} />
            <Text style={[styles.headline, { color: s.fg }]} numberOfLines={expanded ? 0 : 2}>
              {headline}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Expanded content ── */}
      {expanded && (
        <View style={styles.expandedBody}>
          {/* Summary */}
          {!!summary && (
            <Text style={styles.summary}>{summary}</Text>
          )}

          {/* Action bullets */}
          {actions.length > 0 && (
            <View style={styles.actionsBlock}>
              {actions.map((a, i) => (
                <ActionBullet key={i} text={a} fg={s.fg} />
              ))}
            </View>
          )}

          {/* Best window pill */}
          {!!window && (
            <View style={[styles.windowPill, { backgroundColor: `${s.fg}18`, borderColor: `${s.fg}30` }]}>
              <Icon name="time-outline" size={12} color={s.fg} />
              <Text style={[styles.windowText, { color: s.fg }]}>{window}</Text>
            </View>
          )}

          {/* Free-user upgrade hint */}
          {!isPremium && (
            <View style={styles.upgradeRow}>
              <Icon name="lock-closed-outline" size={11} color={dc.textMuted} />
              <Text style={styles.upgradeText}>
                AI synthesis unlocked with Premium — draws from all live sources at once.
              </Text>
            </View>
          )}

          {/* Refresh link */}
          <TouchableOpacity
            style={styles.refreshRow}
            onPress={onRefresh}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Icon name="refresh-outline" size={12} color={dc.textMuted} />
            <Text style={[styles.refreshText, loading && { opacity: 0.4 }]}>
              {loading ? 'Refreshing…' : 'Refresh now'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </GlassCard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: { padding: 18 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: dc.textMuted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(155,200,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  aiBadgeMuted: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: dc.accentCyan,
    letterSpacing: 0.5,
  },
  aiBadgeTextMuted: {
    color: dc.textMuted,
  },
  ageText: {
    fontSize: 10,
    color: dc.textMuted,
    marginLeft: 'auto',
  },

  headlineTap: { marginBottom: 2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    flex: 1,
  },

  // Expanded
  expandedBody: {
    marginTop: 14,
    gap: 12,
  },
  summary: {
    fontSize: 13,
    color: dc.textSecondary,
    lineHeight: 20,
  },

  actionsBlock: {
    gap: 7,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  actionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },

  windowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  windowText: {
    fontSize: 12,
    fontWeight: '700',
  },

  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 10,
  },
  upgradeText: {
    fontSize: 11,
    color: dc.textMuted,
    flex: 1,
    lineHeight: 16,
  },

  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
  },
  refreshText: {
    fontSize: 11,
    color: dc.textMuted,
    fontWeight: '600',
  },
});
