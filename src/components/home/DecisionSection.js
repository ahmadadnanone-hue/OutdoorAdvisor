import React from 'react';
import { View, StyleSheet } from 'react-native';
import { OutdoorDecisionCard } from '../cards';
import { decisionStatus } from './homeUtils';

export default function DecisionSection({ decision, onInsightPress }) {
  return (
    <View style={styles.section}>
      <OutdoorDecisionCard
        status={decisionStatus(decision.label)}
        title={decision.label}
        body={decision.tone}
        onPress={() => onInsightPress({ title: decision.label, body: `${decision.tone} ${decision.body}` })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
});
