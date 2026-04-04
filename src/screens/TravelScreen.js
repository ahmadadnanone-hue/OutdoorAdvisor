import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MOTORWAYS, CITIES } from '../data/cities';
import { fetchWeatherForLocation } from '../hooks/useWeather';
import { fetchAqiForCity } from '../hooks/useAQI';
import { getWeatherDescription } from '../utils/weatherCodes';
import typography from '../theme/typography';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Build a lookup from city name (lowercase) -> waqiName
const CITY_AQI_MAP = {};
CITIES.forEach((c) => {
  CITY_AQI_MAP[c.name.toLowerCase()] = c.waqiName;
});

function isFog(weatherCode) {
  return weatherCode === 45 || weatherCode === 48;
}

function isRain(weatherCode) {
  return weatherCode >= 61 && weatherCode <= 82;
}

function StopRow({ stop, colors }) {
  const { description, icon } = getWeatherDescription(stop.weatherCode);
  const hasFog = isFog(stop.weatherCode);
  const hasSmog = stop.aqi != null && stop.aqi > 150;
  const hasRain = isRain(stop.weatherCode);
  const isClear = !hasFog && !hasSmog && !hasRain;

  return (
    <View style={[styles.stopRow, { borderBottomColor: colors.border }]}>
      <View style={styles.stopHeader}>
        <Text style={[styles.stopName, { color: colors.text }]}>
          {stop.name}
        </Text>
        <Text style={[styles.stopTemp, { color: colors.primary }]}>
          {Math.round(stop.temp)}°C
        </Text>
      </View>

      <Text style={[styles.stopWeather, { color: colors.textSecondary }]}>
        {icon} {description}
      </Text>

      {stop.aqi != null && (
        <Text style={[styles.aqiText, { color: colors.textSecondary }]}>
          AQI: {stop.aqi}
        </Text>
      )}

      <View style={styles.badgeRow}>
        {hasFog && (
          <View style={[styles.badge, styles.warningBadge]}>
            <Text style={styles.badgeText}>Warning: FOG RISK</Text>
          </View>
        )}
        {hasSmog && (
          <View style={[styles.badge, styles.warningBadge]}>
            <Text style={styles.badgeText}>Warning: SMOG</Text>
          </View>
        )}
        {hasFog && (
          <View style={[styles.badge, styles.speedBadge]}>
            <Text style={styles.badgeText}>Reduce to 60 km/h</Text>
          </View>
        )}
        {!hasFog && hasRain && (
          <View style={[styles.badge, styles.speedBadge]}>
            <Text style={styles.badgeText}>Reduce to 80 km/h</Text>
          </View>
        )}
        {isClear && (
          <View style={[styles.badge, styles.clearBadge]}>
            <Text style={styles.clearBadgeText}>Clear &#10003;</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TravelScreen() {
  const { colors } = useTheme();
  const [expandedMotorway, setExpandedMotorway] = useState(null);
  const [stopData, setStopData] = useState({});
  const fetchingRef = useRef({});

  const toggleMotorway = useCallback(
    async (index) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (expandedMotorway === index) {
        setExpandedMotorway(null);
        return;
      }

      setExpandedMotorway(index);

      // Already fetched or currently fetching
      if (stopData[index] || fetchingRef.current[index]) {
        return;
      }

      fetchingRef.current[index] = true;

      const motorway = MOTORWAYS[index];
      try {
        const results = await Promise.all(
          motorway.stops.map(async (stop) => {
            const weather = await fetchWeatherForLocation(stop.lat, stop.lon);
            let aqiData = { aqi: null };
            const waqiName = CITY_AQI_MAP[stop.name.toLowerCase()];
            if (waqiName) {
              try {
                aqiData = await fetchAqiForCity(waqiName);
              } catch {
                // AQI not available for this stop
              }
            }
            return {
              name: stop.name,
              temp: weather.current.temp,
              weatherCode: weather.current.weatherCode,
              humidity: weather.current.humidity,
              windSpeed: weather.current.windSpeed,
              aqi: aqiData.aqi,
            };
          })
        );

        setStopData((prev) => ({ ...prev, [index]: results }));
      } catch {
        // Keep expanded but show no data; user can collapse and retry
        setStopData((prev) => ({ ...prev, [index]: [] }));
      } finally {
        fetchingRef.current[index] = false;
      }
    },
    [expandedMotorway, stopData]
  );

  const isLoading = (index) =>
    expandedMotorway === index && !stopData[index];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        Motorway Conditions
      </Text>

      {MOTORWAYS.map((motorway, index) => {
        const isExpanded = expandedMotorway === index;

        return (
          <View
            key={motorway.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => toggleMotorway(index)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.roadEmoji}>&#x1F6E3;&#xFE0F;</Text>
                <Text
                  style={[styles.motorwayName, { color: colors.text }]}
                >
                  {motorway.name}
                </Text>
              </View>
              <Text
                style={[styles.chevron, { color: colors.textSecondary }]}
              >
                {isExpanded ? '\u25B2' : '\u25BC'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.expandedContent}>
                {isLoading(index) ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.loadingText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Fetching conditions...
                    </Text>
                  </View>
                ) : stopData[index] && stopData[index].length > 0 ? (
                  stopData[index].map((stop, i) => (
                    <StopRow
                      key={`${motorway.id}-${i}`}
                      stop={stop}
                      colors={colors}
                    />
                  ))
                ) : (
                  <Text
                    style={[
                      styles.noDataText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Unable to load conditions. Collapse and try again.
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roadEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  motorwayName: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    flexShrink: 1,
  },
  chevron: {
    fontSize: 14,
    marginLeft: 8,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: typography.body,
    marginLeft: 10,
  },
  noDataText: {
    fontSize: typography.body,
    textAlign: 'center',
    paddingVertical: 16,
  },
  stopRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stopName: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  stopTemp: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  stopWeather: {
    fontSize: typography.caption + 2,
    marginBottom: 4,
  },
  aqiText: {
    fontSize: typography.caption,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warningBadge: {
    backgroundColor: '#F97316',
  },
  speedBadge: {
    backgroundColor: '#EAB308',
  },
  clearBadge: {
    backgroundColor: '#22C55E',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  clearBadgeText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
});
