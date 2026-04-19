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
import * as Haptics from 'expo-haptics';
import { colors, radius as radiusTokens, shadows } from '../../design';

/**
 * GlassPill — compact clickable pill with stronger highlighted tap state.
 */
export default function GlassPill({
  label,
  leadingIcon,
  trailingIcon,
  onPress,
  active = false,
  compact = false,
  hapticStyle = 'selection',
  style,
  textStyle,
  contentStyle,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const brightness = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.965,
        useNativeDriver: true,
        speed: 42,
        bounciness: 0,
      }),
      Animated.timing(brightness, {
        toValue: 1,
        duration: 90,
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
        speed: 22,
        bounciness: 8,
      }),
      Animated.timing(brightness, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const handlePress = (e) => {
    if (hapticStyle === 'selection') Haptics.selectionAsync();
    else if (hapticStyle === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const labelColor = active ? colors.accentCyan : colors.textPrimary;
  const strokeColor = active ? colors.accentCyanGlow : colors.cardStroke;
  const tintColor = active ? colors.accentCyanBg : colors.cardGlassSoft;

  const pad = compact
    ? { paddingVertical: 6, paddingHorizontal: 12 }
    : { paddingVertical: 10, paddingHorizontal: 16 };

  const Wrapper = onPress ? Pressable : View;

  return (
    <Animated.View
      style={[
        styles.outer,
        shadows.subtle,
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Wrapper
        onPress={onPress ? handlePress : undefined}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        style={styles.inner}
      >
        <BlurView
          intensity={28}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: tintColor }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.04)']}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: colors.pressedHighlight, opacity: brightness },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { borderWidth: 1, borderColor: strokeColor, borderRadius: radiusTokens.pill },
          ]}
        />
        <View style={[styles.content, pad, contentStyle]}>
          {leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
          {label ? (
            <Text
              style={[
                styles.label,
                {
                  color: labelColor,
                  fontWeight: active ? '800' : '700',
                },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ) : null}
          {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
        </View>
      </Wrapper>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radiusTokens.pill,
    overflow: 'visible',
    alignSelf: 'flex-start',
  },
  inner: {
    borderRadius: radiusTokens.pill,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {},
  label: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
