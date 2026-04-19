import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, radius as radiusTokens, shadows } from '../../design';

/**
 * GlassCard — raised glass surface with stronger outline + press feedback.
 */
export default function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 32,
  cornerRadius = radiusTokens.xl,
  strong = false,
  tintColor,
  borderColor,
  elevated = true,
  onPress,
  hapticStyle = 'selection',
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.976,
        useNativeDriver: true,
        speed: 42,
        bounciness: 0,
      }),
      Animated.timing(highlight, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 6,
      }),
      Animated.timing(highlight, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = (e) => {
    if (hapticStyle === 'selection') Haptics.selectionAsync();
    else if (hapticStyle === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (hapticStyle === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const effectiveTint = tintColor ?? (strong ? colors.cardGlassStrong : colors.cardGlass);
  const effectiveBorder = borderColor ?? colors.cardStroke;

  const body = (
    <>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.fill, { borderRadius: cornerRadius }]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.fill,
          { borderRadius: cornerRadius, backgroundColor: effectiveTint },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            borderRadius: cornerRadius,
            backgroundColor: colors.cardGlassSoft,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.topHighlight,
          { borderRadius: cornerRadius, borderColor: colors.cardHighlight },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            borderRadius: cornerRadius,
            backgroundColor: colors.pressedHighlight,
            opacity: highlight,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            borderRadius: cornerRadius,
            borderWidth: 1,
            borderColor: effectiveBorder,
          },
        ]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </>
  );

  const outerStyle = [
    styles.outer,
    { borderRadius: cornerRadius },
    elevated ? shadows.card : shadows.subtle,
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={[outerStyle, { transform: [{ scale }] }]}> 
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.pressable, { borderRadius: cornerRadius }]}
          {...rest}
        >
          {body}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={outerStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  pressable: { overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  topHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  content: {
    padding: 22,
    position: 'relative',
  },
});
