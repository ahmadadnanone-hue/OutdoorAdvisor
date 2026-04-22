import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
  StyleSheet,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';

function openInApp(url) {
  WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'close',
    readerMode: false,
  }).catch(() => WebBrowser.openBrowserAsync(url));
}

import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { TRAVEL_ROUTES } from '../data/cities';
import { fetchWeatherForLocation } from '../hooks/useWeather';
import { fetchAqiForLocation } from '../hooks/useAQI';
import { getWeatherDescription } from '../utils/weatherCodes';
import { fetchApiJson } from '../config/api';
import { fetchNhmpDirect } from '../utils/nhmpParser';
import { loadStoredNotifications } from '../utils/alertPreferences';
import { maybeSendLocalAlert } from '../utils/alertNotifications';
import useAiBriefing from '../hooks/useAiBriefing';
import useTouristWeather from '../hooks/useTouristWeather';

import { ScreenGradient } from '../components/layout';
import { GlassCard } from '../components/glass';
import { AdvisorySourceCard, TravelSnapshotCard } from '../components/cards';
import Icon, { ICON } from '../components/Icon';
import { colors as dc, typography, statusColor } from '../design';

const NHMP_REFRESH_MS = 5 * 60 * 1000;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SEVERITY_CONFIG = {
  closed: { color: dc.accentRed,    tint: dc.dangerGlass,  stroke: dc.dangerStroke,  label: 'CLOSED'   },
  fog:    { color: dc.accentOrange, tint: dc.warningGlass, stroke: dc.warningStroke, label: 'FOG'      },
  rain:   { color: dc.accentBlue,   tint: dc.infoGlass,    stroke: dc.infoStroke,    label: 'RAIN'     },
  warning:{ color: dc.accentYellow, tint: dc.warningGlass, stroke: dc.warningStroke, label: 'ADVISORY' },
  cloudy: { color: dc.textSecondary,tint: dc.cardGlass,    stroke: dc.cardStroke,    label: 'CLOUDY'   },
  clear:  { color: dc.accentGreen,  tint: dc.successGlass, stroke: dc.successStroke, label: 'CLEAR'    },
};

const PMD_SEVERITY_MAP = {
  severe: { color: dc.accentRed,    bg: dc.dangerGlass  },
  rain:   { color: dc.accentBlue,   bg: dc.infoGlass    },
  fog:    { color: dc.accentOrange, bg: dc.warningGlass },
  cloudy: { color: dc.textSecondary,bg: dc.cardGlass    },
  clear:  { color: dc.accentGreen,  bg: dc.successGlass },
  other:  { color: dc.textMuted,    bg: dc.cardGlass    },
};

const ROUTE_ALERT_KEYWORDS = {
  E35:   ['hazara','mansehra','abbottabad','haripur','burhan'],
  KKH:   ['karakoram','gilgit','chilas','besham','mansehra','abbottabad'],
  N15:   ['naran','kaghan','balakot','babusar','mansehra'],
  MURREE:['murree','bhurban','patriata','kohala'],
  SWAT:  ['swat','mingora','kalam','malakand','mardan'],
};

const NHMP_ROUTE_ALIASES = {
  M1: ['m1','peshawar-islamabad','peshawar to islamabad','islamabad to peshawar'],
  M2: ['m2','islamabad-lahore','islamabad to lahore','lahore to islamabad'],
  M3: ['m3','lahore-abdul hakam','lahore to abdul hakam','abdul hakam to lahore'],
  M4: ['m4','abdul hakam-multan','abdul hakam to multan','multan to abdul hakam'],
  M5: ['m5','multan-sukkur','multan to sukkur','sukkur to multan'],
  M9: ['m9','karachi-hyderabad','karachi to hyderabad','hyderabad to karachi'],
};

function getTravelRiskSummary({ nhmpData, pmdAlerts }) {
  const closures = nhmpData.filter((item) => item.severity === 'closed');
  const fog = nhmpData.filter((item) => item.severity === 'fog');
  const warnings = nhmpData.filter((item) => item.severity === 'warning' || item.severity === 'rain');
  const northernAlerts = pmdAlerts.filter((alert) =>
    /(murree|naran|kaghan|swat|gilgit|hazara|karakoram|abbottabad|mansehra)/i.test(String(alert))
  );

  if (closures.length > 0) {
    return {
      level: 'high',
      label: 'High travel caution',
      body: `${closures.length} official closure alert${closures.length > 1 ? 's are' : ' is'} active right now. Recheck NHMP before motorway travel.`,
      stats: [
        { label: 'Closures', value: closures.length },
        fog.length ? { label: 'Fog', value: fog.length } : null,
        northernAlerts.length ? { label: 'PMD Alerts', value: northernAlerts.length } : null,
      ].filter(Boolean),
    };
  }

  if (fog.length > 0 || northernAlerts.length > 0 || warnings.length > 0) {
    return {
      level: 'elevated',
      label: 'Go with care',
      body: fog.length
        ? 'Fog or visibility advisories are active. Slow down and keep extra margin.'
        : northernAlerts.length
        ? 'PMD flagging weather risk on northern corridors. Route timing matters.'
        : 'Live travel advisories worth checking before a longer drive.',
      stats: [
        fog.length ? { label: 'Fog', value: fog.length } : null,
        warnings.length ? { label: 'Advisories', value: warnings.length } : null,
        northernAlerts.length ? { label: 'PMD Alerts', value: northernAlerts.length } : null,
      ].filter(Boolean),
    };
  }

  return {
    level: 'calm',
    label: 'Routes mostly clear',
    body: 'No major closure or fog alert in official feeds. Check a specific corridor below before you leave.',
    stats: [
      { label: 'NHMP', value: 'Quiet' },
      { label: 'PMD Alerts', value: pmdAlerts.length },
    ],
  };
}

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
    if (advisory) return 'NHMP advisory matched. Live stop weather/AQI and PMD context included.';
    return 'Live stop weather/AQI with PMD context. No NHMP-specific entry in latest feed.';
  }
  if (matchedAlerts.length > 0) return 'Live stop weather/AQI plus PMD regional alerts for this corridor.';
  return 'Live stop weather/AQI along route stops. No PMD route-specific alert in latest feed.';
}

