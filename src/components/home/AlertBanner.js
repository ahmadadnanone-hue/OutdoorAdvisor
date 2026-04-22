import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutAnimation,
  UIManager, Platform,
} from 'react-native';
import Icon from '../Icon';
import { colors as dc } from '../../design';

// Android needs this for LayoutAnimation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Severity config ──────────────────────────────────────────────────────────
const SEVERITY = {
  Extreme: {
    bg:     'rgba(220,38,38,0.18)',
    border: 'rgba(220,38,38,0.45)',
    icon:   '#F87171',
    dot:    '#EF4444',
    label:  'EXTREME',
  },
  Severe: {
    bg:     'rgba(234,88,12,0.15)',
    border: 'rgba(234,88,12,0.40)',
    icon:   '#FB923C',
    dot:    '#F97316',
    label:  'SEVERE',
  },
  Moderate: {
    bg:     'rgba(202,138,4,0.13)',
    border: 'rgba(202,138,4,0.35)',
    icon:   '#FCD34D',
    dot:    '#EAB308',
    label:  'ADVISORY',
  },
  Minor: {
    bg:     'rgba(100,116,139,0.12)',
    border: 'rgba(100,116,139,0.28)',
    icon:   dc.textMuted,
    dot:    dc.textMuted,
    label:  'INFO',
  },
};

function severityIcon(severity) {
  if (severity === 'Extreme' || severity === 'Severe') return 'warning-outline';
  if (severity === 'Moderate') return 'alert-circle-outline';
  return 'information-circle-outline';
}

function formatAge(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Single alert row ─────────────────────────────────────────────────────────
function AlertRow({ alert, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const s = SEVERITY[alert.severity] || SEVERITY.Minor;

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }, []);

  const regions = alert.regions?.slice(0, 4).join(', ') || '';

  return (
    <View style={[styles.row, { backgroundColor: s.bg, borderColor: s.border }]}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: s.dot }]} />

      <View style={styles.rowBody}>
        {/* Header */}
        <TouchableOpacity style={styles.rowHeader} onPress={toggle} activeOpacity={0.75}>
          <View style={styles.rowLeft}>
            <Icon name={severityIcon(alert.severity)} size={16} color={s.icon} />
            <View style={styles.rowTitleBlock}>
              <View style={styles.rowTitleRow}>
                <Text style={[styles.severityLabel, { color: s.icon }]}>{s.label}</Text>
                {!!regions && (
                  <Text style={styles.regionLabel} numberOfLines={1}>{regions}</Text>
                )}
              </View>
              <Text style={styles.alertTitle} numberOfLines={expanded ? 0 : 2}>
                {alert.event || alert.title}
              </Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.ageLabel}>{formatAge(alert.pubDate)}</Text>
            <Icon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={dc.textMuted}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded detail */}
        {expanded && (
          <View style={styles.expandedBody}>
            {!!alert.description && (
              <Text style={styles.descText}>{alert.description}</Text>
            )}
            {!!alert.instruction && (
              <View style={styles.instructionRow}>
                <Icon name="shield-checkmark-outline" size={13} color={s.icon} />
                <Text style={[styles.instructionText, { color: s.icon }]}>
                  {alert.instruction}
                </Text>
              </View>
            )}
            {!!alert.expires && (
              <Text style={styles.expiryText}>
                Valid until {new Date(alert.expires).toLocaleString('en-PK', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Dismiss */}
      <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} hitSlop={10}>
        <Icon name="close" size={14} color={dc.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AlertBanner({ alerts = [] }) {
  const [dismissed, setDismissed] = useState(new Set());

  const dismiss = useCallback((id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;

  // Show top 3 alerts max to avoid overwhelming the screen
  const shown = visible.slice(0, 3);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Icon name="alert-circle-outline" size={13} color={dc.textMuted} />
        <Text style={styles.sectionLabel}>PAKISTAN WEATHER ALERTS</Text>
        {visible.length > 3 && (
          <Text style={styles.moreLabel}>+{visible.length - 3} more</Text>
        )}
      </View>
      {shown.map((alert) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          onDismiss={() => dismiss(alert.id)}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: dc.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    flex: 1,
  },
  moreLabel: {
    fontSize: 11,
    color: dc.textMuted,
    fontWeight: '600',
  },

  // Alert row
  row: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  rowBody: {
    flex: 1,
    paddingVertical: 11,
    paddingLeft: 10,
    paddingRight: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  rowTitleBlock: {
    flex: 1,
    gap: 3,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  regionLabel: {
    fontSize: 10,
    color: dc.textMuted,
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: dc.textPrimary,
    lineHeight: 18,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  ageLabel: {
    fontSize: 10,
    color: dc.textMuted,
  },

  // Expanded
  expandedBody: {
    marginTop: 10,
    gap: 8,
    paddingRight: 8,
  },
  descText: {
    fontSize: 12,
    color: dc.textSecondary,
    lineHeight: 18,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  instructionText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  expiryText: {
    fontSize: 11,
    color: dc.textMuted,
    fontStyle: 'italic',
  },

  // Dismiss
  dismissBtn: {
    paddingHorizontal: 10,
    paddingTop: 11,
    alignSelf: 'flex-start',
  },
});
