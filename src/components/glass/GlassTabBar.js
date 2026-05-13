import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, radius as radiusTokens, shadows } from '../../design';

/**
 * GlassTabBar — floating Tide Guide-style bar with stronger pill feedback.
 */
export default function GlassTabBar({
  items = [],
  activeKey,
  onChange,
  floating = true,
  style,
}) {
  // Positioning (bottom gap, horizontal inset) is owned by the App.js tab slot.
  // GlassTabBar is just a self-contained pill — its geometry must not depend
  // on any outer margin assumptions.
  return (
    <View style={[styles.wrap, floating ? styles.floating : styles.edge, style]}>
      <BlurView
        intensity={62}
        tint="dark"
        style={styles.fill}
      />
      <View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: colors.tabBarGlass }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.05)']}
        style={styles.fill}
      />
      <View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            borderWidth: 1,
            borderColor: colors.cardStroke,
            borderRadius: floating ? PILL_RADIUS : 0,
          },
        ]}
      />
      <View style={styles.row}>
        {items.map((item) => (
          <TabItem
            key={item.key}
            item={item}
            active={item.key === activeKey}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange?.(item.key);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function TabItem({ item, active, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 42,
        bounciness: 0,
      }),
      Animated.timing(highlight, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 22,
        bounciness: 7,
      }),
      Animated.timing(highlight, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View style={[styles.itemOuter, { transform: [{ scale }] }]}> 
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        style={styles.item}
      >
        {active ? (
          <>
            <View
              pointerEvents="none"
              style={[styles.activeFill, { backgroundColor: colors.tabBarActive }]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.activeFill,
                { borderWidth: 1, borderColor: colors.accentBlueGlow },
              ]}
            />
          </>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeFill,
            {
              backgroundColor: colors.pressedHighlight,
              opacity: highlight,
            },
          ]}
        />
        <View style={styles.itemContent}>
          {item.icon ? (
            <View style={styles.icon}>
              {typeof item.icon === 'string' ? (
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              ) : (
                item.icon
              )}
            </View>
          ) : null}
          <Text
            style={[
              styles.label,
              {
                color: active ? colors.accentCyan : colors.textSecondary,
                fontWeight: active ? '800' : '600',
              },
            ]}
          >
            {item.label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Pill radius — explicit numeric value avoids React Native style-merge
// surprises where `borderTopLeftRadius` / `borderTopRightRadius` from an
// underlying style would override the `borderRadius` shorthand.
const PILL_RADIUS = 30;

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    ...shadows.card,
  },
  // Floating mode: full pill on all 4 corners (no top-only radii anywhere).
  floating: {
    borderTopLeftRadius:     PILL_RADIUS,
    borderTopRightRadius:    PILL_RADIUS,
    borderBottomLeftRadius:  PILL_RADIUS,
    borderBottomRightRadius: PILL_RADIUS,
  },
  // Edge mode (unused right now but kept for completeness): top corners only.
  edge: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  fill: { ...StyleSheet.absoluteFillObject },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 6,
  },
  itemOuter: { flex: 1 },
  item: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusTokens.pill,
    overflow: 'hidden',
  },
  activeFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radiusTokens.pill,
  },
  itemContent: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: {},
  label: { fontSize: 10, letterSpacing: 0.15 },
});
