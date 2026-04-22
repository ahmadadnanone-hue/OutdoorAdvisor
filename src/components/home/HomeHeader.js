import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassPill } from '../glass';
import Icon, { ICON } from '../Icon';
import { colors as dc } from '../../design';

export default function HomeHeader({
  greeting,
  greetingName,
  isPremium,
  locationLabel,
  onLocationPress,
  onRefresh,
  onNotificationsPress,
  unreadNotificationCount = 0,
}) {
  return (
    <View style={styles.headerBar}>

      {/* Top row: greeting left  ·  bell top-right */}
      <View style={styles.topRow}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting}</Text>
          {!!greetingName && <Text style={styles.greetingName}>{greetingName}</Text>}
          {isPremium ? (
            <Text style={styles.planBadgePremium}>PREMIUM</Text>
          ) : (
            <Text style={styles.planBadgeFree}>FREE</Text>
          )}
        </View>

        <View style={styles.bellWrap}>
          <TouchableOpacity
            onPress={onNotificationsPress}
            style={styles.bellBtn}
            activeOpacity={0.75}
          >
            <Icon name="notifications-outline" size={20} color={dc.textPrimary} />
          </TouchableOpacity>
          {unreadNotificationCount > 0 && (
            <View style={styles.unreadDot} />
          )}
        </View>
      </View>

      {/* Bottom row: location pill */}
      <View style={styles.pillsRow}>
        <GlassPill
          label={locationLabel}
          compact
          onPress={onLocationPress}
          leadingIcon={<Icon name={ICON.locationPin} size={11} color={dc.accentCyan} />}
          trailingIcon={<Icon name={ICON.chevronDown} size={11} color={dc.textMuted} />}
          style={styles.locationPill}
          contentStyle={styles.pillContent}
        />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    marginBottom: 10,
    paddingTop: 12,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  greetingBlock: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '700',
    color: dc.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '600',
    color: dc.textPrimary,
    letterSpacing: -0.15,
    marginTop: 1,
  },
  planBadgePremium: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 4,
    color: '#FCD34D',
    textShadowColor: 'rgba(251,191,36,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  planBadgeFree: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 4,
    color: dc.textMuted,
  },

  // Bell button top-right
  bellWrap: {
    position: 'relative',
    marginTop: 2,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF4D5F',
    borderWidth: 1.5,
    borderColor: 'rgba(21,29,46,0.9)',
  },

  // Location pill row
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationPill: {
    flex: 1,
    minWidth: 0,
  },
  pillContent: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
});
