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
import { useSettings } from '../context/SettingsContext';
import { TRAVEL_ROUTES } from '../data/cities';
import { fetchWeatherForLocation } from '../hooks/useWeather';
import { fetchAqiForLocation } from '../hooks/useAQI';
import { getWeatherDescription } from '../utils/weatherCodes';
import typography from '../theme/typography';
import { fetchApiJson } from '../config/api';

const NHMP_REFRESH_MS = 5 * 60 * 1000;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PMD_SEVERITY_MAP = {
  severe: { icon: '⛈️', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  rain: { icon: '🌧️', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  fog: { icon: '🌫️', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  cloudy: { icon: '☁️', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  clear: { icon: '☀️', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  other: { icon: '🌤️', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

const SEVERITY_CONFIG = {
  closed: { icon: '🚫', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'CLOSED' },
  fog: { icon: '🌫️', color: '#F97316', bg: 'rgba(249,115,22,0.12)', label: 'FOG' },
  rain: { icon: '🌧️', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'RAIN' },
  warning: { icon: '⚠️', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', label: 'ADVISORY' },
  cloudy: { icon: '☁️', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', label: 'CLOUDY' },
  clear: { icon: '✅', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', label: 'CLEAR' },
};

const ROUTE_ALERT_KEYWORDS = {
  E35: ['hazara', 'mansehra', 'abbottabad', 'haripur', 'burhan'],
  KKH: ['karakoram', 'gilgit', 'chilas', 'besham', 'mansehra', 'abbottabad'],
  N15: ['naran', 'kaghan', 'balakot', 'babusar', 'mansehra'],
  MURREE: ['murree', 'bhurban', 'patriata', 'kohala'],
  SWAT: ['swat', 'mingora', 'kalam', 'malakand', 'mardan'],
};

const NHMP_ROUTE_ALIASES = {
  M1: ['m1', 'peshawar-islamabad', 'peshawar to islamabad', 'islamabad to peshawar'],
  M2: ['m2', 'islamabad-lahore', 'islamabad to lahore', 'lahore to islamabad'],
  M3: ['m3', 'lahore-abdul hakam', 'lahore to abdul hakam', 'abdul hakam to lahore'],
  M4: ['m4', 'abdul hakam-multan', 'abdul hakam to multan', 'multan to abdul hakam'],
  M9: ['m9', 'karachi-hyderabad', 'karachi to hyderabad', 'hyderabad to karachi'],
};

function findNhmpRouteMatch(route, advisories) {
  const aliases = [
    route.id.toLowerCase(),
    route.name.toLowerCase(),
    ...(NHMP_ROUTE_ALIASES[route.id] || []),
    ...route.stops.map((stop) => stop.name.toLowerCase()),
  ];

  return advisories.find((advisory) => {
    const haystack = `${advisory.route || ''} ${advisory.sector || ''} ${advisory.status || ''}`.toLowerCase();
    return aliases.some((alias) => haystack.includes(alias));
  }) || null;
}

function findRelevantPmdAlerts(route, alerts) {
  const staticKeywords = ROUTE_ALERT_KEYWORDS[route.id] || [];
  const dynamicKeywords = route.stops.map((stop) => stop.name.toLowerCase());
  const keywords = [...new Set([...staticKeywords, ...dynamicKeywords, route.name.toLowerCase()])];

  return alerts.filter((alert) => {
    const text = String(alert || '').toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function getRouteSourceSummary(route, advisory, matchedAlerts) {
  if (route.kind === 'motorway') {
    if (advisory) return 'Source: NHMP advisory first, then live stop weather/AQI and PMD weather context.';
    return 'Source: live stop weather/AQI with PMD weather context. NHMP did not publish a route-specific entry in the latest feed.';
  }

  if (matchedAlerts.length > 0) {
    return 'Source: live stop weather/AQI plus PMD regional alerts for this corridor.';
  }

  return 'Source: live stop weather/AQI along route stops. PMD currently has no route-specific alert in the latest feed.';
}

function isFog(weatherCode) { return weatherCode === 45 || weatherCode === 48; }
function isRain(weatherCode) { return weatherCode >= 61 && weatherCode <= 82; }

/* ===== NHMP Advisory Card ===== */
function NHMPAdvisory({ advisory, colors, isDark }) {
  const config = SEVERITY_CONFIG[advisory.severity] || SEVERITY_CONFIG.clear;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => Linking.openURL('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx')}
      style={[styles.nhmpCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
    >
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
      <Text style={[styles.bannerHint, { color: colors.textSecondary }]}>Tap for official NHMP details</Text>
    </TouchableOpacity>
  );
}

/* ===== Weather Stop Row ===== */
function StopRow({ stop, colors, formatTempShort }) {
  const { description, icon } = getWeatherDescription(stop.weatherCode);
  const hasFog = isFog(stop.weatherCode);
  const hasSmog = stop.aqi != null && stop.aqi > 150;
  const hasRain = isRain(stop.weatherCode);
  const isClear = !hasFog && !hasSmog && !hasRain;

  return (
    <View style={[styles.stopRow, { borderBottomColor: colors.border }]}>
      <View style={styles.stopHeader}>
        <Text style={[styles.stopName, { color: colors.text }]}>{stop.name}</Text>
        <Text style={[styles.stopTemp, { color: colors.primary }]}>{formatTempShort(stop.temp)}</Text>
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
  const { formatTempShort } = useSettings();
  const [expandedMotorway, setExpandedMotorway] = useState(null);
  const [stopData, setStopData] = useState({});
  const fetchingRef = useRef({});
  const nhmpCancelRef = useRef(false);

  // NHMP live data
  const [nhmpData, setNhmpData] = useState([]);
  const [nhmpLoading, setNhmpLoading] = useState(true);
  const [nhmpRefreshing, setNhmpRefreshing] = useState(false);
  const [nhmpTime, setNhmpTime] = useState(null);
  const [nhmpError, setNhmpError] = useState(false);

  // PMD data
  const [pmdCities, setPmdCities] = useState([]);
  const [pmdAlerts, setPmdAlerts] = useState([]);
  const [pmdLoading, setPmdLoading] = useState(true);
  const [pmdTime, setPmdTime] = useState(null);
  const [pmdBlocked, setPmdBlocked] = useState(false);
  const [expandedPmdCity, setExpandedPmdCity] = useState(null);

  const loadNhmp = useCallback(async ({ silent = false } = {}) => {
    if (!silent && nhmpData.length > 0) {
      setNhmpRefreshing(true);
    }
    try {
      const json = await fetchApiJson('/api/nhmp');
      if (nhmpCancelRef.current) return;

      if (json.success && json.advisories) {
        setNhmpData(json.advisories);
        setNhmpTime(json.timestamp);
        setNhmpError(false);
      } else {
        setNhmpError(true);
      }
    } catch {
      if (!nhmpCancelRef.current) setNhmpError(true);
    } finally {
      if (!nhmpCancelRef.current) {
        setNhmpLoading(false);
        setNhmpRefreshing(false);
      }
    }
  }, [nhmpData.length]);

  useEffect(() => {
    nhmpCancelRef.current = false;
    loadNhmp();

    const nhmpInterval = setInterval(() => {
      loadNhmp({ silent: true });
    }, NHMP_REFRESH_MS);

    // Fetch PMD
    (async () => {
      try {
        const json = await fetchApiJson('/api/pmd');
        if (!nhmpCancelRef.current && json.success && json.cities && json.cities.length > 0) {
          setPmdCities(json.cities);
          setPmdAlerts(json.alerts || []);
          setPmdTime(json.timestamp);
        } else if (!nhmpCancelRef.current) {
          setPmdBlocked(true);
        }
      } catch {
        if (!nhmpCancelRef.current) setPmdBlocked(true);
      } finally {
        if (!nhmpCancelRef.current) setPmdLoading(false);
      }
    })();
    return () => {
      nhmpCancelRef.current = true;
      clearInterval(nhmpInterval);
    };
  }, [loadNhmp]);

  const toggleMotorway = useCallback(
    async (index) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (expandedMotorway === index) { setExpandedMotorway(null); return; }
      setExpandedMotorway(index);
      if (stopData[index] || fetchingRef.current[index]) return;
      fetchingRef.current[index] = true;
      const motorway = TRAVEL_ROUTES[index];
      try {
        const results = await Promise.all(
          motorway.stops.map(async (stop) => {
            const weather = await fetchWeatherForLocation(stop.lat, stop.lon);
            let aqiData = { aqi: null };
            try {
              aqiData = await fetchAqiForLocation(stop.lat, stop.lon);
            } catch {}
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
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => loadNhmp()}
              activeOpacity={0.7}
              disabled={nhmpRefreshing}
            >
              <Text style={[styles.nhmpLink, { color: colors.primary, opacity: nhmpRefreshing ? 0.6 : 1 }]}>
                {nhmpRefreshing ? 'Refreshing…' : 'Refresh'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx')}
              activeOpacity={0.7}
            >
              <Text style={[styles.nhmpLink, { color: colors.primary }]}>View Full</Text>
            </TouchableOpacity>
          </View>
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

      {/* PMD Official Forecast */}
      <View style={[styles.nhmpSection, { marginTop: 24 }]}>
        <View style={styles.nhmpTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>PMD 3-Day Forecast</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://nwfc.pmd.gov.pk/new/3-days-forecast.php')}
            activeOpacity={0.7}
          >
            <Text style={[styles.nhmpLink, { color: colors.primary }]}>View Full</Text>
          </TouchableOpacity>
        </View>
        {pmdTime && (
          <Text style={[styles.nhmpTimestamp, { color: colors.textSecondary }]}>
            Updated: {new Date(pmdTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </Text>
        )}

        {pmdLoading ? (
          <View style={styles.nhmpLoadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading PMD data...</Text>
          </View>
        ) : pmdBlocked ? (
          <View style={[styles.nhmpCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <Text style={[styles.pmdBlockedTitle, { color: colors.text }]}>
              Official PMD Forecasts
            </Text>
            <Text style={[styles.nhmpStatus, { color: colors.textSecondary }]}>
              Live data temporarily unavailable. Tap links below to view directly.
            </Text>
            <View style={styles.pmdLinksRow}>
              <TouchableOpacity
                style={[styles.pmdLinkBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => Linking.openURL('https://nwfc.pmd.gov.pk/new/3-days-forecast.php')}
                activeOpacity={0.7}
              >
                <Text style={[styles.pmdLinkText, { color: colors.primary }]}>3-Day Forecast</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pmdLinkBtn, { backgroundColor: '#EF4444' + '15' }]}
                onPress={() => Linking.openURL('https://nwfc.pmd.gov.pk/new/daily-forecast-en.php')}
                activeOpacity={0.7}
              >
                <Text style={[styles.pmdLinkText, { color: '#EF4444' }]}>Weather Alerts</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {pmdAlerts.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => Linking.openURL('https://nwfc.pmd.gov.pk/new/daily-forecast-en.php')}
                style={[styles.pmdAlertBanner, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}
              >
                <Text style={styles.pmdAlertIcon}>🚨</Text>
                <View style={styles.pmdAlertContent}>
                  <Text style={[styles.pmdAlertTitle, { color: '#EF4444' }]}>Weather Alert</Text>
                  {pmdAlerts.slice(0, 3).map((alert, i) => (
                    <Text key={i} style={[styles.pmdAlertText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                      {alert}
                    </Text>
                  ))}
                  <Text style={[styles.bannerHint, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>Tap for official PMD alert details</Text>
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.pmdCityGrid}>
              {pmdCities.map((city, i) => {
                const isExpanded = expandedPmdCity === i;
                const today = city.forecast[0];
                const severityConf = PMD_SEVERITY_MAP[today?.severity] || PMD_SEVERITY_MAP.other;
                return (
                  <TouchableOpacity
                    key={city.city}
                    style={[styles.pmdCityCard, {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    }]}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedPmdCity(isExpanded ? null : i);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pmdCityHeader}>
                      <Text style={[styles.pmdCityName, { color: colors.text }]}>{city.city}</Text>
                      <View style={[styles.pmdTempBadge, { backgroundColor: severityConf.bg }]}>
                        <Text style={[styles.pmdTempText, { color: severityConf.color }]}>
                          {today ? `${today.minTemp}°-${today.maxTemp}°` : '--'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.pmdCondition, { color: colors.textSecondary }]}>
                      {severityConf.icon} {today?.condition || 'N/A'}
                    </Text>
                    {city.humidity && (
                      <Text style={[styles.pmdHumidity, { color: colors.textSecondary }]}>
                        Humidity: {city.humidity}
                      </Text>
                    )}
                    {isExpanded && city.forecast.length > 1 && (
                      <View style={[styles.pmdForecastDays, { borderTopColor: colors.border }]}>
                        {city.forecast.map((day, di) => {
                          const daySev = PMD_SEVERITY_MAP[day.severity] || PMD_SEVERITY_MAP.other;
                          return (
                            <View key={di} style={styles.pmdDayRow}>
                              <Text style={[styles.pmdDayLabel, { color: colors.textSecondary }]}>{day.date}</Text>
                              <Text style={[styles.pmdDayCondition, { color: colors.text }]}>{daySev.icon} {day.condition}</Text>
                              <Text style={[styles.pmdDayTemp, { color: daySev.color }]}>{day.minTemp}°-{day.maxTemp}°</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Weather-Based Route Conditions */}
      <Text style={[styles.title, { color: colors.text, marginTop: 24 }]}>
        Weather Along Major Routes
      </Text>
      <Text style={[styles.routeSubtitle, { color: colors.textSecondary }]}>
        Includes motorways, northern highways, and mountain access corridors.
      </Text>

      {TRAVEL_ROUTES.map((motorway, index) => {
        const isExpanded = expandedMotorway === index;
        const matchedAdvisory = motorway.kind === 'motorway' ? findNhmpRouteMatch(motorway, nhmpData) : null;
        const matchedPmdAlerts = findRelevantPmdAlerts(motorway, pmdAlerts);
        const sourceSummary = getRouteSourceSummary(motorway, matchedAdvisory, matchedPmdAlerts);
        const sourceBadge =
          motorway.kind === 'motorway'
            ? matchedAdvisory
              ? matchedAdvisory.severity === 'clear'
                ? { label: 'NHMP Match', color: '#22C55E', bg: 'rgba(34,197,94,0.14)' }
                : { label: 'NHMP Match', color: '#EF4444', bg: 'rgba(239,68,68,0.14)' }
              : { label: 'Stop Scan', color: colors.primary, bg: colors.primary + '15' }
            : matchedPmdAlerts.length > 0
            ? { label: 'PMD Alert', color: '#EF4444', bg: 'rgba(239,68,68,0.14)' }
            : { label: 'Stop Scan', color: colors.primary, bg: colors.primary + '15' };

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
                <Text style={styles.roadEmoji}>{motorway.emoji || '🛣️'}</Text>
                <View style={styles.routeTitleWrap}>
                  <Text style={[styles.motorwayName, { color: colors.text }]}>{motorway.name}</Text>
                  <View style={styles.routeBadgeRow}>
                    <View style={[styles.routeKindBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.routeKindText, { color: colors.primary }]}>
                        {motorway.kind || 'route'}
                      </Text>
                    </View>
                    <View style={[styles.routeKindBadge, { backgroundColor: sourceBadge.bg }]}>
                      <Text style={[styles.routeKindText, { color: sourceBadge.color }]}>
                        {sourceBadge.label}
                      </Text>
                    </View>
                  </View>
                  {matchedAdvisory?.status ? (
                    <Text style={[styles.routeMetaText, { color: matchedAdvisory.severity === 'clear' ? colors.textSecondary : '#EF4444' }]} numberOfLines={2}>
                      {matchedAdvisory.status}
                    </Text>
                  ) : matchedPmdAlerts[0] ? (
                    <Text style={[styles.routeMetaText, { color: colors.textSecondary }]} numberOfLines={2}>
                      PMD: {matchedPmdAlerts[0]}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>
                {isExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.expandedContent}>
                <Text style={[styles.routeSourceText, { color: colors.textSecondary }]}>
                  {sourceSummary}
                </Text>
                {matchedPmdAlerts.length > 0 && (
                  <View style={[styles.routeAlertNote, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' }]}>
                    <Text style={[styles.routeAlertTitle, { color: '#EF4444' }]}>PMD note</Text>
                    {matchedPmdAlerts.slice(0, 2).map((alert, alertIndex) => (
                      <Text key={`${motorway.id}-alert-${alertIndex}`} style={[styles.routeAlertBody, { color: colors.textSecondary }]}>
                        {alert}
                      </Text>
                    ))}
                  </View>
                )}
                {isLoading(index) ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Fetching conditions...</Text>
                  </View>
                ) : stopData[index] && stopData[index].length > 0 ? (
                  stopData[index].map((stop, i) => (
                    <StopRow key={`${motorway.id}-${i}`} stop={stop} colors={colors} formatTempShort={formatTempShort} />
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  bannerHint: { fontSize: 11, marginTop: 8, fontWeight: '600' },
  allClearBanner: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  allClearText: { fontSize: 15, fontWeight: '600', color: '#22C55E' },
  clearCount: { fontSize: 12, marginTop: 6, textAlign: 'center' },

  /* PMD Section */
  pmdBlockedTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  pmdLinksRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pmdLinkBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  pmdLinkText: { fontSize: 13, fontWeight: '700' },
  pmdAlertBanner: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', marginBottom: 12 },
  pmdAlertIcon: { fontSize: 20, marginRight: 10, marginTop: 2 },
  pmdAlertContent: { flex: 1 },
  pmdAlertTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  pmdAlertText: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  pmdCityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  pmdCityCard: { borderWidth: 1, borderRadius: 14, padding: 12, width: '48%', minWidth: 150 },
  pmdCityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pmdCityName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  pmdTempBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pmdTempText: { fontSize: 12, fontWeight: '700' },
  pmdCondition: { fontSize: 12, marginBottom: 2 },
  pmdHumidity: { fontSize: 11 },
  pmdForecastDays: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 8 },
  pmdDayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  pmdDayLabel: { fontSize: 11, flex: 1 },
  pmdDayCondition: { fontSize: 11, flex: 2, textAlign: 'center' },
  pmdDayTemp: { fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },

  /* Motorway Cards */
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  routeSubtitle: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  roadEmoji: { fontSize: 22, marginRight: 10 },
  routeTitleWrap: { flex: 1 },
  motorwayName: { fontSize: typography.subtitle, fontWeight: '600', flexShrink: 1 },
  routeBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  routeKindBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
  routeKindText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeMetaText: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  chevron: { fontSize: 14, marginLeft: 8 },
  expandedContent: { paddingHorizontal: 16, paddingBottom: 12 },
  routeSourceText: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  routeAlertNote: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  routeAlertTitle: { fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAlertBody: { fontSize: 12, lineHeight: 18, marginBottom: 4 },
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
