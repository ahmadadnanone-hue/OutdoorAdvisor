import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Icon from './Icon';
import { colors as dc } from '../design';

function getWeatherKind(weatherCode) {
  if (weatherCode == null) return 'partly';
  if (weatherCode === 0) return 'clear';
  if (weatherCode === 1 || weatherCode === 2) return 'partly';
  if (weatherCode === 3) return 'cloud';
  if (weatherCode === 45 || weatherCode === 48) return 'fog';
  if (weatherCode >= 51 && weatherCode <= 67) return 'rain';
  if (weatherCode >= 71 && weatherCode <= 77) return 'snow';
  if (weatherCode >= 80 && weatherCode <= 82) return 'rain';
  if (weatherCode >= 95) return 'storm';
  return 'partly';
}

function useLoop(toValue, duration, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay, duration, toValue, value]);

  return value;
}

function GlassPlate({ size, children }) {
  const pad = Math.max(4, size * 0.08);
  return (
    <View
      style={[
        styles.plate,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: pad,
        },
      ]}
    >
      {children}
    </View>
  );
}

function ClearIcon({ size, isNight }) {
  const pulse = useLoop(1, 1500);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const iconSize = size * (isNight ? 0.56 : 0.6);

  return (
    <GlassPlate size={size}>
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <Icon
          name={isNight ? 'moon-outline' : 'sunny-outline'}
          size={iconSize}
          color={isNight ? '#C8E6FF' : '#FCD34D'}
        />
      </Animated.View>
    </GlassPlate>
  );
}

function CloudIcon({ size, isNight, partly = false }) {
  const drift = useLoop(1, 2200);
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] });
  const moonSize = size * 0.44;
  const sunSize = size * 0.42;
  const cloudSize = size * 0.62;

  return (
    <GlassPlate size={size}>
      {partly && isNight ? (
        <View style={styles.layerFill}>
          <Icon
            name="moon-outline"
            size={moonSize}
            color="#C8E6FF"
            style={[
              styles.backOrb,
              {
                left: size * 0.17,
                top: size * 0.13,
              },
            ]}
          />
        </View>
      ) : null}
      {partly && !isNight ? (
        <View style={styles.layerFill}>
          <Icon
            name="sunny-outline"
            size={sunSize}
            color="#FCD34D"
            style={[
              styles.backOrb,
              {
                left: size * 0.15,
                top: size * 0.13,
              },
            ]}
          />
        </View>
      ) : null}
      <Animated.View
        style={[
          styles.center,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <Icon
          name="cloudy-outline"
          size={cloudSize}
          color={partly ? dc.accentCyan : '#AFC4D8'}
          style={partly ? { marginTop: size * 0.12, marginLeft: size * 0.12 } : null}
        />
      </Animated.View>
    </GlassPlate>
  );
}

function RainIcon({ size, storm = false }) {
  const drift = useLoop(1, 1700);
  const fall = useLoop(1, 900, 120);
  const flash = useLoop(1, 900, 420);
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-1, 5] });
  const dropOpacity = fall.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] });
  const flashOpacity = flash.interpolate({ inputRange: [0, 0.48, 1], outputRange: [0.15, 1, 0.15] });
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] });

  return (
    <GlassPlate size={size}>
      <Animated.View style={[styles.center, { transform: [{ translateX }] }]}>
        <Icon name="cloudy-outline" size={size * 0.58} color={storm ? '#B69CFF' : '#8DD7FF'} />
      </Animated.View>
      {storm ? (
        <Animated.View style={[styles.bolt, { opacity: flashOpacity, left: size * 0.46, top: size * 0.46 }]}>
          <Icon name="flash" size={size * 0.28} color="#FFD34E" />
        </Animated.View>
      ) : null}
      <Animated.View
        style={[
          styles.rainRow,
          {
            left: size * 0.27,
            top: size * 0.58,
            opacity: dropOpacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {[0, 1, 2].map((item) => (
          <View
            key={item}
            style={[
              styles.rainDrop,
              {
                height: size * 0.19,
                marginHorizontal: size * 0.035,
              },
            ]}
          />
        ))}
      </Animated.View>
    </GlassPlate>
  );
}

function WindIcon({ size }) {
  const sway = useLoop(1, 1600);
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [-4, 5] });
  const opacity = sway.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <GlassPlate size={size}>
      <Animated.View style={[styles.windLines, { opacity, transform: [{ translateX }] }]}>
        <View style={[styles.windLine, { width: size * 0.48 }]} />
        <View style={[styles.windLine, { width: size * 0.34, marginLeft: size * 0.12 }]} />
        <View style={[styles.windLine, { width: size * 0.42, marginLeft: size * 0.04 }]} />
      </Animated.View>
    </GlassPlate>
  );
}

function SnowIcon({ size }) {
  const float = useLoop(1, 1800);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [-3, 4] });
  const rotate = float.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });

  return (
    <GlassPlate size={size}>
      <Animated.View style={[styles.center, { transform: [{ translateY }, { rotate }] }]}>
        <Icon name="snow-outline" size={size * 0.58} color="#D7F4FF" />
      </Animated.View>
    </GlassPlate>
  );
}

export default function AnimatedWeatherIcon({
  weatherCode,
  size = 28,
  isNight = false,
  animated = true,
}) {
  const kind = useMemo(() => getWeatherKind(weatherCode), [weatherCode]);
  const adjustedSize = Math.max(24, size);

  if (!animated) {
    if (kind === 'rain' || kind === 'storm') return <RainIcon size={adjustedSize} storm={kind === 'storm'} />;
  }

  if (kind === 'clear') return <ClearIcon size={adjustedSize} isNight={isNight} />;
  if (kind === 'partly') return <CloudIcon size={adjustedSize} isNight={isNight} partly />;
  if (kind === 'cloud') return <CloudIcon size={adjustedSize} isNight={isNight} />;
  if (kind === 'fog') return <WindIcon size={adjustedSize} />;
  if (kind === 'rain') return <RainIcon size={adjustedSize} />;
  if (kind === 'storm') return <RainIcon size={adjustedSize} storm />;
  if (kind === 'snow') return <SnowIcon size={adjustedSize} />;
  return <CloudIcon size={adjustedSize} isNight={isNight} partly />;
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerFill: {
    ...StyleSheet.absoluteFillObject,
  },
  backOrb: {
    position: 'absolute',
    opacity: 0.95,
  },
  bolt: {
    position: 'absolute',
  },
  rainRow: {
    position: 'absolute',
    flexDirection: 'row',
  },
  rainDrop: {
    width: 2,
    borderRadius: 999,
    backgroundColor: '#7DD3FC',
  },
  windLines: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 5,
  },
  windLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: '#A7F3FF',
  },
});
