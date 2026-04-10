import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AnimatedWeatherIcon from './AnimatedWeatherIcon';
import { getAqiColor, getAqiCategory } from '../theme/colors';

function isRainCode(code) {
  return code != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);
}

function isStormCode(code) {
  return code != null && [95, 96, 99].includes(code);
}

function isFogCode(code) {
  return code != null && [45, 48].includes(code);
}

function getTempToneColor(temp) {
  if (temp == null) return '#FFFFFF';
  if (temp <= 10) return '#BFDBFE';
  if (temp <= 18) return '#7DD3FC';
  if (temp >= 22 && temp <= 26) return '#86EFAC';
  if (temp <= 31) return '#FDE68A';
  if (temp <= 36) return '#FDBA74';
  return '#FCA5A5';
}

function getHeroTheme(weatherCode, windSpeed) {
  const isWindy = (windSpeed ?? 0) >= 20;

  if (isStormCode(weatherCode)) {
    return {
      background: '#2A3050',
      surface: 'rgba(255,255,255,0.12)',
      line: 'rgba(255,255,255,0.22)',
      text: '#FFFFFF',
      subtext: 'rgba(255,255,255,0.78)',
      accent: '#FBBF24',
    };
  }

  if (isRainCode(weatherCode)) {
    return {
      background: '#2F5D8A',
      surface: 'rgba(255,255,255,0.12)',
      line: 'rgba(255,255,255,0.22)',
      text: '#FFFFFF',
      subtext: 'rgba(255,255,255,0.78)',
      accent: '#7DD3FC',
    };
  }

  if (isFogCode(weatherCode)) {
    return {
      background: '#556476',
      surface: 'rgba(255,255,255,0.12)',
      line: 'rgba(255,255,255,0.2)',
      text: '#FFFFFF',
      subtext: 'rgba(255,255,255,0.78)',
      accent: '#E2E8F0',
    };
  }

  if (isWindy) {
    return {
      background: '#343F70',
      surface: 'rgba(255,255,255,0.12)',
      line: 'rgba(255,255,255,0.2)',
      text: '#FFFFFF',
      subtext: 'rgba(255,255,255,0.78)',
      accent: '#C7D2FE',
    };
  }

  if (weatherCode === 0) {
    return {
      background: '#E38A1C',
      surface: 'rgba(255,255,255,0.18)',
      line: 'rgba(255,255,255,0.22)',
      text: '#FFFFFF',
      subtext: 'rgba(255,255,255,0.82)',
      accent: '#FEF3C7',
    };
  }

  return {
    background: '#53627C',
    surface: 'rgba(255,255,255,0.12)',
    line: 'rgba(255,255,255,0.2)',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.8)',
    accent: '#DCE7F7',
  };
}

