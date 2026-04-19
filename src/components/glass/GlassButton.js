import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, radius as radiusTokens, shadows } from '../../design';

/**
 * GlassButton — highlighted pill with smoother press + brighter feedback.
 */
export default function GlassButton({
  label,
  icon,
  onPress,
  active = false,
  variant = 'glass',
  size = 'md',
  loading = false,
  disabled = false,
  hapticStyle = 'light',
  style,
  textStyle,
  children,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const brightness = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.965,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }),
      Animated.timing(brightness, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 8,
      }),
      Animated.timing(brightness, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = (e) => {
    if (disabled || loading) return;
    if (hapticStyle === 'selection') Haptics.selectionAsync();
    else if (hapticStyle === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (hapticStyle === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const sizing = SIZES[size] || SIZES.md;
  const r = size === 'sm' ? radiusTokens.medium : radiusTokens.pill;

  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const tintColor =
    isPrimary || active ? colors.accentCyanBg : colors.cardGlassSoft;
  const strokeColor =
    isPrimary || active ? colors.accentCyanGlow : colors.cardStroke;
  const labelColor =
    isPrimary || active
      ? colors.accentCyan
      : isGhost
        ? colors.textSecondary
        : colors.textPrimary;

  return (
    <Animated.View
      style={[
        styles.outer,
        { borderRadius: r },
        shadows.subtle,
        { transform: [{ scale }], opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[styles.pressable, { borderRadius: r }]}
      >
        {!isGhost ? (
          <BlurView
            intensity={28}
            tint="dark"
            style={[styles.fill, { borderRadius: r }]}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[styles.fill, { borderRadius: r, backgroundColor: tintColor }]}
        />
        {!isGhost ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(255,255,255,0.16)',
              'rgba(255,255,255,0.05)',
              'rgba(255,255,255,0.02)',
            ]}
            locations={[0, 0.55, 1]}
            style={[styles.fill, { borderRadius: r }]}
          />
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            {
              borderRadius: r,
              backgroundColor: colors.pressedHighlight,
              opacity: brightness,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.fill,
            {
              borderRadius: r,
              borderWidth: 1,
              borderColor: strokeColor,
            },
          ]}
        />
        <View
          style={[
            styles.content,
            { paddingVertical: sizing.py, paddingHorizontal: sizing.px },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={labelColor} />
          ) : (
            <>
              {icon ? <View style={styles.icon}>{icon}</View> : null}
              {label ? (
                <Text
                  style={[
                    styles.label,
                    {
                      color: labelColor,
                      fontSize: sizing.font,
                      fontWeight: isPrimary || active ? '800' : '700',
                    },
                    textStyle,
                  ]}
                >
                  {label}
                </Text>
              ) : null}
              {children}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const SIZES = {
  sm: { py: 8, px: 14, font: 13 },
  md: { py: 12, px: 20, font: 15 },
  lg: { py: 16, px: 26, font: 16 },
};

const styles = StyleSheet.create({
  outer: { overflow: 'visible', alignSelf: 'flex-start' },
  pressable: { overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: { marginRight: 2 },
  label: { letterSpacing: 0.2 },
});
