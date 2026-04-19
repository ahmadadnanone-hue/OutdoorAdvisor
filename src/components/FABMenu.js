/**
 * FABMenu — floating action button with quarter-circle spring fan.
 *
 * Fan arc: -180° (straight left) → -90° (straight up), 5 actions.
 * Each satellite springs out with 55ms stagger via react-native-reanimated.
 *
 * Usage in App.js (inside NavigationContainer):
 *   <FABMenuWrapper />
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors as dc } from '../design';

// ─── Layout constants ────────────────────────────────────────────────────────
const BTN   = 60;   // main FAB diameter
const ITEM  = 48;   // satellite item diameter
const R     = 92;   // orbit radius

// Quarter-circle arc: -180° (left) → -90° (up), 5 steps
const ANGLES_DEG = [-180, -157.5, -135, -112.5, -90];

// ─── Actions ─────────────────────────────────────────────────────────────────
const ACTIONS = [
  {
    id: 'refresh',
    icon: '↺',
    label: 'Refresh',
    bg: 'rgba(143,240,183,0.22)',
    stroke: 'rgba(143,240,183,0.40)',
    fg: dc.accentGreen,
  },
  {
    id: 'location',
    icon: '📍',
    label: 'Location',
    bg: 'rgba(155,200,255,0.22)',
    stroke: 'rgba(155,200,255,0.40)',
    fg: dc.accentCyan,
  },
  {
    id: 'share',
    icon: '↑',
    label: 'Share',
    bg: 'rgba(127,178,255,0.22)',
    stroke: 'rgba(127,178,255,0.40)',
    fg: dc.accentBlue,
  },
  {
    id: 'travel',
    icon: '🛣️',
    label: 'Travel',
    bg: 'rgba(255,175,102,0.22)',
    stroke: 'rgba(255,175,102,0.40)',
    fg: dc.accentOrange,
  },
  {
    id: 'alerts',
    icon: '🔔',
    label: 'Alerts',
    bg: 'rgba(255,216,116,0.22)',
    stroke: 'rgba(255,216,116,0.40)',
    fg: dc.accentYellow,
  },
];

// ─── Satellite item ───────────────────────────────────────────────────────────
function FABItem({ action, index, open, onPress }) {
  const progress = useSharedValue(0);
  const angleDeg = ANGLES_DEG[index];
  const rad = angleDeg * (Math.PI / 180);

  // item center offset from button center (screen coords: y up = positive)
  const cx = Math.cos(rad) * R;
  const cy = -Math.sin(rad) * R; // flip: negative sin = upward on screen

  useEffect(() => {
    if (open) {
      progress.value = withDelay(
        index * 55,
        withSpring(1, { damping: 10, stiffness: 140, mass: 0.7 }),
      );
    } else {
      progress.value = withSpring(0, { damping: 28, stiffness: 420, mass: 0.6 });
    }
  }, [open]);

  const animStyle = useAnimatedStyle(() => {
    const s = progress.value;
    return {
      opacity: interpolate(s, [0, 0.4, 1], [0, 0.8, 1]),
      transform: [{ scale: s }],
      // Position relative to the fabZone's top-left corner
      // fabZone origin = button top-left; button center = (BTN/2, BTN/2)
      left: BTN / 2 + cx - ITEM / 2,
      top:  BTN / 2 + cy - ITEM / 2,
    };
  });

  return (
    <Animated.View style={[styles.itemWrap, animStyle]}>
      <Pressable
        style={[styles.item, { backgroundColor: action.bg, borderColor: action.stroke }]}
        onPress={() => onPress(action.id)}
        hitSlop={10}
      >
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={[styles.itemIcon, { color: action.fg }]}>{action.icon}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main FAB button ──────────────────────────────────────────────────────────
function FABMain({ open, onPress }) {
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = withSpring(open ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [open]);

  const rotStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(rot.value, [0, 1], [0, 135])}deg` },
    ],
  }));

  return (
    <Pressable
      style={styles.mainBtn}
      onPress={onPress}
      hitSlop={6}
    >
      <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFill} />
      {/* glass overlay */}
      <View style={styles.mainOverlay} pointerEvents="none" />
      {/* top highlight */}
      <View style={styles.mainHighlight} pointerEvents="none" />
      {/* border */}
      <View style={styles.mainBorder} pointerEvents="none" />
      {/* + icon */}
      <Animated.Text style={[styles.mainIcon, rotStyle]}>+</Animated.Text>
    </Pressable>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function FABMenu({ onRefresh }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Backdrop fade
  const backdropOpacity = useSharedValue(0);
  useEffect(() => {
    backdropOpacity.value = withTiming(open ? 1 : 0, { duration: 220 });
  }, [open]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);

  const handleAction = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
    switch (id) {
      case 'refresh':
        onRefresh?.();
        break;
      case 'location':
        navigation.navigate('Home'); // HomeScreen handles city picker
        break;
      case 'share':
        Share.share({
          message: '🌤️ Checked the weather on OutdoorAdvisor — looks good for outdoor activity!',
          title: 'OutdoorAdvisor',
        });
        break;
      case 'travel':
        navigation.navigate('Travel');
        break;
      case 'alerts':
        navigation.navigate('Settings');
        break;
    }
  };

  // FAB zone sits above the tab bar
  // Tab bar: ~68px content + paddingBottom (insets.bottom) + marginBottom 16 ≈ 84+insets
  const fabBottom = insets.bottom + 96;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* FAB zone: 0-size anchor at button top-left, items overflow out */}
      <View
        style={[styles.fabZone, { bottom: fabBottom, right: 24 }]}
        pointerEvents="box-none"
      >
        {/* Satellite items */}
        {ACTIONS.map((action, i) => (
          <FABItem
            key={action.id}
            action={action}
            index={i}
            open={open}
            onPress={handleAction}
          />
        ))}

        {/* Main button */}
        <FABMain open={open} onPress={toggle} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  // 60×60 anchor positioned bottom-right; items use absolute coords relative to it
  fabZone: {
    position: 'absolute',
    width: BTN,
    height: BTN,
  },

  // ── Satellite items ──────────────────────────────────────────────────────
  itemWrap: {
    position: 'absolute',
    width: ITEM,
    height: ITEM,
  },
  item: {
    width: ITEM,
    height: ITEM,
    borderRadius: ITEM / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
  itemIcon: {
    fontSize: 18,
    fontWeight: '700',
  },

  // ── Main button ──────────────────────────────────────────────────────────
  mainBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // shadow
    shadowColor: dc.accentCyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
  },
  mainOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(155,200,255,0.18)',
    borderRadius: BTN / 2,
  },
  mainHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BTN / 2,
    borderTopWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  mainBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BTN / 2,
    borderWidth: 1,
    borderColor: 'rgba(155,200,255,0.45)',
  },
  mainIcon: {
    fontSize: 26,
    fontWeight: '300',
    color: dc.textPrimary,
    lineHeight: 30,
    marginTop: -1,
  },
});
