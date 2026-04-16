import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

function PulseIcon({ emoji, size }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);

  return (
    <Animated.Text style={[styles.icon, { fontSize: size, transform: [{ scale }] }]}>
      {emoji}
    </Animated.Text>
  );
}

function BounceIcon({ emoji, size }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -6, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [translateY]);

  return (
    <Animated.Text style={[styles.icon, { fontSize: size, transform: [{ translateY }] }]}>
      {emoji}
    </Animated.Text>
  );
}

function SwayIcon({ emoji, size }) {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 4, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -4, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [translateX]);

  return (
    <Animated.Text style={[styles.icon, { fontSize: size, transform: [{ translateX }] }]}>
      {emoji}
    </Animated.Text>
  );
}

function SpinIcon({ emoji, size }) {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [rotate]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '15deg'] });

  return (
    <Animated.Text style={[styles.icon, { fontSize: size, transform: [{ rotate: spin }] }]}>
      {emoji}
    </Animated.Text>
  );
}

function FadeFlashIcon({ emoji, size }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 400, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.icon, { fontSize: size, opacity }]}>
      {emoji}
    </Animated.Text>
  );
}

// Map weather codes to animation types
function getAnimationType(weatherCode) {
  if (weatherCode === 0) return 'pulse';           // Clear sun - glow
  if (weatherCode <= 3) return 'sway';              // Cloudy - drift
  if (weatherCode <= 48) return 'sway';             // Fog - drift
  if (weatherCode <= 55) return 'bounce';           // Drizzle - drops
  if (weatherCode <= 65) return 'bounce';           // Rain - drops
  if (weatherCode <= 75) return 'spin';             // Snow - flutter
  if (weatherCode <= 82) return 'bounce';           // Showers - drops
  if (weatherCode <= 99) return 'flash';            // Thunderstorm - flash
  return 'pulse';
}

export default function AnimatedWeatherIcon({ weatherCode, emoji, size = 28 }) {
  const animType = getAnimationType(weatherCode);

  switch (animType) {
    case 'pulse': return <PulseIcon emoji={emoji} size={size} />;
    case 'bounce': return <BounceIcon emoji={emoji} size={size} />;
    case 'sway': return <SwayIcon emoji={emoji} size={size} />;
    case 'spin': return <SpinIcon emoji={emoji} size={size} />;
    case 'flash': return <FadeFlashIcon emoji={emoji} size={size} />;
    default: return <PulseIcon emoji={emoji} size={size} />;
  }
}

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
});
