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
const AnimatedText = Animated.createAnimatedComponent(Text);
const ICON_SOURCE = require('../../../assets/icon.png');

export default function LaunchAnimation({ onComplete }) {
  const bgIcon = useSharedValue(0);
  const plate = useSharedValue(0);
  const logo = useSharedValue(0);
  const word = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    const liquidEase = Easing.bezier(0.2, 0.9, 0.22, 1);
    const settleEase = Easing.bezier(0.16, 1, 0.3, 1);
    const fadeEase = Easing.bezier(0.4, 0, 0.2, 1);

    bgIcon.value = withTiming(1, { duration: 1600, easing: liquidEase });
    plate.value = withTiming(1, { duration: 1450, easing: settleEase });

    const logoTimer = setTimeout(() => {
      logo.value = withTiming(1, { duration: 1300, easing: settleEase });
    }, 180);

    const wordTimer = setTimeout(() => {
      word.value = withTiming(1, { duration: 1380, easing: settleEase });
    }, 520);

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
  }, [bgIcon, exit, logo, onComplete, plate, word]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const bgIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgIcon.value, [0, 1], [0.01, 0.11], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(bgIcon.value, [0, 1], [1.38, 1.14], Extrapolation.CLAMP) },
      { translateY: interpolate(bgIcon.value, [0, 1], [34, -10], Extrapolation.CLAMP) },
    ],
  }));

  const plateStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plate.value, [0, 0.2, 1], [0, 0.54, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(plate.value, [0, 1], [0.82, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(plate.value, [0, 1], [26, 0], Extrapolation.CLAMP) },
    ],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logo.value, [0, 0.16, 1], [0, 0.84, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(logo.value, [0, 1], [0.68, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(logo.value, [0, 1], [16, 0], Extrapolation.CLAMP) },
    ],
  }));

  const wordWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(word.value, [0, 1], [30, 264], Extrapolation.CLAMP),
    opacity: interpolate(word.value, [0, 0.12, 1], [0, 0.82, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(word.value, [0, 1], [18, 0], Extrapolation.CLAMP) },
    ],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: interpolate(word.value, [0, 0.14, 1], [0, 0.88, 1], Extrapolation.CLAMP),
    letterSpacing: interpolate(word.value, [0, 1], [8.5, 2.6], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, containerStyle]}>
      <LinearGradient
        colors={gradient.screen}
        start={gradient.screenStart}
        end={gradient.screenEnd}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.scrim} />
      <AnimatedImage source={ICON_SOURCE} style={[styles.bgIcon, bgIconStyle]} resizeMode="contain" />
      <View style={styles.orbA} />
      <View style={styles.orbB} />
      <View style={styles.centerWrap}>
        <Animated.View style={[styles.plateShell, plateStyle]}>
          <View style={styles.glassAura} />
          <View style={styles.glassAuraSmall} />
          <AnimatedImage source={ICON_SOURCE} style={[styles.logo, logoStyle]} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[styles.wordWrap, wordWrapStyle]}>
          <AnimatedText style={[styles.word, wordStyle]}>OUTDOORADVISOR</AnimatedText>
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
    backgroundColor: 'rgba(8, 12, 20, 0.24)',
  },
  bgIcon: {
    position: 'absolute',
    left: '50%',
    top: '42%',
    width: 470,
    height: 470,
    marginLeft: -235,
    marginTop: -235,
  },
  orbA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
    left: '50%',
    top: '51%',
    marginLeft: -170,
    marginTop: -180,
    backgroundColor: dc.blobCyan,
    opacity: 0.08,
  },
  orbB: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 999,
    left: '50%',
    top: '54%',
    marginLeft: -20,
    marginTop: -130,
    backgroundColor: dc.blobTeal,
    opacity: 0.08,
  },
  centerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '55%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateShell: {
    width: 170,
    height: 170,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassAura: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#9BC8FF',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  glassAuraSmall: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  logo: {
    width: 130,
    height: 130,
  },
  wordWrap: {
    marginTop: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    color: dc.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
