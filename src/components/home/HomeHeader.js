import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { GlassPill } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors as dc } from '../../design';

export default function HomeHeader({ greeting, greetingName, locationLabel, isPremium, onLocationPress, onSettingsPress, onRefresh }) {
  return (
    <View style={styles.headerBar}>
      <View style={styles.headerIdentity}>
        <Text style={styles.greeting}>{greeting}</Text>
        {!!greetingName && <Text style={styles.greetingName}>{greetingName}</Text>}
      </View>
      <View style={styles.headerControlsRow}>
        <View style={styles.headerPills}>
          {isPremium && (
            <GlassPill label="Premium" compact active hapticStyle={null} style={styles.premiumPill} contentStyle={styles.pillContent} />
          )}
          {Platform.OS === 'web' && (
            <GlassPill label="Refresh" compact onPress={onRefresh} leadingIcon={<Icon name={ICON.refresh} size={13} color={dc.accentCyan} />} />
          )}
          <GlassPill
            label={locationLabel}
            compact
            onPress={onLocationPress}
            leadingIcon={<Icon name={ICON.locationPin} size={11} color={dc.accentCyan} />}
            trailingIcon={<Icon name={ICON.chevronDown} size={11} color={dc.textMuted} />}
            style={styles.locationPill}
            contentStyle={styles.pillContent}
          />
          <GlassPill
            leadingIcon={<Icon name={ICON.settings} size={18} color={dc.textPrimary} />}
            onPress={onSettingsPress}
            hapticStyle="light"
            style={styles.settingsPill}
            contentStyle={styles.settingsPillContent}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: { alignItems: 'flex-start', marginBottom: 10, paddingTop: 12 },
  headerIdentity: { width: '100%', marginBottom: 12 },
  greeting: { fontSize: 13, fontWeight: '700', color: dc.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
  greetingName: { fontSize: 28, fontWeight: '800', color: dc.textPrimary, letterSpacing: -0.5, marginTop: 2 },
  headerControlsRow: { width: '100%', alignItems: 'center' },
  headerPills: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, maxWidth: 344, width: '100%' },
  premiumPill: { minWidth: 142 },
  locationPill: { flex: 1, minWidth: 0 },
  settingsPill: { width: 48, minWidth: 48, borderRadius: 24 },
  pillContent: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center' },
  settingsPillContent: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
});