function WindMotion({ color }) {
  const translateX = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 16,
          duration: 1800,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -12,
          duration: 1800,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [translateX]);

  return (
    <View style={styles.windMotionWrap}>
      {[0, 1, 2].map((line) => (
        <Animated.View
          key={line}
          style={[
            styles.windLine,
            {
              borderColor: color,
              opacity: 1 - line * 0.2,
              width: 82 - line * 12,
              transform: [{ translateX }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function InfoPill({ label, value, colors }) {
  return (
    <View style={[styles.infoPill, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Text style={[styles.infoPillLabel, { color: colors.subtext }]}>{label}</Text>
      <Text style={[styles.infoPillValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function HeroGlow({ color, style }) {
  return <View pointerEvents="none" style={[styles.glowOrb, { backgroundColor: color }, style]} />;
}

function PressableZone({ onPress, children, style }) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={style}>
      {children}
    </TouchableOpacity>
  );
}

export default function AQIHeroCard({
  locationTitle,
  locationSubtitle,
  conditionLabel,
  weatherCode,
  weatherEmoji,
  tempValue,
  tempLabel,
  feelsLikeLabel,
  windSpeed,
  aqi,
  pm25,
  humidity,
  loading,
  onPressAqi,
  onPressTemp,
}) {
  const { colors: themeColors, isDark } = useTheme();
  const heroColors = getHeroTheme(weatherCode, windSpeed);
  const aqiColor = aqi != null ? getAqiColor(aqi) : heroColors.accent;
  const aqiCategory = aqi != null ? getAqiCategory(aqi) : 'AQI pending';
  const tempTone = getTempToneColor(tempValue);

  const cardShadow = !isDark
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 5,
      }
    : {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      };

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: heroColors.background }, cardShadow]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  const content = (
    <View style={[styles.card, { backgroundColor: heroColors.background }, cardShadow]}>
      <HeroGlow color={heroColors.accent + '22'} style={styles.glowTop} />
      <HeroGlow color={'rgba(255,255,255,0.08)'} style={styles.glowBottom} />

      <View style={styles.topMetaRow}>
        <View style={[styles.liveChip, { backgroundColor: heroColors.surface, borderColor: heroColors.line }]}>
          <View style={[styles.liveDot, { backgroundColor: heroColors.accent }]} />
          <Text style={[styles.liveChipText, { color: heroColors.text }]}>Live conditions</Text>
        </View>
        <View style={[styles.weatherMoodChip, { backgroundColor: heroColors.surface, borderColor: heroColors.line }]}>
          <Text style={[styles.weatherMoodText, { color: heroColors.subtext }]}>
            {(windSpeed ?? 0) >= 20 ? 'Windy' : conditionLabel || 'Now'}
          </Text>
        </View>
      </View>

      <View style={[styles.locationPill, { backgroundColor: heroColors.surface, borderColor: heroColors.line }]}>
        <Text style={styles.locationIcon}>📍</Text>
        <View style={styles.locationCopy}>
          <Text style={[styles.locationTitle, { color: heroColors.text }]} numberOfLines={2}>
            {locationTitle || 'Current location'}
          </Text>
          {!!locationSubtitle && (
            <Text style={[styles.locationSubtitle, { color: heroColors.subtext }]} numberOfLines={1}>
              {locationSubtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.motionArea}>
          {(windSpeed ?? 0) >= 20 ? (
            <WindMotion color={heroColors.accent} />
          ) : (
            <AnimatedWeatherIcon weatherCode={weatherCode} emoji={weatherEmoji} size={62} />
          )}
          <Text style={[styles.conditionText, { color: heroColors.subtext }]}>
            {conditionLabel || 'Current conditions'}
          </Text>
        </View>

        <PressableZone onPress={onPressTemp} style={styles.tempArea}>
          <Text style={[styles.tempValue, { color: tempTone }]}>{tempLabel || '--'}</Text>
          <Text style={[styles.feelsLike, { color: heroColors.subtext }]}>
            Feels like {feelsLikeLabel || '--'}
          </Text>
        </PressableZone>
      </View>

      <View style={styles.infoRow}>
        <PressableZone onPress={onPressAqi} style={styles.infoPillWrap}>
          <InfoPill label="AQI" value={aqi != null ? String(aqi) : '--'} colors={heroColors} />
        </PressableZone>
        <InfoPill
          label="Wind"
          value={windSpeed != null ? `${Math.round(windSpeed)} km/h` : '--'}
          colors={heroColors}
        />
        <InfoPill
          label="Humidity"
          value={humidity != null ? `${humidity}%` : '--'}
          colors={heroColors}
        />
      </View>

      <PressableZone
        onPress={onPressAqi}
        style={[styles.bottomCard, { backgroundColor: heroColors.surface, borderColor: heroColors.line }]}
      >
        <View>
          <Text style={[styles.bottomEyebrow, { color: heroColors.subtext }]}>Air quality snapshot</Text>
          <Text style={[styles.bottomTitle, { color: heroColors.text }]}>
            {aqiCategory}
          </Text>
          <Text style={[styles.bottomBody, { color: heroColors.subtext }]}>
            PM2.5 {pm25 != null ? pm25 : '--'} µg/m³
          </Text>
        </View>
        <View style={[styles.aqiBadge, { backgroundColor: aqiColor + '22' }]}>
          <Text style={[styles.aqiBadgeText, { color: aqiColor }]}>{aqi != null ? aqi : '--'}</Text>
        </View>
      </PressableZone>
    </View>
  );

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 18,
    minHeight: 280,
    overflow: 'hidden',
    position: 'relative',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowTop: {
    width: 180,
    height: 180,
    top: -36,
    right: -28,
  },
  glowBottom: {
    width: 140,
    height: 140,
    bottom: -54,
    left: -34,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  liveChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  liveChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  weatherMoodChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  weatherMoodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationPill: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  locationIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  locationCopy: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  locationSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  motionArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  windMotionWrap: {
    width: 98,
    height: 72,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  windLine: {
    height: 10,
    borderRadius: 999,
    borderWidth: 2.5,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  conditionText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  tempArea: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tempValue: {
    fontSize: 58,
    fontWeight: '800',
    lineHeight: 64,
  },
  feelsLike: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  infoPillWrap: {
    flex: 1,
  },
  infoPill: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoPillValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bottomTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  bottomBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  aqiBadge: {
    minWidth: 70,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aqiBadgeText: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 30,
  },
});
