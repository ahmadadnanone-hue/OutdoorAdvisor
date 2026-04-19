import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors as dc } from '../../design';

export default function PollenSection({ pollenValue, pollenDisplayName, pollenCategory, pollenColor, onInsightPress }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Pollen Level</Text>
      <TouchableOpacity activeOpacity={0.85} style={styles.banner} onPress={onInsightPress}>
        <View style={styles.bannerLeft}>
          <View style={[styles.badge, { backgroundColor: pollenColor + '20' }]}>
            <Text style={[styles.badgeText, { color: pollenColor }]}>Allergy watch</Text>
          </View>
          <Text style={styles.bannerTitle}>{pollenDisplayName}</Text>
          <Text style={styles.bannerBody}>
            {pollenValue != null
              ? `${pollenCategory} right now. Tap for the full pollen read and top contributing types.`
              : 'Pollen data is not available for this location right now.'}
          </Text>
        </View>
        <View style={styles.bannerRight}>
          <Text style={[styles.bannerValue, { color: pollenColor }]}>{pollenValue ?? '--'}</Text>
          <Text style={styles.bannerLabel}>{pollenCategory}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: dc.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  banner: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    backgroundColor: dc.cardGlass, borderRadius: 22, borderWidth: 1, borderColor: dc.cardStrokeSoft,
  },
  bannerLeft: { flex: 1, gap: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: dc.textPrimary },
  bannerBody: { fontSize: 13, color: dc.textSecondary, lineHeight: 19 },
  bannerRight: { alignItems: 'center', paddingLeft: 16 },
  bannerValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  bannerLabel: { fontSize: 11, fontWeight: '600', color: dc.textMuted, marginTop: 2 },
});
