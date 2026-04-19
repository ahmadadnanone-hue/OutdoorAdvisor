import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../../design';

/**
 * LiquidGlassView — iOS 26 native Liquid Glass when available, BlurView
 * fallback everywhere else.
 *
 * expo-glass-effect exports `GlassView` / `isLiquidGlassAvailable`. We try
 * to import it dynamically so older iOS, Android, and web don't blow up.
 *
 * Props:
 *   - children
 *   - style:             outer shape (radius, size)
 *   - glassEffectStyle:  'regular' | 'clear' (expo-glass-effect only)
 *   - tintColor:         tint overlay for fallback (ignored by native glass)
 *   - fallbackIntensity: BlurView intensity when native glass unavailable
 */

let GlassView = null;
let isLiquidGlassAvailable = null;

try {
  // eslint-disable-next-line global-require
  const glassMod = require('expo-glass-effect');
  GlassView = glassMod?.GlassView || null;
  isLiquidGlassAvailable =
    typeof glassMod?.isLiquidGlassAvailable === 'function'
      ? glassMod.isLiquidGlassAvailable
      : () => false;
} catch {
  GlassView = null;
  isLiquidGlassAvailable = () => false;
}

export default function LiquidGlassView({
  children,
  style,
  glassEffectStyle = 'regular',
  tintColor,
  fallbackIntensity = 30,
}) {
  const nativeOk =
    Platform.OS === 'ios' && GlassView && isLiquidGlassAvailable?.();

  if (nativeOk) {
    return (
      <GlassView
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  // Fallback — translucent BlurView + tint
  const overlay = tintColor ?? colors.cardGlass;
  return (
    <View style={[styles.fallback, style]}>
      <BlurView
        intensity={fallbackIntensity}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: overlay }]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { overflow: 'hidden' },
  content: { position: 'relative' },
});
