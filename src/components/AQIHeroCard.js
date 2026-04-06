import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getAqiColor, getAqiCategory } from '../theme/colors';

const AQI_BANDS = [
  { max: 50, color: '#22C55E', label: 'Good' },
  { max: 100, color: '#EAB308', label: 'Moderate' },
  { max: 150, color: '#F97316', label: 'Unhealthy (SG)' },
  { max: 200, color: '#EF4444', label: 'Unhealthy' },
  { max: 300, color: '#A855F7', label: 'Very Unhealthy' },
  { max: 500, color: '#991B1B', label: 'Hazardous' },
];

function AQIScaleBar({ aqi, isDark }) {
  const percent = aqi != null ? Math.min((aqi / 500) * 100, 100) : 0;

  return (
    <View style={scaleStyles.wrapper}>
      {/* Gradient bar made of segments */}
      <View style={scaleStyles.barTrack}>
        {AQI_BANDS.map((band, i) => {
          const prevMax = i === 0 ? 0 : AQI_BANDS[i - 1].max;
          const widthPercent = ((band.max - prevMax) / 500) * 100;
          const isFirst = i === 0;
          const isLast = i === AQI_BANDS.length - 1;
          return (
            <View
              key={band.max}
              style={[
                scaleStyles.barSegment,
                {
                  backgroundColor: band.color,
                  width: `${widthPercent}%`,
                  borderTopLeftRadius: isFirst ? 6 : 0,
                  borderBottomLeftRadius: isFirst ? 6 : 0,
                  borderTopRightRadius: isLast ? 6 : 0,
                  borderBottomRightRadius: isLast ? 6 : 0,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Position indicator */}
      {aqi != null && (
        <View style={[scaleStyles.indicatorWrap, { left: `${percent}%` }]}>
          <View
            style={[
              scaleStyles.indicator,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#1A1D26',
                borderColor: isDark ? '#0B1120' : '#FFFFFF',
              },
            ]}
          />
        </View>
      )}

      {/* Scale labels */}
      <View style={scaleStyles.labels}>
        <Text style={[scaleStyles.labelText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }]}>0</Text>
        <Text style={[scaleStyles.labelText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }]}>100</Text>
        <Text style={[scaleStyles.labelText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }]}>200</Text>
        <Text style={[scaleStyles.labelText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }]}>300</Text>
        <Text style={[scaleStyles.labelText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }]}>500</Text>
      </View>
    </View>
  );
}

const scaleStyles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 20,
    marginBottom: 8,
  },
  barTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  indicatorWrap: {
    position: 'absolute',
    top: -3,
    marginLeft: -9,
  },
  indicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 0,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

function PMCard({ label, value, color, colors, isDark, customUnit }) {
  return (
    <View
      style={[
        styles.pmCard,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
        },
      ]}
    >
      <View style={styles.pmCardHeader}>
        <View style={[styles.pmDot, { backgroundColor: color }]} />
        <Text style={[styles.pmLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.pmValue, { color: colors.text }]}>
        {value ?? '--'}
      </Text>
      {customUnit !== '' && (
        <Text style={[styles.pmUnit, { color: colors.textSecondary }]}>
          {customUnit !== undefined ? customUnit : 'µg/m³'}
        </Text>
      )}
    </View>
  );
}

export default function AQIHeroCard({ aqi, pm25, pm10, humidity, loading, onPress }) {
  const { colors, isDark } = useTheme();
  const aqiColor = aqi != null ? getAqiColor(aqi) : colors.textSecondary;
  const category = aqi != null ? getAqiCategory(aqi) : '';

  const cardShadow = !isDark
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      }
    : {};

  const cardBorder = isDark
    ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }
    : {};

  if (loading) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card },
          cardShadow,
          cardBorder,
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card },
        cardShadow,
        cardBorder,
      ]}
    >
      {/* Title */}
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Air Quality Index
      </Text>

      {/* Big AQI number */}
      <Text style={[styles.aqiNumber, { color: aqiColor }]}>
        {aqi ?? '--'}
      </Text>

      {/* Category badge */}
      <View style={[styles.categoryBadge, { backgroundColor: aqiColor + '18' }]}>
        <Text style={[styles.categoryText, { color: aqiColor }]}>
          {category}
        </Text>
      </View>

      {/* Scale bar */}
      <AQIScaleBar aqi={aqi} isDark={isDark} />

      {/* PM mini-cards row */}
      <View style={styles.pmRow}>
        <PMCard
          label="PM2.5"
          value={pm25}
          color={aqiColor}
          colors={colors}
          isDark={isDark}
        />
        <PMCard
          label="Humidity"
          value={humidity != null ? `${humidity}%` : null}
          color="#38BDF8"
          colors={colors}
          isDark={isDark}
          customUnit=""
        />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  aqiNumber: {
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pmRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 16,
  },
  pmCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  pmCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pmDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pmLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pmValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  pmUnit: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.5,
  },
});
