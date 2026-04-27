/**
 * FABMenu — floating action button with quarter-circle spring fan.
 *
 * Fan arc: -180° (straight left) → -90° (straight up), up to 6 actions.
 * Supports premium-gated actions and rate-limited refresh (5×/hr for premium).
 */

import React, { useState, useEffect, useRef } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as dc } from '../design';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

// ─── Layout constants ─────────────────────────────────────────────────────────
const BTN  = 60;   // main FAB diameter
const ITEM = 48;   // satellite item diameter
const R    = 118;  // orbit radius

// ─── Rate limiting ────────────────────────────────────────────────────────────
const REFRESH_RATE_KEY = 'outdooradvisor_fab_refresh_log';
const MAX_REFRESHES    = 5;
const RATE_WINDOW_MS   = 60 * 60 * 1000; // 1 hour

async function checkRefreshRate() {
  try {
    const raw    = await AsyncStorage.getItem(REFRESH_RATE_KEY);
    const log    = raw ? JSON.parse(raw) : [];
    const now    = Date.now();
    const recent = log.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= MAX_REFRESHES) {
      const minsLeft = Math.ceil((RATE_WINDOW_MS - (now - recent[0])) / 60000);
      return { allowed: false, minsLeft };
    }
    await AsyncStorage.setItem(REFRESH_RATE_KEY, JSON.stringify([...recent, now]));
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open
  }
}

// ─── Action definitions ───────────────────────────────────────────────────────
const ACTION_CONFIG = {
  refresh: {
    icon: 'refresh-outline',
    bg: 'rgba(143,240,183,0.22)', stroke: 'rgba(143,240,183,0.40)', fg: dc.accentGreen,
    premium: true,
  },
  'ai-brief': {
    icon: 'sparkles-outline',
    bg: 'rgba(155,200,255,0.22)', stroke: 'rgba(155,200,255,0.40)', fg: dc.accentCyan,
    premium: true,
  },
  location: {
    icon: 'location-outline',
    bg: 'rgba(155,200,255,0.22)', stroke: 'rgba(155,200,255,0.40)', fg: dc.accentCyan,
  },
  activities: {
    icon: 'fitness-outline',
    bg: 'rgba(143,240,183,0.22)', stroke: 'rgba(143,240,183,0.40)', fg: dc.accentGreen,
  },
  travel: {
    icon: 'navigate-outline',
    bg: 'rgba(255,175,102,0.22)', stroke: 'rgba(255,175,102,0.40)', fg: dc.accentOrange,
  },
  share: {
    icon: 'share-outline',
    bg: 'rgba(127,178,255,0.22)', stroke: 'rgba(127,178,255,0.40)', fg: dc.accentBlue,
  },
};

// ─── Dynamic arc angles ───────────────────────────────────────────────────────
function buildAngles(count) {
  if (count <= 0) return [];
  if (count === 1) return [-135];
  return Array.from({ length: count }, (_, i) => -180 + i * (90 / (count - 1)));
}

// ─── Satellite item ───────────────────────────────────────────────────────────
function FABItem({ action, index, totalCount, open, onPress }) {
  const progress  = useSharedValue(0);
  const angles    = buildAngles(totalCount);
  const angleDeg  = angles[index] ?? -135;
  const rad       = angleDeg * (Math.PI / 180);
  const cx        = Math.cos(rad) * R;
  const cy        = Math.sin(rad) * R;

  useEffect(() => {
    if (open) {
      progress.value = withDelay(
        index * 50,
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
      left:    BTN / 2 + cx - ITEM / 2,
      top:     BTN / 2 + cy - ITEM / 2,
      transform: [{ scale: s }],
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
        <Icon name={action.icon} size={20} color={action.fg} />
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
    transform: [{ rotate: `${interpolate(rot.value, [0, 1], [0, 135])}deg` }],
  }));

  return (
    <Pressable style={styles.mainBtn} onPress={onPress} hitSlop={6}>
      <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.mainOverlay}    pointerEvents="none" />
      <View style={styles.mainHighlight}  pointerEvents="none" />
      <View style={styles.mainBorder}     pointerEvents="none" />
      <Animated.Text style={[styles.mainIcon, rotStyle]}>+</Animated.Text>
    </Pressable>
  );
}

