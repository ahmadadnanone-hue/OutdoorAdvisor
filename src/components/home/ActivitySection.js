import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ActivityCard from '../ActivityCard';
import { colors as dc } from '../../design';

export default function ActivitySection({ topHomeActivities, aqi, weatherCurrent, hourly, onSeeAll, onActivityPress }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionTitle}>Activity Advisory</Text>
          <Text style={styles.hint}>Sorted by current score, weather, and time of day.</Text>
        </View>
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.75}>
          <Text style={styles.link}>See all</Text>
        </TouchableOpacity>
      </View>
      {topHomeActivities.length > 0 && (
        <View style={styles.grid}>
          {topHomeActivities.map(({ id, activity }, index) => (
            <View key={id} style={styles.item}>
              <ActivityCard
                activity={activity}
                aqi={aqi}
                weather={weatherCurrent}
                hourly={hourly}
                onPress={() => onActivityPress(id)}
                compact
                rankLabel={`#${index + 1}`}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: dc.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  hint: { fontSize: 12, color: dc.textMuted, marginTop: 2 },
  link: { fontSize: 13, fontWeight: '700', color: dc.accentCyan },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { width: '47%' },
});
