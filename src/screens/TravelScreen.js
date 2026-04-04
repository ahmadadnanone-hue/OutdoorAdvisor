import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Linking,
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

const CITY_AQI_MAP = {};
CITIES.forEach((c) => {
  CITY_AQI_MAP[c.name.toLowerCase()] = c.waqiName;
});

const SEVERITY_CONFIG = {
  closed: { icon: '🚫', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'CLOSED' },
  fog: { icon: '🌫️', color: '#F97316', bg: 'rgba(249,115,22,0.12)', label: 'FOG' },
  rain: { icon: '🌧️', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'RAIN' },
  warning: { icon: '⚠️', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', label: 'ADVISORY' },
  cloudy: { icon: '☁️', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', label: 'CLOUDY' },
  clear: { icon: '✅', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', label: 'CLEAR' },
};

function isFog(weatherCode) { return weatherCode === 45 || weatherCode === 48; }
function isRain(weatherCode) { return weatherCode >= 61 && weatherCode <= 82; }

/* ===== NHMP Advisory Card ===== */
function NHMPAdvisory({ advisory, colors, isDark }) {
  const config = SEVERITY_CONFIG[advisory.severity] || SEVERITY_CONFIG.clear;
  return (
    <View style={[styles.nhmpCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
      <View style={styles.nhmpHeader}>
        <View style={[styles.severityBadge, { backgroundColor: config.bg }]}>
          <Text style={styles.severityIcon}>{config.icon}</Text>
          <Text style={[styles.severityLabel, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>
      <Text style={[styles.nhmpRoute, { color: colors.text }]} numberOfLines={2}>
        {advisory.route}
      </Text>
      {advisory.sector ? (
        <Text style={[styles.nhmpSector, { color: colors.textSecondary }]} numberOfLines={1}>
          {advisory.sector}
        </Text>
      ) : null}
      <Text style={[styles.nhmpStatus, { color: advisory.severity === 'clear' ? colors.textSecondary : config.color }]}>
        {advisory.status}
      </Text>
    </View>
  );
}

/* ===== Weather Stop Row ===== */
function StopRow({ stop, colors }) {
  const { description, icon } = getWeatherDescription(stop.weatherCode);
  const hasFog = isFog(stop.weatherCode);
  const hasSmog = stop.aqi != null && stop.aqi > 150;
  const hasRain = isRain(stop.weatherCode);
  const isClear = !hasFog && !hasSmog && !hasRain;

  return (
    <View style={[styles.stopRow, { borderBottomColor: colors.border }]}>
      <View style={styles.stopHeader}>
        <Text style={[styles.stopName, { color: colors.text }]}>{stop.name}</Text>
        <Text style={[styles.stopTemp, { color: colors.primary }]}>{Math.round(stop.temp)}°C</Text>
      </View>
      <Text style={[styles.stopWeather, { color: colors.textSecondary }]}>{icon} {description}</Text>
      {stop.aqi != null && (
        <Text style={[styles.aqiText, { color: colors.textSecondary }]}>AQI: {stop.aqi}</Text>
      )}
      <View style={styles.badgeRow}>
        {hasFog && <View style={[styles.badge, styles.warningBadge]}><Text style={styles.badgeText}>FOG RISK</Text></View>}
        {hasSmog && <View style={[styles.badge, styles.warningBadge]}><Text style={styles.badgeText}>SMOG</Text></View>}
        {hasFog && <View style={[styles.badge, styles.speedBadge]}><Text style={styles.badgeText}>Reduce to 60 km/h</Text></View>}
        {!hasFog && hasRain && <View style={[styles.badge, styles.speedBadge]}><Text style={styles.badgeText}>Reduce to 80 km/h</Text></View>}
        {isClear && <View style={[styles.badge, styles.clearBadge]}><Text style={styles.badgeText}>Clear</Text></View>}
      </View>
    </View>
  );
}

/* ===== Main Screen ===== */
export default function TravelScreen() {
  const { colors, isDark } = useTheme();
  const [expandedMotorway, setExpandedMotorway] = useState(null);
  const [stopData, setStopData] = useState({});
  const fetchingRef = useRef({});

  // NHMP live data
  const [nhmpData, setNhmpData] = useState([]);
  const [nhmpLoading, setNhmpLoading] = useState(true);
  const [nhmpTime, setNhmpTime] = useState(null);
  const [nhmpError, setNhmpError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/nhmp');
        const json = await resp.json();
        if (!cancelled && json.success && json.advisories) {
          setNhmpData(json.advisories);
          setNhmpTime(json.timestamp);
        } else if (!cancelled) {
          setNhmpError(true);
        }
      } catch {
        if (!cancelled) setNhmpError(true);
      } finally {
        if (!cancelled) setNhmpLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleMotorway = useCallback(
    async (index) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (expandedMotorway === index) { setExpandedMotorway(null); return; }
      setExpandedMotorway(index);
      if (stopData[index] || fetchingRef.current[index]) return;
      fetchingRef.current[index] = true;
      const motorway = MOTORWAYS[index];
      try {
        const results = await Promise.all(
          motorway.stops.map(async (stop) => {
            const weather = await fetchWeatherForLocation(stop.lat, stop.lon);
            let aqiData = { aqi: null };
            const waqiName = CITY_AQI_MAP[stop.name.toLowerCase()];
            if (waqiName) {
              try { aqiData = await fetchAqiForCity(waqiName); } catch {}
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
        setStopData((prev) => ({ ...prev, [index]: [] }));
      } finally {
        fetchingRef.current[index] = false;
      }
    },
    [expandedMotorway, stopData]
  );

  const isLoading = (index) => expandedMotorway === index && !stopData[index];

  // Separate active alerts from clear
  const activeAlerts = nhmpData.filter((a) => a.severity !== 'clear');
  const clearRoutes = nhmpData.filter((a) => a.severity === 'clear');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* NHMP Live Advisories */}
      <View style={styles.nhmpSection}>
        <View style={styles.nhmpTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>NHMP Live Advisory</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx')}
            activeOpacity={0.7}
          >
            <Text style={[styles.nhmpLink, { color: colors.primary }]}>View Full</Text>
          </TouchableOpacity>
        </View>
        {nhmpTime && (
          <Text style={[styles.nhmpTimestamp, { color: colors.textSecondary }]}>
            Updated: {new Date(nhmpTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </Text>
        )}

        {nhmpLoading ? (
          <View style={styles.nhmpLoadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading NHMP data...</Text>
          </View>
        ) : nhmpError ? (
          <View style={[styles.nhmpCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <Text style={[styles.nhmpStatus, { color: colors.textSecondary }]}>
              Could not load NHMP data. Tap "View Full" to check directly.
            </Text>
          </View>
        ) : (
          <>
            {activeAlerts.length > 0 && (
              <>
                <Text style={[styles.subTitle, { color: '#EF4444' }]}>Active Alerts ({activeAlerts.length})</Text>
                {activeAlerts.map((a, i) => (
                  <NHMPAdvisory key={`alert-${i}`} advisory={a} colors={colors} isDark={isDark} />
                ))}
              </>
            )}
            {activeAlerts.length === 0 && (
              <View style={[styles.allClearBanner, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                <Text style={styles.allClearText}>✅ All routes reporting clear conditions</Text>
              </View>
            )}
            {clearRoutes.length > 0 && (
              <Text style={[styles.clearCount, { color: colors.textSecondary }]}>
                {clearRoutes.length} route{clearRoutes.length > 1 ? 's' : ''} clear
              </Text>
            )}
          </>
        )}
      </View>

      {/* Weather-Based Motorway Conditions */}
      <Text style={[styles.title, { color: colors.text, marginTop: 24 }]}>
        Weather Along Motorways
      </Text>

      {MOTORWAYS.map((motorway, index) => {
        const isExpanded = expandedMotorway === index;
        return (
          <View
            key={motorway.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => toggleMotorway(index)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.roadEmoji}>🛣️</Text>
                <Text style={[styles.motorwayName, { color: colors.text }]}>{motorway.name}</Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>
                {isExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.expandedContent}>
                {isLoading(index) ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Fetching conditions...</Text>
                  </View>
                ) : stopData[index] && stopData[index].length > 0 ? (
                  stopData[index].map((stop, i) => (
                    <StopRow key={`${motorway.id}-${i}`} stop={stop} colors={colors} />
                  ))
                ) : (
                  <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
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
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  title: { fontSize: typography.title, fontWeight: '700', marginBottom: 4 },
  subTitle: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  /* NHMP Section */
  nhmpSection: { marginBottom: 8 },
  nhmpTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  nhmpLink: { fontSize: 13, fontWeight: '600' },
  nhmpTimestamp: { fontSize: 11, marginBottom: 10 },
  nhmpLoadingWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, justifyContent: 'center' },
  nhmpCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  nhmpHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
  severityIcon: { fontSize: 14 },
  severityLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  nhmpRoute: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  nhmpSector: { fontSize: 12, marginBottom: 4 },
  nhmpStatus: { fontSize: 13, lineHeight: 19 },
  allClearBanner: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  allClearText: { fontSize: 15, fontWeight: '600', color: '#22C55E' },
  clearCount: { fontSize: 12, marginTop: 6, textAlign: 'center' },

  /* Motorway Cards */
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  roadEmoji: { fontSize: 22, marginRight: 10 },
  motorwayName: { fontSize: typography.subtitle, fontWeight: '600', flexShrink: 1 },
  chevron: { fontSize: 14, marginLeft: 8 },
  expandedContent: { paddingHorizontal: 16, paddingBottom: 12 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  loadingText: { fontSize: typography.body, marginLeft: 10 },
  noDataText: { fontSize: typography.body, textAlign: 'center', paddingVertical: 16 },

  /* Stop rows */
  stopRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  stopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stopName: { fontSize: typography.body, fontWeight: '600' },
  stopTemp: { fontSize: typography.body, fontWeight: '700' },
  stopWeather: { fontSize: typography.caption + 2, marginBottom: 4 },
  aqiText: { fontSize: typography.caption, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  warningBadge: { backgroundColor: '#F97316' },
  speedBadge: { backgroundColor: '#EAB308' },
  clearBadge: { backgroundColor: '#22C55E' },
  badgeText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '600' },
});