// ─── Toast overlay ────────────────────────────────────────────────────────────
// Always mounted so the fade-out animation can play before content disappears.
function FABToast({ message }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(message ? 1 : 0, { duration: message ? 160 : 220 });
  }, [message]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.toast, animStyle]} pointerEvents="none">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={styles.toastText}>{message || ' '}</Text>
    </Animated.View>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function FABMenu({ currentRouteName = 'Home' }) {
  const [open, setOpen]       = useState(false);
  const [toast, setToast]     = useState('');
  const toastTimerRef         = useRef(null);
  const insets                = useSafeAreaInsets();
  const navigation            = useNavigation();
  const { isPremium }         = useAuth();
  const { fabActions }        = useSettings();

  const shouldShowFab = ['Home', 'Travel', 'Activities'].includes(currentRouteName);

  // Build the active action list: filter by user's chosen actions, gate premium
  const activeActions = (fabActions || [])
    .filter((id) => {
      const cfg = ACTION_CONFIG[id];
      if (!cfg) return false;
      if (cfg.premium && !isPremium) return false;
      return true;
    })
    .map((id) => ({ id, ...ACTION_CONFIG[id] }));

  // Backdrop
  const backdropOpacity = useSharedValue(0);
  useEffect(() => {
    backdropOpacity.value = withTiming(open ? 1 : 0, { duration: 220 });
  }, [open]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  useEffect(() => {
    if (!shouldShowFab && open) setOpen(false);
  }, [shouldShowFab, open]);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 4000);
  };

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);

  const handleAction = async (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();

    switch (id) {
      case 'refresh': {
        const { allowed, minsLeft } = await checkRefreshRate();
        if (!allowed) {
          showToast(`Refresh limit reached. Try again in ~${minsLeft} min.`);
          return;
        }
        navigation.navigate('Home', { fabTrigger: `refresh-${Date.now()}` });
        break;
      }
      case 'ai-brief': {
        navigation.navigate('Home', { fabTrigger: `ai-brief-${Date.now()}` });
        break;
      }
      case 'location': {
        navigation.navigate('Home', { fabTrigger: `location-${Date.now()}` });
        break;
      }
      case 'activities':
        navigation.navigate('Activities');
        break;
      case 'travel':
        navigation.navigate('Travel');
        break;
      case 'share':
        Share.share({
          message: '🌤️ I use OutdoorAdvisor to check the air, weather, and road conditions before heading out. Check it out!',
          title: 'OutdoorAdvisor',
        });
        break;
    }
  };

  const fabBottom = insets.bottom + 126;

  if (!shouldShowFab) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* FAB zone */}
      <View style={[styles.fabZone, { bottom: fabBottom, right: 24 }]} pointerEvents="box-none">
        {/* Toast */}
        <FABToast message={toast} />

        {/* Satellite items */}
        {activeActions.map((action, i) => (
          <FABItem
            key={action.id}
            action={action}
            index={i}
            totalCount={activeActions.length}
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
    backgroundColor: 'transparent',
  },

  fabZone: {
    position: 'absolute',
    width:  BTN,
    height: BTN,
  },

  // ── Toast ────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    right: BTN + 10,
    top: BTN / 2 - 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,40,55,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: 220,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '600',
    color: dc.textSecondary,
    lineHeight: 17,
  },

  // ── Satellite items ──────────────────────────────────────────────────────
  itemWrap: {
    position: 'absolute',
    width:  ITEM,
    height: ITEM,
  },
  item: {
    width:  ITEM,
    height: ITEM,
    borderRadius: ITEM / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },

  // ── Main button ──────────────────────────────────────────────────────────
  mainBtn: {
    position: 'absolute',
    top: 0, left: 0,
    width:  BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(155,200,255,0.95)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 14,
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