function isFog(weatherCode) { return weatherCode === 45 || weatherCode === 48; }
function isRain(weatherCode) { return weatherCode >= 61 && weatherCode <= 82; }

function getStopRiskScore(stops) {
  return (stops || []).reduce((score, stop) => {
    let next = score;
    if (stop?.aqi != null) {
      if (stop.aqi >= 200) next += 18;
      else if (stop.aqi >= 150) next += 12;
      else if (stop.aqi >= 100) next += 6;
    }
    if (isFog(stop?.weatherCode)) next += 12;
    else if (isRain(stop?.weatherCode)) next += 7;
    if ((stop?.windSpeed ?? 0) >= 28) next += 5;
    return next;
  }, 0);
}

function getRouteRiskScore(route, advisory, matchedAlerts, stops) {
  let score = 0;
  if (advisory?.severity === 'closed') score += 100;
  else if (advisory?.severity === 'fog') score += 72;
  else if (advisory?.severity === 'rain') score += 54;
  else if (advisory?.severity === 'warning') score += 46;
  else if (advisory?.severity === 'clear') score -= 18;
  score += Math.min(30, (matchedAlerts?.length || 0) * 10);
  score += getStopRiskScore(stops);
  if (route.kind === 'northern') score += 4;
  return score;
}

/* ===== NHMP Advisory Card ===== */
function NHMPAdvisoryCard({ advisory }) {
  const config = SEVERITY_CONFIG[advisory.severity] || SEVERITY_CONFIG.clear;
  return (
    <GlassCard
      tintColor={config.tint}
      borderColor={config.stroke}
      contentStyle={styles.advisoryContent}
      onPress={() => openInApp('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx')}
      hapticStyle="selection"
    >
      <View style={styles.advisoryBadge}>
        <View style={[styles.severityDot, { backgroundColor: config.color }]} />
        <Text style={[styles.severityLabel, { color: config.color }]}>{config.label}</Text>
      </View>
      <Text style={styles.advisoryRoute} numberOfLines={2}>{advisory.route}</Text>
      {advisory.sector ? (
        <Text style={styles.advisorySector} numberOfLines={1}>{advisory.sector}</Text>
      ) : null}
      <Text style={[styles.advisoryStatus, { color: advisory.severity === 'clear' ? dc.textSecondary : config.color }]}>
        {advisory.status}
      </Text>
      <View style={styles.advisoryFooter}>
        <Text style={styles.advisoryHint}>Tap for official NHMP details</Text>
        <Icon name={ICON.external} size={12} color={dc.textMuted} />
      </View>
    </GlassCard>
  );
}

/* ===== Weather Stop Row ===== */
function StopRow({ stop, formatTempShort }) {
  const { description, icon } = getWeatherDescription(stop.weatherCode);
  const hasFog = isFog(stop.weatherCode);
  const hasSmog = stop.aqi != null && stop.aqi > 150;
  const hasRain = isRain(stop.weatherCode);
  const isClear = !hasFog && !hasSmog && !hasRain;

  return (
    <View style={styles.stopRow}>
      <View style={styles.stopHeader}>
        <Text style={styles.stopName}>{stop.name}</Text>
        <Text style={styles.stopTemp}>{formatTempShort(stop.temp)}</Text>
      </View>
      <Text style={styles.stopWeather}>{icon} {description}</Text>
      {stop.aqi != null && (
        <Text style={styles.aqiText}>AQI: {stop.aqi}</Text>
      )}
      <View style={styles.badgeRow}>
        {hasFog && <View style={[styles.badge, { backgroundColor: dc.warningGlass }]}><Text style={[styles.badgeText, { color: dc.accentOrange }]}>FOG RISK</Text></View>}
        {hasSmog && <View style={[styles.badge, { backgroundColor: dc.dangerGlass }]}><Text style={[styles.badgeText, { color: dc.accentRed }]}>SMOG</Text></View>}
        {hasFog && <View style={[styles.badge, { backgroundColor: dc.warningGlass }]}><Text style={[styles.badgeText, { color: dc.accentOrange }]}>Reduce to 60 km/h</Text></View>}
        {!hasFog && hasRain && <View style={[styles.badge, { backgroundColor: dc.infoGlass }]}><Text style={[styles.badgeText, { color: dc.accentBlue }]}>Reduce to 80 km/h</Text></View>}
        {isClear && <View style={[styles.badge, { backgroundColor: dc.successGlass }]}><Text style={[styles.badgeText, { color: dc.accentGreen }]}>Clear</Text></View>}
      </View>
    </View>
  );
}

/* ===== Tourist Station Card ===== */
const CONDITION_ICON = {
  'Clear':         { name: 'sunny-outline',         color: '#FCD34D' },
  'Partly Cloudy': { name: 'partly-sunny-outline',  color: '#93C5FD' },
  'Overcast':      { name: 'cloudy-outline',         color: '#94A3B8' },
  'Rain':          { name: 'rainy-outline',          color: '#60A5FA' },
  'Heavy Rain':    { name: 'thunderstorm-outline',   color: '#F87171' },
  'Drizzle':       { name: 'rainy-outline',          color: '#93C5FD' },
  'Snow':          { name: 'snow-outline',           color: '#E2E8F0' },
  'Sleet':         { name: 'rainy-outline',          color: '#CBD5E1' },
  'Thunderstorm':  { name: 'thunderstorm-outline',   color: '#F87171' },
  'Fog':           { name: 'cloud-outline',          color: '#CBD5E1' },
  'Variable':      { name: 'partly-sunny-outline',   color: '#94A3B8' },
};

function conditionMeta(condition) {
  return CONDITION_ICON[condition] || { name: 'cloud-outline', color: dc.textMuted };
}

