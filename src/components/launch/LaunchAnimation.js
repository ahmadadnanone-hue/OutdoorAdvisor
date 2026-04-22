import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors as dc, gradient } from '../../design/colors';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const ICON_SOURCE = require('../../../assets/icon.png');

export default function LaunchAnimation({ onComplete }) {
  const bgIcon = useSharedValue(0);
  const logo   = useSharedValue(0);
  const word   = useSharedValue(0);
  const exit   = useSharedValue(0);

  useEffect(() => {
    const liquidEase = Easing.bezier(0.2, 0.9, 0.22, 1);
    const settleEase = Easing.bezier(0.16, 1, 0.3, 1);
    const fadeEase   = Easing.bezier(0.4, 0, 0.2, 1);

    bgIcon.value = withTiming(1, { duration: 1600, easing: liquidEase });

    const logoTimer = setTimeout(() => {
      logo.value = withTiming(1, { duration: 1300, easing: settleEase });
    }, 100);

    const wordTimer = setTimeout(() => {
      word.value = withTiming(1, { duration: 1400, easing: settleEase });
    }, 480);

    const exitTimer = setTimeout(() => {
      exit.value = withTiming(1, { duration: 640, easing: fadeEase });
    }, 2850);

    const doneTimer = setTimeout(() => {
      onComplete?.();
    }, 3500);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(wordTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [bgIcon, exit, logo, onComplete, word]);

  // Whole screen fades out on exit
  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  // Large faint background icon
  const bgIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgIcon.value, [0, 1], [0.01, 0.10], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(bgIcon.value, [0, 1], [1.38, 1.12], Extrapolation.CLAMP) },
      { translateY: interpolate(bgIcon.value, [0, 1], [34, -10], Extrapolation.CLAMP) },
    ],
  }));

  // App icon — floats up from slightly below center
  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logo.value, [0, 0.18, 1], [0, 0.9, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(logo.value, [0, 1], [0.72, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(logo.value, [0, 1], [24, 0], Extrapolation.CLAMP) },
    ],
  }));

  // Text reveal — expands width + fades in
  const wordWrapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(word.value, [0, 0.18, 1], [0, 0.85, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(word.value, [0, 1], [14, 0], Extrapolation.CLAMP) },
    ],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    letterSpacing: interpolate(word.value, [0, 1], [14, 5.5], Extrapolation.CLAMP),
  }));

  const subStyle = useAnimatedStyle(() => ({
    letterSpacing: interpolate(word.value, [0, 1], [10, 3.2], Extrapolation.CLAMP),
    opacity: interpolate(word.value, [0, 0.35, 1], [0, 0.5, 0.7], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, containerStyle]}>
      {/* Background gradient */}
      <LinearGradient
        colors={gradient.screen}
        start={gradient.screenStart}
        end={gradient.screenEnd}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.scrim} />

      {/* Large faint background icon — decorative */}
      <AnimatedImage
        source={ICON_SOURCE}
        style={[styles.bgIcon, bgIconStyle]}
        resizeMode="contain"
      />

      {/* Soft atmospheric orbs */}
      <View style={styles.orbA} />
      <View style={styles.orbB} />

      {/* Center stack: icon + text */}
      <View style={styles.centerWrap}>
        {/* App icon — no circle, just the icon */}
        <AnimatedImage
          source={ICON_SOURCE}
          style={[styles.logo, logoStyle]}
          resizeMode="contain"
        />

        {/* Glass-style text */}
        <Animated.View style={[styles.textBlock, wordWrapStyle]}>
          {/* Primary wordmark */}
          <Animated.Text style={[styles.wordPrimary, wordStyle]}>
            OUTDOOR
          </Animated.Text>
          {/* Secondary line with glow accent */}
          <View style={styles.advisorRow}>
            <View style={styles.advisorLine} />
            <Animated.Text style={[styles.wordSecondary, subStyle]}>
              ADVISOR
            </Animated.Text>
            <View style={styles.advisorLine} />
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 40,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,12,20,0.22)',
  },
  bgIcon: {
    position: 'absolute',
    left: '50%',
    top: '40%',
    width: 500,
    height: 500,
    marginLeft: -250,
    marginTop: -250,
  },
  orbA: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    left: '50%',
    top: '48%',
    marginLeft: -180,
    marginTop: -180,
    backgroundColor: dc.blobCyan,
    opacity: 0.07,
  },
  orbB: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    left: '50%',
    top: '52%',
    marginLeft: -10,
    marginTop: -130,
    backgroundColor: dc.blobTeal,
    opacity: 0.07,
  },

  // ── Center stack ───────────────────────────────────────────────────────────
  centerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,         // match the app icon's rounded corners
    marginBottom: 28,
  },

  // ── Text block ─────────────────────────────────────────────────────────────
  textBlock: {
    alignItems: 'center',
    gap: 6,
  },
  wordPrimary: {
    color: dc.textPrimary,
    fontSize: 22,
    fontWeight: '200',        // ultra-thin — glass aesthetic
    textAlign: 'center',
    textShadowColor: 'rgba(155,200,255,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  advisorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  advisorLine: {
    height: 0.5,
    width: 24,
    backgroundColor: 'rgba(155,200,255,0.35)',
  },
  wordSecondary: {
    color: dc.accentCyan,
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    textShadowColor: 'rgba(155,200,255,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
});
