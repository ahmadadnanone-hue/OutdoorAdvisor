import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '../glass';
import { OutdoorDecisionCard } from '../cards';
import { colors as dc } from '../../design';
import { decisionStatus } from './homeUtils';

export default function DecisionSection({ decision, isPremium, homeAiBriefing, homeAiLoading, onInsightPress, onAiPress }) {
  return (
    <View style={styles.section}>
      <OutdoorDecisionCard
        status={decisionStatus(decision.label)}
        title={decision.label}
        body={decision.tone}
        onPress={() => onInsightPress({ title: decision.label, body: `${decision.tone} ${decision.body}` })}
      />
      <GlassCard
        style={styles.aiCard}
        contentStyle={styles.aiContent}
        onPress={homeAiBriefing && isPremium ? onAiPress : undefined}
        hapticStyle={homeAiBriefing && isPremium ? 'light' : null}
      >
        <Text style={styles.aiEyebrow}>What today means</Text>
        <Text style={styles.aiTitle}>
          {!isPremium
            ? "Premium unlock: AI daily briefings with a sharper read of today's conditions."
            : homeAiLoading && !homeAiBriefing
            ? "Writing a quick read of today's conditions…"
            : homeAiBriefing?.headline || "Today's conditions summary will appear here."}
        </Text>
        {homeAiBriefing && isPremium && (
          <View style={styles.moreChip}>
            <Text style={styles.moreChipText}>More info</Text>
          </View>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  aiCard: { marginTop: 4 },
  aiContent: { padding: 18 },
  aiEyebrow: { fontSize: 11, fontWeight: '800', color: dc.textMuted, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 },
  aiTitle: { fontSize: 15, fontWeight: '600', color: dc.textPrimary, lineHeight: 22 },
  moreChip: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: dc.accentCyanBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  moreChipText: { fontSize: 12, fontWeight: '700', color: dc.accentCyan },
});