function TouristStationCard({ station }) {
  const [expanded, setExpanded] = useState(false);
  const { current, forecast, name, region, lastUpdated } = station;
  const meta = conditionMeta(current?.condition);
  const tempStr = current?.tempC != null ? `${current.tempC}°` : '--';

  return (
    <TouchableOpacity
      style={styles.touristCard}
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((v) => !v);
      }}
      activeOpacity={0.75}
    >
      {/* Header row */}
      <View style={styles.touristCardHeader}>
        <View style={styles.touristIconWrap}>
          <Icon name={meta.name} size={20} color={meta.color} />
        </View>
        <View style={styles.touristCardBody}>
          <Text style={styles.touristName}>{name}</Text>
          <Text style={styles.touristRegion}>{region}</Text>
        </View>
        <View style={styles.touristRight}>
          <Text style={styles.touristTemp}>{tempStr}</Text>
          <Text style={styles.touristCondition} numberOfLines={1}>{current?.condition || '—'}</Text>
        </View>
      </View>

      {/* Quick stats strip */}
      <View style={styles.touristStatsRow}>
        {current?.humidity != null && (
          <View style={styles.touristStat}>
            <Icon name="water-outline" size={11} color={dc.accentCyan} />
            <Text style={styles.touristStatText}>{current.humidity}%</Text>
          </View>
        )}
        {current?.windKph != null && (
          <View style={styles.touristStat}>
            <Icon name="navigate-outline" size={11} color={dc.accentCyan} />
            <Text style={styles.touristStatText}>{current.windKph} km/h</Text>
          </View>
        )}
        {current?.visibilityKm != null && (
          <View style={styles.touristStat}>
            <Icon name="eye-outline" size={11} color={dc.accentCyan} />
            <Text style={styles.touristStatText}>{current.visibilityKm} km</Text>
          </View>
        )}
        {!!lastUpdated && (
          <Text style={styles.touristUpdated}>{lastUpdated}</Text>
        )}
      </View>

      {/* Expanded 3-day forecast */}
      {expanded && forecast && forecast.length > 0 && (
        <View style={styles.touristForecast}>
          <View style={styles.touristForecastDivider} />
          {forecast.map((day, i) => {
            const dayMeta = conditionMeta(day.condition);
            return (
              <View key={i} style={styles.touristForecastRow}>
                <Text style={styles.touristForecastDay}>{day.day}</Text>
                <Icon name={dayMeta.name} size={13} color={dayMeta.color} />
                <Text style={styles.touristForecastCondition} numberOfLines={1}>{day.condition}</Text>
                <Text style={styles.touristForecastRange}>
                  {day.minTemp != null ? `${day.minTemp}–${day.maxTemp}°` : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ===== Main Screen ===== */
export default function TravelScreen({ route }) {
  const { formatTempShort } = useSettings();
  const { isPremium } = useAuth();
  const [expandedMotorway, setExpandedMotorway] = useState(null);
  const [stopData, setStopData] = useState({});
  const fetchingRef = useRef({});
  const nhmpCancelRef = useRef(false);
  const scrollRef = useRef(null);
  const routeOffsetsRef = useRef({});

  const [nhmpData, setNhmpData] = useState([]);
  const [nhmpLoading, setNhmpLoading] = useState(true);
  const [nhmpRefreshing, setNhmpRefreshing] = useState(false);
  const [nhmpTime, setNhmpTime] = useState(null);
  const [nhmpStale, setNhmpStale] = useState(false);
  const [nhmpError, setNhmpError] = useState(false);
  const [nhmpAlertsExpanded, setNhmpAlertsExpanded] = useState(false);

  const [pmdCities, setPmdCities] = useState([]);
  const [pmdAlerts, setPmdAlerts] = useState([]);
  const [pmdLoading, setPmdLoading] = useState(true);
  const [pmdTime, setPmdTime] = useState(null);
  const [pmdBlocked, setPmdBlocked] = useState(false);
  const [pmdSectionExpanded, setPmdSectionExpanded] = useState(false);
  const [expandedPmdCity, setExpandedPmdCity] = useState(null);
  const [pmdAlertsExpanded, setPmdAlertsExpanded] = useState(false);

  const loadNhmp = useCallback(async ({ silent = false } = {}) => {
    if (!silent && nhmpData.length > 0) setNhmpRefreshing(true);
    try {
      let json;
      if (Platform.OS === 'web') {
        json = await fetchApiJson('/api/nhmp');
      } else {
        try { json = await fetchNhmpDirect(); }
        catch { json = await fetchApiJson('/api/nhmp'); }
      }
      if (nhmpCancelRef.current) return;
      if (json.success && Array.isArray(json.advisories) && json.advisories.length > 0) {
        setNhmpData(json.advisories);
        setNhmpTime(json.timestamp);
        setNhmpStale(Boolean(json.stale));
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
    const nhmpInterval = setInterval(() => loadNhmp({ silent: true }), NHMP_REFRESH_MS);

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

  useEffect(() => {
    let cancelled = false;
    if (!nhmpData.length && !pmdAlerts.length) return undefined;
    (async () => {
      const prefs = await loadStoredNotifications();
      if (cancelled) return;
      if (isPremium && prefs.routeClosureAlerts) {
        const closure = nhmpData.find((item) => item.severity === 'closed');
        if (closure) {
          maybeSendLocalAlert('nhmp-route-closure', {
            title: 'Major route closure',
            body: closure.route
              ? `${closure.route} has an active closure advisory. Check NHMP before you leave.`
              : 'An important route closure advisory is active. Check NHMP before you leave.',
            url: 'https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx',
          });
        }
      }
      if (isPremium && prefs.fogWarnings) {
        const fogAlert = nhmpData.find((item) => item.severity === 'fog');
        if (fogAlert) {
          maybeSendLocalAlert('nhmp-fog-warning', {
            title: 'Motorway fog warning',
            body: fogAlert.route
              ? `${fogAlert.route} has fog-related visibility risk. Drive slower and leave extra margin.`
              : 'A motorway fog advisory is active. Drive slower and leave extra margin.',
            url: 'https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx',
          });
        }
      }
      if (isPremium && prefs.routeClosureAlerts && pmdAlerts.length > 0) {
        const northernAlert = pmdAlerts.find((alert) =>
          /(murree|naran|kaghan|swat|gilgit|hazara|karakoram|abbottabad|mansehra)/i.test(String(alert))
        );
        if (northernAlert) {
          maybeSendLocalAlert('pmd-corridor-alert', {
            title: 'Northern route weather alert',
            body: String(northernAlert).slice(0, 180),
            url: 'https://nwfc.pmd.gov.pk/',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isPremium, nhmpData, pmdAlerts]);

  const loadRouteStops = useCallback(async (routeIndex) => {
    if (stopData[routeIndex] || fetchingRef.current[routeIndex]) return;
    fetchingRef.current[routeIndex] = true;
    const motorway = TRAVEL_ROUTES[routeIndex];
    try {
      const results = await Promise.all(
        motorway.stops.map(async (stop) => {
          const weather = await fetchWeatherForLocation(stop.lat, stop.lon);
          let aqiData = { aqi: null };
          try { aqiData = await fetchAqiForLocation(stop.lat, stop.lon); } catch {}
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
      setStopData((prev) => ({ ...prev, [routeIndex]: results }));
    } catch {
      setStopData((prev) => ({ ...prev, [routeIndex]: [] }));
    } finally {
      fetchingRef.current[routeIndex] = false;
    }
  }, [stopData]);

  const toggleMotorway = useCallback(async (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedMotorway === index) { setExpandedMotorway(null); return; }
    setExpandedMotorway(index);
    if (isPremium) loadRouteStops(index);
  }, [expandedMotorway, isPremium, loadRouteStops]);

  useEffect(() => {
    const highlightRoute = route?.params?.highlightRoute;
    const requestKey = route?.params?.requestKey;
    if (!highlightRoute || !requestKey) return;
    const routeIndex = TRAVEL_ROUTES.findIndex((item) => item.id === highlightRoute);
    if (routeIndex === -1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMotorway(routeIndex);
    if (isPremium) loadRouteStops(routeIndex);
    const timer = setTimeout(() => {
      const y = routeOffsetsRef.current[routeIndex];
      if (scrollRef.current && typeof y === 'number') {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [route?.params?.highlightRoute, route?.params?.requestKey, isPremium, loadRouteStops]);

  const isLoading = (index) => expandedMotorway === index && !stopData[index];

  const activeAlerts = nhmpData.filter((a) => a.severity !== 'clear');
  const clearRoutes = nhmpData.filter((a) => a.severity === 'clear');
  const travelSummary = getTravelRiskSummary({ nhmpData, pmdAlerts });

  const focusRoute =
    expandedMotorway != null
      ? TRAVEL_ROUTES[expandedMotorway]
      : route?.params?.highlightRoute
      ? TRAVEL_ROUTES.find((item) => item.id === route.params.highlightRoute) || null
      : null;
  const focusRouteStops =
    focusRoute != null
      ? stopData[TRAVEL_ROUTES.findIndex((item) => item.id === focusRoute.id)] || []
      : [];

  const travelAiPayload = useMemo(() => ({
    summaryLabel: travelSummary.label,
    closureCount: activeAlerts.filter((item) => item.severity === 'closed').length,
    fogCount: activeAlerts.filter((item) => item.severity === 'fog').length,
    advisoryCount: activeAlerts.length,
    clearRouteCount: clearRoutes.length,
    pmdAlertCount: pmdAlerts.length,
    pmdAlerts: pmdAlerts.slice(0, 3),
    focusRoute: focusRoute ? {
      id: focusRoute.id, name: focusRoute.name, kind: focusRoute.kind,
      stops: focusRouteStops.slice(0, 4).map((stop) => ({
        name: stop.name, temp: stop.temp, aqi: stop.aqi, windSpeed: stop.windSpeed,
        humidity: stop.humidity, weatherLabel: getWeatherDescription(stop.weatherCode).description,
      })),
    } : null,
  }), [travelSummary.label, activeAlerts, clearRoutes.length, pmdAlerts, focusRoute, focusRouteStops]);

  const travelAiSignature = useMemo(() => [
    travelSummary.label,
    activeAlerts.map((item) => `${item.severity}:${item.route || item.status}`).join('|'),
    clearRoutes.length,
    pmdAlerts.slice(0, 3).join('|'),
    focusRoute?.id || 'all',
    focusRouteStops.map((stop) => `${stop.name}:${stop.temp}:${stop.aqi}:${stop.weatherCode}`).join('|'),
  ].join('||'), [travelSummary.label, activeAlerts, clearRoutes.length, pmdAlerts, focusRoute?.id, focusRouteStops]);

  const { data: travelAiBriefing, loading: travelAiLoading } = useAiBriefing({
    kind: 'travel',
    signature: travelAiSignature,
    payload: travelAiPayload,
    enabled: isPremium && (nhmpData.length > 0 || pmdAlerts.length > 0),
  });

  const { stations: touristStations, bulletin: touristBulletin, loading: touristLoading, refresh: refreshTourist } = useTouristWeather();
  const [touristExpanded, setTouristExpanded] = useState(true);

  const sortedRoutes = useMemo(() =>
    TRAVEL_ROUTES.map((r, sourceIndex) => {
      const matchedAdvisory = r.kind === 'motorway' ? findNhmpRouteMatch(r, nhmpData) : null;
      const matchedPmdAlerts = findRelevantPmdAlerts(r, pmdAlerts);
      const stops = stopData[sourceIndex] || [];
      return { route: r, sourceIndex, matchedAdvisory, matchedPmdAlerts,
        riskScore: getRouteRiskScore(r, matchedAdvisory, matchedPmdAlerts, stops) };
    }).sort((a, b) => b.riskScore - a.riskScore || a.route.name.localeCompare(b.route.name)),
  [nhmpData, pmdAlerts, stopData]);

  const nhmpStatus =
    nhmpLoading ? 'unknown'
    : nhmpError ? 'unknown'
    : activeAlerts.length > 0 ? (activeAlerts.some((a) => a.severity === 'closed') ? 'danger' : 'caution')
    : 'ok';

  const pmdStatus =
    pmdLoading ? 'unknown'
    : pmdBlocked ? 'unknown'
    : pmdAlerts.length > 0 ? 'caution'
    : 'ok';

  const nhmpTimestamp = nhmpTime
    ? nhmpStale
      ? `Last known: ${new Date(nhmpTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}, ${new Date(nhmpTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : `Updated ${new Date(nhmpTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    : null;

  return (
    <ScreenGradient>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Screen header */}
          <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>Road Intelligence</Text>
            <Text style={styles.screenSubtitle}>Based on latest available advisories</Text>
          </View>

          {/* Travel snapshot */}
          <TravelSnapshotCard
            level={travelSummary.level}
            title={travelSummary.label}
            body={travelSummary.body}
            stats={travelSummary.stats}
          />

          {/* Advisory sources row */}
          <View style={styles.advisoryRow}>
            <View style={styles.advisoryHalf}>
              <AdvisorySourceCard
                name="NHMP"
                title={
                  nhmpLoading ? 'Loading...'
                  : nhmpError ? 'Unavailable'
                  : activeAlerts.length > 0
                    ? `${activeAlerts.length} route${activeAlerts.length > 1 ? 's' : ''} to review`
                    : 'All clear'
                }
                subtitle={
                  nhmpLoading ? null
                  : nhmpError ? 'Check NHMP directly'
                  : clearRoutes.length > 0 ? `${clearRoutes.length} route${clearRoutes.length > 1 ? 's' : ''} clear` : null
                }
                status={nhmpStatus}
                onPress={() => openInApp('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx')}
              />
            </View>
            <View style={styles.advisoryHalf}>
              <AdvisorySourceCard
                name="PMD"
                title={
                  pmdLoading ? 'Loading...'
                  : pmdBlocked ? 'Unavailable'
                  : pmdAlerts.length > 0
                    ? `${pmdAlerts.length} active alert${pmdAlerts.length > 1 ? 's' : ''}`
                    : `${pmdCities.length} cities`
                }
                subtitle={
                  pmdLoading || pmdBlocked ? null
                  : nhmpTimestamp
                }
                status={pmdStatus}
                onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/3-days-forecast.php')}
              />
            </View>
          </View>

          {/* NHMP Live Advisories */}
          <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>NHMP LIVE ADVISORIES</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity onPress={() => loadNhmp()} disabled={nhmpRefreshing} activeOpacity={0.7}>
                  <Text style={[styles.sectionLink, nhmpRefreshing && { opacity: 0.5 }]}>
                    {nhmpRefreshing ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openInApp('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx')} activeOpacity={0.7}>
                  <Text style={styles.sectionLink}>View Full</Text>
                </TouchableOpacity>
              </View>
            </View>

            {nhmpLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={dc.accentCyan} />
                <Text style={styles.loadingText}>Loading NHMP data...</Text>
              </View>
            ) : nhmpError ? (
              <Text style={styles.errorText}>Could not load NHMP data. Tap "View Full" to check directly.</Text>
            ) : (
              <>
                {activeAlerts.length > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setNhmpAlertsExpanded((v) => !v);
                    }}
                    style={styles.collapseToggle}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.collapseEyebrow}>Live advisories</Text>
                      <Text style={styles.collapseTitle}>
                        {activeAlerts.length} route{activeAlerts.length > 1 ? 's' : ''} to review first
                      </Text>
                    </View>
                    <Icon
                      name={nhmpAlertsExpanded ? ICON.chevronUp : ICON.chevronDown}
                      size={16}
                      color={dc.textMuted}
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.allClearRow}>
                    <Icon name={ICON.success} size={16} color={dc.accentGreen} />
                    <Text style={styles.allClearText}>All routes reporting clear conditions</Text>
                  </View>
                )}
                {nhmpAlertsExpanded && activeAlerts.map((a, i) => (
                  <NHMPAdvisoryCard key={`alert-${i}`} advisory={a} />
                ))}
                {clearRoutes.length > 0 && (
                  <Text style={styles.clearCount}>{clearRoutes.length} route{clearRoutes.length > 1 ? 's' : ''} clear</Text>
                )}
              </>
            )}
          </GlassCard>

          {/* PMD Section */}
          <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>PMD OFFICIAL FORECAST</Text>
              <TouchableOpacity onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/3-days-forecast.php')} activeOpacity={0.7}>
                <Text style={styles.sectionLink}>View Full</Text>
              </TouchableOpacity>
            </View>

            {pmdLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={dc.accentCyan} />
                <Text style={styles.loadingText}>Loading PMD data...</Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setPmdSectionExpanded((v) => !v);
                }}
                style={styles.collapseToggle}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.collapseEyebrow}>Official forecast</Text>
                  <Text style={styles.collapseTitle}>
                    {pmdBlocked
                      ? 'Live data temporarily unavailable'
                      : `${pmdCities.length} cities · ${pmdAlerts.length} alert${pmdAlerts.length === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <Icon
                  name={pmdSectionExpanded ? ICON.chevronUp : ICON.chevronDown}
                  size={16}
                  color={dc.textMuted}
                />
              </TouchableOpacity>
            )}

            {pmdSectionExpanded && !pmdLoading && (
              pmdBlocked ? (
                <View style={styles.pmdBlockedWrap}>
                  <Text style={styles.pmdBlockedBody}>
                    Live data temporarily unavailable. Tap the links to view directly.
                  </Text>
                  <View style={styles.pmdLinksRow}>
                    <TouchableOpacity
                      style={[styles.pmdLinkBtn, { backgroundColor: dc.infoGlass }]}
                      onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/3-days-forecast.php')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pmdLinkText, { color: dc.accentBlue }]}>3-Day Forecast</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pmdLinkBtn, { backgroundColor: dc.dangerGlass }]}
                      onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/daily-forecast-en.php')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pmdLinkText, { color: dc.accentRed }]}>Weather Alerts</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {pmdAlerts.length > 0 && (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setPmdAlertsExpanded((v) => !v);
                        }}
                        style={[styles.pmdAlertBanner]}
                      >
                        <Icon name={ICON.danger} size={18} color={dc.accentRed} />
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={styles.pmdAlertTitle}>Weather alerts</Text>
                          <Text style={styles.pmdAlertSubtitle}>
                            {pmdAlerts.length} active PMD alert{pmdAlerts.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                        <Icon
                          name={pmdAlertsExpanded ? ICON.chevronUp : ICON.chevronDown}
                          size={14}
                          color={dc.accentRed}
                        />
                      </TouchableOpacity>
                      {pmdAlertsExpanded && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/daily-forecast-en.php')}
                          style={styles.pmdAlertDetails}
                        >
                          {pmdAlerts.slice(0, 5).map((alert, i) => (
                            <Text key={i} style={styles.pmdAlertItem}>{alert}</Text>
                          ))}
                          <Text style={styles.advisoryHint}>Tap for official PMD alert details</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  <View style={styles.pmdCityGrid}>
                    {pmdCities.map((city, i) => {
                      const isExpanded = expandedPmdCity === i;
                      const today = city.forecast[0];
                      const sev = PMD_SEVERITY_MAP[today?.severity] || PMD_SEVERITY_MAP.other;
                      return (
                        <TouchableOpacity
                          key={city.city}
                          style={[styles.pmdCityCard, { backgroundColor: dc.cardGlass, borderColor: dc.cardStrokeSoft }]}
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setExpandedPmdCity(isExpanded ? null : i);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.pmdCityHeader}>
                            <Text style={styles.pmdCityName}>{city.city}</Text>
                            <View style={[styles.pmdTempBadge, { backgroundColor: sev.bg }]}>
                              <Text style={[styles.pmdTempText, { color: sev.color }]}>
                                {today ? `${today.minTemp}-${today.maxTemp}` : '--'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.pmdCondition}>{today?.condition || 'N/A'}</Text>
                          {city.humidity ? <Text style={styles.pmdHumidity}>Humidity: {city.humidity}</Text> : null}
                          {isExpanded && city.forecast.length > 1 && (
                            <View style={styles.pmdForecastDays}>
                              {city.forecast.map((day, di) => {
                                const daySev = PMD_SEVERITY_MAP[day.severity] || PMD_SEVERITY_MAP.other;
                                return (
                                  <View key={di} style={styles.pmdDayRow}>
                                    <Text style={styles.pmdDayLabel}>{day.date}</Text>
                                    <Text style={styles.pmdDayCondition}>{day.condition}</Text>
                                    <Text style={[styles.pmdDayTemp, { color: daySev.color }]}>{day.minTemp}-{day.maxTemp}</Text>
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
              )
            )}
          </GlassCard>

          {/* AI Trip Insight */}
          <GlassCard contentStyle={styles.aiContent}>
            <Text style={styles.aiEyebrow}>TRIP INSIGHT</Text>
            <Text style={styles.aiTitle}>
              {!isPremium
                ? 'Upgrade for AI trip insight with a smarter route read before you leave.'
                : travelAiLoading && !travelAiBriefing
                ? 'Writing a quick route read...'
                : travelAiBriefing?.headline || 'Live route guidance will appear here.'}
            </Text>
            {!!travelAiBriefing?.summary && (
              <Text style={styles.aiBody}>{travelAiBriefing.summary}</Text>
            )}
            {!!travelAiBriefing?.tip && (
              <Text style={styles.aiTip}>{travelAiBriefing.tip}</Text>
            )}
          </GlassCard>

          {/* Tourist Destinations */}
          <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setTouristExpanded((v) => !v);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sectionEyebrow}>PMD TOURIST STATIONS</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity
                  onPress={() => refreshTourist({ force: true })}
                  disabled={touristLoading}
                  activeOpacity={0.7}
                  hitSlop={8}
                >
                  <Text style={[styles.sectionLink, touristLoading && { opacity: 0.4 }]}>
                    {touristLoading ? 'Loading...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
                <Icon
                  name={touristExpanded ? ICON.chevronUp : ICON.chevronDown}
                  size={14}
                  color={dc.textMuted}
                />
              </View>
            </TouchableOpacity>

            {!!touristBulletin && touristExpanded && (
              <Text style={styles.touristBulletin} numberOfLines={3}>{touristBulletin}</Text>
            )}

            {touristLoading && touristStations.length === 0 ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={dc.accentCyan} />
                <Text style={styles.loadingText}>Loading station data...</Text>
              </View>
            ) : touristExpanded ? (
              <View style={styles.touristGrid}>
                {touristStations.map((station) => (
                  <TouristStationCard key={station.id} station={station} />
                ))}
                {touristStations.length === 0 && !touristLoading && (
                  <Text style={styles.noDataText}>Station data unavailable. Tap Refresh to retry.</Text>
                )}
              </View>
            ) : null}
          </GlassCard>

          {/* Route cards */}
          <Text style={styles.routesTitle}>Weather Along Major Routes</Text>
          <Text style={styles.routesSubtitle}>Motorways, northern highways, and mountain corridors.</Text>

          {sortedRoutes.map(({ route: motorway, sourceIndex, matchedAdvisory, matchedPmdAlerts, riskScore }) => {
            const isExpanded = expandedMotorway === sourceIndex;
            const sourceSummary = getRouteSourceSummary(motorway, matchedAdvisory, matchedPmdAlerts);
            const hasAlert = matchedAdvisory?.severity === 'closed' || matchedPmdAlerts.length > 0;
            const tintColor = hasAlert ? dc.dangerGlass : dc.cardGlass;
            const borderColor = hasAlert ? dc.dangerStroke : dc.cardStroke;

            const badgeColor =
              matchedAdvisory?.severity === 'closed' ? dc.accentRed
              : matchedAdvisory?.severity === 'fog' ? dc.accentOrange
              : matchedPmdAlerts.length > 0 ? dc.accentRed
              : dc.accentCyan;

            const badgeLabel =
              matchedAdvisory
                ? (SEVERITY_CONFIG[matchedAdvisory.severity]?.label || 'NHMP')
                : matchedPmdAlerts.length > 0
                ? 'PMD ALERT'
                : 'STOP SCAN';

            return (
              <GlassCard
                key={motorway.id}
                tintColor={tintColor}
                borderColor={borderColor}
                contentStyle={styles.routeCardContent}
                style={styles.routeCard}
                onLayout={(event) => {
                  routeOffsetsRef.current[sourceIndex] = event.nativeEvent.layout.y;
                }}
              >
                <TouchableOpacity
                  style={styles.routeCardHeader}
                  onPress={() => toggleMotorway(sourceIndex)}
                  activeOpacity={0.7}
                >
                  <View style={styles.routeEmoji}>
                    <Icon name={motorway.icon || 'car-outline'} size={26} color={dc.accentCyan} />
                  </View>
                  <View style={styles.routeTitleWrap}>
                    <Text style={styles.routeName}>{motorway.name}</Text>
                    <View style={styles.routeBadgeRow}>
                      <View style={[styles.routeBadge, { backgroundColor: dc.cardGlassStrong }]}>
                        <Text style={[styles.routeBadgeText, { color: dc.textMuted }]}>Risk {riskScore}</Text>
                      </View>
                      <View style={[styles.routeBadge, { backgroundColor: dc.cardGlassStrong }]}>
                        <Text style={[styles.routeBadgeText, { color: dc.textSecondary }]}>{motorway.kind || 'route'}</Text>
                      </View>
                      <View style={[styles.routeBadge, { backgroundColor: `${badgeColor}22` }]}>
                        <Text style={[styles.routeBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                      </View>
                    </View>
                    {matchedAdvisory?.status ? (
                      <Text style={[styles.routeMeta, { color: matchedAdvisory.severity === 'clear' ? dc.textSecondary : dc.accentRed }]} numberOfLines={2}>
                        {matchedAdvisory.status}
                      </Text>
                    ) : matchedPmdAlerts[0] ? (
                      <Text style={styles.routeMeta} numberOfLines={2}>PMD: {matchedPmdAlerts[0]}</Text>
                    ) : null}
                  </View>
                  <Icon
                    name={isExpanded ? ICON.chevronUp : ICON.chevronDown}
                    size={16}
                    color={dc.textMuted}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.routeExpanded}>
                    <View style={styles.routeDivider} />
                    <Text style={styles.routeSourceText}>{sourceSummary}</Text>
                    {!isPremium ? (
                      <View style={styles.premiumGate}>
                        <Icon name={ICON.premium} size={18} color={dc.accentCyan} />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={styles.premiumTitle}>Premium route scan</Text>
                          <Text style={styles.premiumBody}>
                            Unlock stop-by-stop weather, AQI, and route-level scan details for this corridor.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        {matchedPmdAlerts.length > 0 && (
                          <View style={styles.routeAlertNote}>
                            <Text style={styles.routeAlertTitle}>PMD NOTE</Text>
                            {matchedPmdAlerts.slice(0, 2).map((alert, alertIndex) => (
                              <Text key={`${motorway.id}-alert-${alertIndex}`} style={styles.routeAlertBody}>{alert}</Text>
                            ))}
                          </View>
                        )}
                        {isLoading(sourceIndex) ? (
                          <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={dc.accentCyan} />
                            <Text style={styles.loadingText}>Fetching conditions...</Text>
                          </View>
                        ) : stopData[sourceIndex] && stopData[sourceIndex].length > 0 ? (
                          stopData[sourceIndex].map((stop, i) => (
                            <StopRow key={`${motorway.id}-${i}`} stop={stop} formatTempShort={formatTempShort} />
                          ))
                        ) : (
                          <Text style={styles.noDataText}>Unable to load conditions. Collapse and try again.</Text>
                        )}
                      </>
                    )}
                  </View>
                )}
              </GlassCard>
            );
          })}

          <Text style={styles.footer}>Conditions may change. Recheck before departure.</Text>
        </ScrollView>
      </SafeAreaView>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40, gap: 14 },

  screenHeader: { marginBottom: 4 },
  screenTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: dc.textPrimary,
    letterSpacing: -0.8,
  },
  screenSubtitle: {
    fontSize: 13,
    color: dc.textMuted,
    marginTop: 4,
  },

  advisoryRow: { flexDirection: 'row', gap: 12 },
  advisoryHalf: { flex: 1 },

  sectionCard: {},
  sectionContent: { padding: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: dc.textMuted,
    letterSpacing: 1.8,
  },
  sectionActions: { flexDirection: 'row', gap: 14 },
  sectionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: dc.accentCyan,
  },

  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 10 },
  loadingText: { fontSize: 13, color: dc.textSecondary },
  errorText: { fontSize: 13, color: dc.textSecondary, textAlign: 'center', paddingVertical: 12 },

  collapseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dc.cardGlassStrong,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  collapseEyebrow: { fontSize: 10, fontWeight: '700', color: dc.textMuted, letterSpacing: 0.5, marginBottom: 3 },
  collapseTitle: { fontSize: 14, fontWeight: '700', color: dc.textPrimary },

  allClearRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  allClearText: { fontSize: 15, fontWeight: '600', color: dc.accentGreen },
  clearCount: { fontSize: 12, color: dc.textMuted, marginTop: 8, textAlign: 'center' },

  advisoryContent: { padding: 16 },
  advisoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  advisoryRoute: { fontSize: 14, fontWeight: '700', color: dc.textPrimary, marginBottom: 2 },
  advisorySector: { fontSize: 12, color: dc.textSecondary, marginBottom: 4 },
  advisoryStatus: { fontSize: 12, lineHeight: 18 },
  advisoryFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  advisoryHint: { fontSize: 11, color: dc.textMuted, fontWeight: '600' },

  pmdBlockedWrap: { marginTop: 10 },
  pmdBlockedBody: { fontSize: 13, color: dc.textSecondary, marginBottom: 12, lineHeight: 19 },
  pmdLinksRow: { flexDirection: 'row', gap: 10 },
  pmdLinkBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  pmdLinkText: { fontSize: 13, fontWeight: '700' },

  pmdAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dc.dangerGlass,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  pmdAlertTitle: { fontSize: 12, fontWeight: '800', color: dc.accentRed, letterSpacing: 0.5, textTransform: 'uppercase' },
  pmdAlertSubtitle: { fontSize: 12, color: dc.textSecondary, marginTop: 2 },
  pmdAlertDetails: { backgroundColor: dc.dangerGlass, borderRadius: 12, padding: 12, marginTop: 4 },
  pmdAlertItem: { fontSize: 12, color: dc.textSecondary, lineHeight: 17, marginBottom: 4 },

  pmdCityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  pmdCityCard: { borderWidth: 1, borderRadius: 14, padding: 12, width: '48%', minWidth: 140 },
  pmdCityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pmdCityName: { fontSize: 13, fontWeight: '700', color: dc.textPrimary, flexShrink: 1 },
  pmdTempBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  pmdTempText: { fontSize: 11, fontWeight: '700' },
  pmdCondition: { fontSize: 12, color: dc.textSecondary, marginBottom: 2 },
  pmdHumidity: { fontSize: 11, color: dc.textMuted },
  pmdForecastDays: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dc.cardStrokeSoft, marginTop: 8, paddingTop: 8 },
  pmdDayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  pmdDayLabel: { fontSize: 11, color: dc.textMuted, flex: 1 },
  pmdDayCondition: { fontSize: 11, color: dc.textSecondary, flex: 2, textAlign: 'center' },
  pmdDayTemp: { fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },

  aiContent: { padding: 20 },
  aiEyebrow: { fontSize: 11, fontWeight: '800', color: dc.accentCyan, letterSpacing: 1.8, marginBottom: 10 },
  aiTitle: { fontSize: 17, fontWeight: '700', color: dc.textPrimary, lineHeight: 24, marginBottom: 8 },
  aiBody: { fontSize: 14, color: dc.textSecondary, lineHeight: 21, marginBottom: 8 },
  aiTip: { fontSize: 13, fontWeight: '600', color: dc.textPrimary, lineHeight: 19 },

  routesTitle: { fontSize: 22, fontWeight: '800', color: dc.textPrimary, letterSpacing: -0.4, marginTop: 8 },
  routesSubtitle: { fontSize: 13, color: dc.textSecondary, marginBottom: 4, lineHeight: 18 },

  routeCard: {},
  routeCardContent: { padding: 0 },
  routeCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  routeEmoji: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(155,200,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  routeTitleWrap: { flex: 1 },
  routeName: { fontSize: 16, fontWeight: '700', color: dc.textPrimary, flexShrink: 1 },
  routeBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  routeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  routeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeMeta: { fontSize: 12, color: dc.textSecondary, marginTop: 6, lineHeight: 18 },

  routeExpanded: { paddingHorizontal: 18, paddingBottom: 16 },
  routeDivider: { height: 1, backgroundColor: dc.cardStrokeSoft, marginBottom: 12 },
  routeSourceText: { fontSize: 12, color: dc.textMuted, lineHeight: 18, marginBottom: 10 },

  routeAlertNote: { backgroundColor: dc.dangerGlass, borderRadius: 12, padding: 12, marginBottom: 12 },
  routeAlertTitle: { fontSize: 10, fontWeight: '800', color: dc.accentRed, letterSpacing: 1, marginBottom: 6 },
  routeAlertBody: { fontSize: 12, color: dc.textSecondary, lineHeight: 18, marginBottom: 4 },

  premiumGate: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: dc.infoGlass, borderRadius: 14, padding: 14 },
  premiumTitle: { fontSize: 14, fontWeight: '700', color: dc.textPrimary, marginBottom: 4 },
  premiumBody: { fontSize: 13, color: dc.textSecondary, lineHeight: 19 },

  stopRow: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dc.cardStrokeSoft },
  stopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stopName: { fontSize: 14, fontWeight: '700', color: dc.textPrimary },
  stopTemp: { fontSize: 14, fontWeight: '700', color: dc.accentCyan },
  stopWeather: { fontSize: 13, color: dc.textSecondary, marginBottom: 4 },
  aqiText: { fontSize: 12, color: dc.textMuted, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  noDataText: { fontSize: 13, color: dc.textMuted, textAlign: 'center', paddingVertical: 16 },

  footer: {
    fontSize: 11,
    color: dc.textMuted,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.3,
  },

  // Tourist stations
  touristBulletin: {
    fontSize: 12,
    color: dc.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  touristGrid: {
    gap: 10,
  },
  touristCard: {
    backgroundColor: dc.cardGlass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dc.cardStrokeSoft,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  touristCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  touristIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(155,200,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  touristCardBody: {
    flex: 1,
  },
  touristName: {
    fontSize: 14,
    fontWeight: '700',
    color: dc.textPrimary,
  },
  touristRegion: {
    fontSize: 11,
    color: dc.textMuted,
    marginTop: 1,
  },
  touristRight: {
    alignItems: 'flex-end',
  },
  touristTemp: {
    fontSize: 22,
    fontWeight: '700',
    color: dc.accentCyan,
    lineHeight: 26,
  },
  touristCondition: {
    fontSize: 10,
    color: dc.textMuted,
    marginTop: 2,
    textAlign: 'right',
  },
  touristStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  touristStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  touristStatText: {
    fontSize: 11,
    color: dc.textSecondary,
    fontWeight: '500',
  },
  touristUpdated: {
    fontSize: 10,
    color: dc.textMuted,
    marginLeft: 'auto',
  },
  touristForecast: {
    marginTop: 6,
  },
  touristForecastDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: dc.cardStrokeSoft,
    marginBottom: 8,
    marginTop: 4,
  },
  touristForecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  touristForecastDay: {
    fontSize: 12,
    fontWeight: '600',
    color: dc.textSecondary,
    width: 50,
  },
  touristForecastCondition: {
    flex: 1,
    fontSize: 12,
    color: dc.textMuted,
  },
  touristForecastRange: {
    fontSize: 13,
    fontWeight: '700',
    color: dc.textPrimary,
    textAlign: 'right',
  },
});
