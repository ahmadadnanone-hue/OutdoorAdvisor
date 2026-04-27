import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors as dc } from '../../design';
import Icon from '../Icon';

const TRIP_ACTIONS = [
  { id: 'MURREE', eyebrow: 'Trip Planning', title: 'Planning Murree trip?', body: 'Check road, weather, and route alerts before you leave.', icon: 'triangle-outline' },
  { id: 'M2', eyebrow: 'Drive Status', title: 'Lahore to Islamabad', body: 'See M2 conditions, NHMP advisories, and stop-by-stop weather.', icon: 'car-outline' },
];

export default function TravelSection({ onNavigateTravel }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Travel Quick Checks</Text>
        <TouchableOpacity onPress={() => onNavigateTravel()} activeOpacity={0.75}>
          <Text style={styles.link}>Open travel</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {TRIP_ACTIONS.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            style={styles.card}
            onPress={() => onNavigateTravel(item.id)}
          >
            <View style={styles.graphic}>
              <Icon name={item.icon} size={22} color={dc.accentCyan} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.eyebrow}>{item.eyebrow}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
            <View style={styles.arrowWrap}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: dc.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  link: { fontSize: 13, fontWeight: '700', color: dc.accentCyan },
  grid: { gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: dc.cardGlass, borderRadius: 20, borderWidth: 1, borderColor: dc.cardStrokeSoft,
  },
  graphic: { width: 44, height: 44, borderRadius: 14, backgroundColor: dc.accentCyanBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardText: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: dc.accentCyan, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 14, fontWeight: '700', color: dc.textPrimary },
  body: { fontSize: 12, color: dc.textSecondary, lineHeight: 17 },
  arrowWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: dc.accentCyanBg, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  arrow: { fontSize: 14, color: dc.accentCyan, fontWeight: '700' },
});
