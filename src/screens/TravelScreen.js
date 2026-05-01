import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Modal,
  LayoutAnimation,
  UIManager,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import useAiBriefing from '../hooks/useAiBriefing';
// useTouristWeather removed — PMD blocks Vercel IPs; replaced by static link directory

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

/* ===== Closure Detail Sheet ===== */
function ClosureDetailSheet({ visible, closures, onClose }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 58,
      friction: 11,
    }).start();
  }, [visible, anim]);

  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [280, 0] });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }]}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetAlertIcon}>
                <Icon name="alert-circle" size={26} color={dc.accentRed} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetEyebrow}>ACTIVE CLOSURES</Text>
                <Text style={styles.sheetTitle}>
                  {closures.length} route{closures.length !== 1 ? 's' : ''} affected
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn} activeOpacity={0.7}>
                <Icon name="close" size={18} color={dc.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Closure list */}
            {closures.map((c, i) => (
              <View key={i} style={[styles.sheetClosureRow, i > 0 && styles.sheetClosureDivider]}>
                <View style={styles.sheetClosureDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetClosureRoute}>{c.route || 'Route advisory'}</Text>
                  {c.sector ? <Text style={styles.sheetClosureSector}>{c.sector}</Text> : null}
                  <Text style={styles.sheetClosureStatus}>{c.status}</Text>
                </View>
              </View>
            ))}

            {/* CTA */}
            <TouchableOpacity
              style={styles.sheetCta}
              onPress={() => {
                onClose();
                openInApp('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx');
              }}
              activeOpacity={0.78}
            >
              <Icon name="open-outline" size={14} color={dc.bgTop} />
              <Text style={styles.sheetCtaText}>View full advisories on NHMP</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
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

/* ===== PMD Tourist Stations ===== */
// PMD's nwfc.pmd.gov.pk blocks server-side (Vercel) requests.
// Live weather is fetched from WeatherKit/Open-Meteo for each station.
// Tapping a station opens the official PMD page in-app.
const TOURIST_STATIONS = [
  { id: '41573', name: 'Murree',        region: 'Punjab',            icon: 'partly-sunny-outline', lat: 33.9073, lon: 73.3943 },
  { id: '41516', name: 'Gilgit',        region: 'Gilgit-Baltistan',  icon: 'snow-outline',         lat: 35.9219, lon: 74.3085 },
  { id: '41505', name: 'Hunza',         region: 'Gilgit-Baltistan',  icon: 'snow-outline',         lat: 36.3120, lon: 74.6478 },
  { id: '41510', name: 'Kalam',         region: 'KPK',               icon: 'rainy-outline',        lat: 35.4883, lon: 72.5891 },
  { id: '43532', name: 'Muzaffarabad',  region: 'AJK',               icon: 'cloudy-outline',       lat: 34.3542, lon: 73.4715 },
  { id: '41506', name: 'Chitral',       region: 'KPK',               icon: 'snow-outline',         lat: 35.8531, lon: 71.7880 },
  { id: '41523', name: 'Saidu Sharif',  region: 'Swat, KPK',         icon: 'partly-sunny-outline', lat: 34.7503, lon: 72.3579 },
  { id: '41525', name: 'Malam Jabba',   region: 'KPK',               icon: 'snow-outline',         lat: 34.8101, lon: 72.5668 },
  { id: '43533', name: 'Garhi Dopatta', region: 'AJK',               icon: 'cloudy-outline',       lat: 34.3800, lon: 73.6300 },
  { id: '41574', name: 'Rawalakot',     region: 'AJK',               icon: 'partly-sunny-outline', lat: 33.8700, lon: 73.7600 },
  { id: '41661', name: 'Quetta',        region: 'Balochistan',       icon: 'sunny-outline',        lat: 30.1927, lon: 67.0099 },
];

const PMD_BASE = 'https://nwfc.pmd.gov.pk/new/tourist.php?station=';

const TRAVEL_SECTION_META = {
  sources: {
    label: 'Official Sources',
    desc: 'Combined NHMP and PMD status with official links.',
    icon: ICON.info,
  },
  nhmp: {
    label: 'NHMP Live Advisories',
    desc: 'Official motorway closure, fog, and route notices.',
    icon: ICON.travel,
  },
  aiInsight: {
    label: 'AI Trip Insight',
    desc: 'A quick route read grounded in the latest feeds.',
    icon: ICON.design,
  },
  touristLinks: {
    label: 'Tourist Stations',
    desc: 'Live conditions and PMD forecast links for hill stations.',
    icon: ICON.planner,
  },
  majorRoutes: {
    label: 'Major Routes',
    desc: 'Motorway and corridor stop-by-stop route cards.',
    icon: ICON.route,
  },
};

const ALL_TRAVEL_SECTION_KEYS = Object.keys(TRAVEL_SECTION_META);

function TouristStationsCard() {
  const [expanded, setExpanded] = useState(false);
  const [weather, setWeather] = useState({});
  const [loadingWx, setLoadingWx] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingWx(true);
      const results = await Promise.allSettled(
        TOURIST_STATIONS.map((s) => fetchWeatherForLocation(s.lat, s.lon))
      );
      if (cancelled) return;
      const map = {};
      TOURIST_STATIONS.forEach((s, i) => {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value?.current) map[s.id] = r.value.current;
      });
      setWeather(map);
      setLoadingWx(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded((v) => !v);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.touristHeaderLeft}>
          <Text style={styles.sectionEyebrow}>TOURIST STATIONS</Text>
          <View style={styles.touristLiveBadge}>
            <Icon name={loadingWx ? 'time-outline' : 'radio-outline'} size={9} color={dc.accentCyan} />
            <Text style={styles.touristLiveBadgeText}>{loadingWx ? 'LOADING' : 'LIVE'}</Text>
          </View>
        </View>
        <Icon name={expanded ? ICON.chevronUp : ICON.chevronDown} size={14} color={dc.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <>
          <View style={styles.touristNotice}>
            <Icon name="information-circle-outline" size={13} color={dc.accentCyan} style={{ marginTop: 1 }} />
            <Text style={styles.touristNoticeText}>
              Live conditions via WeatherKit. Tap any station for PMD&apos;s official 3-day forecast.
            </Text>
          </View>

          <View style={styles.touristGrid}>
            {TOURIST_STATIONS.map((s) => {
              const wx = weather[s.id];
              const { description: cond } = wx ? getWeatherDescription(wx.weatherCode) : { description: '—' };
              const temp = wx?.temp != null ? `${Math.round(wx.temp)}°` : null;
              const wind = wx?.windSpeed != null ? `${Math.round(wx.windSpeed)} km/h` : null;
              const humidity = wx?.humidity != null ? `${wx.humidity}%` : null;
              const daily = null; // future: attach daily forecast when needed

              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.touristCard}
                  onPress={() => openInApp(`${PMD_BASE}${s.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.touristCardHeader}>
                    <View style={styles.touristIconWrap}>
                      <Icon name={s.icon} size={18} color={dc.accentCyan} />
                    </View>
                    <View style={styles.touristCardBody}>
                      <Text style={styles.touristName}>{s.name}</Text>
                      <Text style={styles.touristRegion}>{s.region}</Text>
                    </View>
                    <View style={styles.touristRight}>
                      {loadingWx ? (
                        <ActivityIndicator size="small" color={dc.accentCyan} />
                      ) : (
                        <>
                          {temp && <Text style={styles.touristTemp}>{temp}</Text>}
                          <Text style={styles.touristCondition}>{cond}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  {!loadingWx && wx && (
                    <View style={styles.touristStatsRow}>
                      {wind && (
                        <View style={styles.touristStat}>
                          <Icon name="navigate-outline" size={11} color={dc.textMuted} />
                          <Text style={styles.touristStatText}>{wind}</Text>
                        </View>
                      )}
                      {humidity && (
                        <View style={styles.touristStat}>
                          <Icon name="water-outline" size={11} color={dc.textMuted} />
                          <Text style={styles.touristStatText}>{humidity}</Text>
                        </View>
                      )}
                      <Icon name="open-outline" size={10} color={dc.textMuted} style={{ marginLeft: 'auto' }} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.touristViewAll}
            onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/tourist.php')}
            activeOpacity={0.75}
          >
            <Icon name="globe-outline" size={13} color={dc.accentCyan} />
            <Text style={styles.touristViewAllText}>View all on PMD website</Text>
            <Icon name="open-outline" size={11} color={dc.textMuted} />
          </TouchableOpacity>
        </>
      )}
    </GlassCard>
  );
}

/* ===== Main Screen ===== */
export default function TravelScreen({ route }) {
  const insets = useSafeAreaInsets();
  const {
    formatTempShort,
    travelSections = ALL_TRAVEL_SECTION_KEYS,
    moveTravelSection,
    toggleTravelSection,
    resetTravelSections,
  } = useSettings();
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

  const [pmdAlerts, setPmdAlerts] = useState([]);
  const [pmdLoading, setPmdLoading] = useState(true);
  const [pmdBlocked, setPmdBlocked] = useState(false);
  const [pmdAlertsExpanded, setPmdAlertsExpanded] = useState(false);
  const [travelCustomizeExpanded, setTravelCustomizeExpanded] = useState(false);
  const [closureModalVisible, setClosureModalVisible] = useState(false);
  const [majorRoutesExpanded, setMajorRoutesExpanded] = useState(false);

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
        if (!nhmpCancelRef.current && json.success) {
          setPmdAlerts(json.alerts || []);
          if (!json.alerts?.length && !json.cities?.length) setPmdBlocked(true);
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

  // Notifications for closures, fog, and PMD alerts are pushed server-side
  // via /api/push?action=cron (sendMotorwayClosureAlerts + sendPmdCriticalAlerts
  // in api/_lib/alertEngine.js). They fire even when the app is closed, so no
  // tab-open local fallback is needed here.

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

  const disabledTravelSections = ALL_TRAVEL_SECTION_KEYS.filter((key) => !travelSections.includes(key));

  const renderTravelSection = useCallback((key) => {
    if (key === 'sources') {
      const nhmpDot = nhmpStatus === 'danger' ? dc.accentRed : nhmpStatus === 'caution' ? dc.accentYellow : nhmpStatus === 'ok' ? dc.accentGreen : dc.textMuted;
      const pmdDot  = pmdStatus  === 'danger' ? dc.accentRed : pmdStatus  === 'caution' ? dc.accentYellow : pmdStatus  === 'ok' ? dc.accentGreen : dc.textMuted;
      return (
        <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
          <Text style={styles.sectionEyebrow}>OFFICIAL SOURCES</Text>

          {/* NHMP row */}
          <TouchableOpacity
            style={styles.officialSourceRow}
            onPress={() => openInApp('https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx')}
            activeOpacity={0.75}
          >
            <View style={[styles.officialSourceDot, { backgroundColor: nhmpDot }]} />
            <View style={styles.officialSourceInfo}>
              <Text style={styles.officialSourceName}>NHMP</Text>
              <Text style={styles.officialSourceDetail}>
                {nhmpLoading ? 'Loading…'
                  : nhmpError ? 'Check NHMP directly'
                  : activeAlerts.length > 0
                    ? `${activeAlerts.length} route${activeAlerts.length > 1 ? 's' : ''} to review · ${clearRoutes.length} clear`
                    : `All routes clear${nhmpTimestamp ? ` · ${nhmpTimestamp}` : ''}`}
              </Text>
            </View>
            <View style={styles.officialSourceLink}>
              <Text style={styles.officialSourceLinkText}>Open</Text>
              <Icon name="open-outline" size={11} color={dc.accentCyan} />
            </View>
          </TouchableOpacity>

          <View style={styles.officialSourceDivider} />

          {/* PMD row */}
          <TouchableOpacity
            style={styles.officialSourceRow}
            onPress={() => openInApp('https://www.pmd.gov.pk/en/latest-weather-alerts.php')}
            activeOpacity={0.75}
          >
            <View style={[styles.officialSourceDot, { backgroundColor: pmdDot }]} />
            <View style={styles.officialSourceInfo}>
              <Text style={styles.officialSourceName}>PMD</Text>
              <Text style={styles.officialSourceDetail}>
                {pmdLoading ? 'Loading…'
                  : pmdBlocked ? 'Direct access only'
                  : pmdAlerts.length > 0
                    ? `${pmdAlerts.length} active alert${pmdAlerts.length > 1 ? 's' : ''}`
                    : 'No active weather alerts'}
              </Text>
            </View>
            <View style={styles.officialSourceLink}>
              <Text style={styles.officialSourceLinkText}>Alerts</Text>
              <Icon name="open-outline" size={11} color={dc.accentCyan} />
            </View>
          </TouchableOpacity>

          {/* PMD quick-links row */}
          <View style={styles.officialLinksRow}>
            <TouchableOpacity
              style={styles.officialLinkBtn}
              onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/3-days-forecast.php')}
              activeOpacity={0.75}
            >
              <Icon name="calendar-outline" size={13} color={dc.accentCyan} />
              <Text style={styles.officialLinkBtnText}>3-Day Forecast</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.officialLinkBtn}
              onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/radar.php?type=islamabad')}
              activeOpacity={0.75}
            >
              <Icon name="radio-outline" size={13} color={dc.accentCyan} />
              <Text style={styles.officialLinkBtnText}>Radar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.officialLinkBtn}
              onPress={() => openInApp('https://nwfc.pmd.gov.pk/new/motorway-fog-update.php')}
              activeOpacity={0.75}
            >
              <Icon name="eye-off-outline" size={13} color={dc.accentCyan} />
              <Text style={styles.officialLinkBtnText}>Fog Update</Text>
            </TouchableOpacity>
          </View>

          {/* PMD active alerts inline */}
          {pmdAlerts.length > 0 && (
            <TouchableOpacity
              style={styles.officialAlertsToggle}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setPmdAlertsExpanded((v) => !v);
              }}
              activeOpacity={0.8}
            >
              <Icon name={ICON.danger} size={14} color={dc.accentRed} />
              <Text style={styles.officialAlertsToggleText}>
                {pmdAlerts.length} weather alert{pmdAlerts.length > 1 ? 's' : ''} active
              </Text>
              <Icon name={pmdAlertsExpanded ? ICON.chevronUp : ICON.chevronDown} size={13} color={dc.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}
          {pmdAlertsExpanded && pmdAlerts.length > 0 && (
            <TouchableOpacity
              style={styles.pmdAlertDetails}
              onPress={() => openInApp('https://www.pmd.gov.pk/en/latest-weather-alerts.php')}
              activeOpacity={0.8}
            >
              {pmdAlerts.slice(0, 5).map((alert, i) => (
                <Text key={i} style={styles.pmdAlertItem}>{alert}</Text>
              ))}
              <Text style={styles.advisoryHint}>Tap for official PMD alert details</Text>
            </TouchableOpacity>
          )}
        </GlassCard>
      );
    }

    if (key === 'nhmp') {
      return (
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
      );
    }

    if (key === 'aiInsight') {
      return (
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
      );
    }

    if (key === 'touristLinks') {
      return <TouristStationsCard />;
    }

    if (key === 'majorRoutes') {
      return (
        <>
          <TouchableOpacity
            style={styles.majorRoutesHeader}
            activeOpacity={0.78}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setMajorRoutesExpanded((v) => !v);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.routesTitle}>Weather Along Major Routes</Text>
              <Text style={styles.routesSubtitle}>
                {majorRoutesExpanded
                  ? 'Motorways, northern highways, and mountain corridors.'
                  : `${sortedRoutes.length} route${sortedRoutes.length === 1 ? '' : 's'} — tap to view`}
              </Text>
            </View>
            <Icon
              name={majorRoutesExpanded ? ICON.chevronUp : ICON.chevronDown}
              size={18}
              color={dc.textMuted}
            />
          </TouchableOpacity>

          {majorRoutesExpanded && sortedRoutes.map(({ route: motorway, sourceIndex, matchedAdvisory, matchedPmdAlerts, riskScore }) => {
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
                        <Text style={[styles.routeBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.routeMeta}>
                      {motorway.kind === 'motorway' ? 'Motorway corridor' : motorway.kind === 'northern' ? 'Northern route' : 'Regional route'}
                    </Text>
                  </View>
                  <Icon
                    name={isExpanded ? ICON.chevronUp : ICON.chevronDown}
                    size={18}
                    color={dc.textMuted}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.routeExpanded}>
                    <View style={styles.routeDivider} />
                    <Text style={styles.routeSourceText}>{sourceSummary}</Text>

                    {!!matchedAdvisory && matchedAdvisory.severity !== 'clear' && (
                      <View style={styles.routeAlertNote}>
                        <Text style={styles.routeAlertTitle}>
                          {SEVERITY_CONFIG[matchedAdvisory.severity]?.label || 'NHMP'}
                        </Text>
                        <Text style={styles.routeAlertBody}>{matchedAdvisory.status}</Text>
                        {!!matchedAdvisory.sector && (
                          <Text style={styles.routeAlertBody}>{matchedAdvisory.sector}</Text>
                        )}
                      </View>
                    )}

                    {!isPremium ? (
                      <View style={styles.premiumGate}>
                        <Icon name={ICON.premium} size={18} color={dc.accentCyan} style={{ marginTop: 2, marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.premiumTitle}>Premium route scan</Text>
                          <Text style={styles.premiumBody}>Unlock stop-by-stop weather, AQI, and smarter route insight.</Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        {stopData[sourceIndex] == null ? (
                          <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={dc.accentCyan} />
                            <Text style={styles.loadingText}>Loading stop conditions...</Text>
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

          {majorRoutesExpanded && (
            <Text style={styles.footer}>Conditions may change. Recheck before departure.</Text>
          )}
        </>
      );
    }

    return null;
  }, [
    activeAlerts,
    clearRoutes,
    expandedMotorway,
    formatTempShort,
    isPremium,
    loadNhmp,
    nhmpAlertsExpanded,
    nhmpError,
    nhmpLoading,
    nhmpRefreshing,
    nhmpStatus,
    nhmpTimestamp,
    pmdAlerts,
    pmdAlertsExpanded,
    pmdBlocked,
    pmdLoading,
    pmdStatus,
    routeOffsetsRef,
    sortedRoutes,
    stopData,
    toggleMotorway,
    travelAiBriefing,
    travelAiLoading,
    majorRoutesExpanded,
  ]);

  return (
    <ScreenGradient>
      <View style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.contentContainer, { paddingTop: Math.max(insets.top, 12) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Screen header */}
          <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>Road Intelligence</Text>
            <Text style={styles.screenSubtitle}>Based on latest available advisories</Text>
          </View>

          {/* Closure detail sheet */}
          <ClosureDetailSheet
            visible={closureModalVisible}
            closures={nhmpData.filter((a) => a.severity === 'closed')}
            onClose={() => setClosureModalVisible(false)}
          />

          {/* Travel snapshot */}
          <TravelSnapshotCard
            level={travelSummary.level}
            title={travelSummary.label}
            body={travelSummary.body}
            stats={travelSummary.stats}
            onStatPress={(st) => {
              if (st.label === 'Closures') setClosureModalVisible(true);
            }}
          />

          {travelSections.map((key) => (
            <React.Fragment key={key}>
              {renderTravelSection(key)}
            </React.Fragment>
          ))}

          <GlassCard style={styles.sectionCard} contentStyle={styles.travelCustomizeContent}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setTravelCustomizeExpanded((value) => !value);
              }}
              style={styles.travelCustomizeToggle}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionEyebrow}>CUSTOMIZE TRAVEL</Text>
                <Text style={styles.travelCustomizeBody}>
                  Hide optional blocks or move them up and down. The top travel summary stays fixed.
                </Text>
              </View>
              <Icon
                name={travelCustomizeExpanded ? ICON.chevronUp : ICON.chevronDown}
                size={16}
                color={dc.textMuted}
              />
            </TouchableOpacity>

            {travelCustomizeExpanded && (
              <>
                <View style={styles.travelCustomizeToolbar}>
                  <TouchableOpacity style={styles.resetMiniBtn} onPress={resetTravelSections} activeOpacity={0.75}>
                    <Text style={styles.resetMiniText}>Reset</Text>
                  </TouchableOpacity>
                </View>

                {travelSections.map((key, index) => {
                  const meta = TRAVEL_SECTION_META[key];
                  const isFirst = index === 0;
                  const isLast = index === travelSections.length - 1;
                  return (
                    <GlassCard key={key} style={styles.travelSectionItemCard} contentStyle={styles.travelSectionItemContent}>
                      <View style={styles.travelSectionIconWrap}>
                        <Icon name={meta.icon} size={16} color={dc.accentCyan} />
                      </View>
                      <View style={styles.travelSectionInfo}>
                        <Text style={styles.travelSectionLabel}>{meta.label}</Text>
                        <Text style={styles.travelSectionDesc}>{meta.desc}</Text>
                      </View>
                      <View style={styles.travelSectionActions}>
                        <TouchableOpacity
                          style={[styles.orderBtn, isFirst && styles.orderBtnDisabled]}
                          disabled={isFirst}
                          onPress={() => moveTravelSection(index, index - 1)}
                        >
                          <Text style={styles.orderBtnText}>▲</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.orderBtn, isLast && styles.orderBtnDisabled]}
                          disabled={isLast}
                          onPress={() => moveTravelSection(index, index + 1)}
                        >
                          <Text style={styles.orderBtnText}>▼</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.orderBtn, { backgroundColor: dc.dangerGlass }]}
                          onPress={() => toggleTravelSection(key)}
                        >
                          <Text style={[styles.orderBtnText, { color: dc.accentRed }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </GlassCard>
                  );
                })}

                {disabledTravelSections.length > 0 && (
                  <View style={styles.hiddenTravelWrap}>
                    <Text style={styles.hiddenTravelLabel}>HIDDEN BLOCKS</Text>
                    {disabledTravelSections.map((key) => {
                      const meta = TRAVEL_SECTION_META[key];
                      return (
                        <GlassCard key={key} style={styles.travelSectionItemCard} contentStyle={styles.travelSectionItemContent}>
                          <View style={styles.travelSectionIconWrap}>
                            <Icon name={meta.icon} size={16} color={dc.textMuted} />
                          </View>
                          <View style={styles.travelSectionInfo}>
                            <Text style={styles.travelSectionLabel}>{meta.label}</Text>
                            <Text style={styles.travelSectionDesc}>{meta.desc}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.travelAddBtn}
                            onPress={() => toggleTravelSection(key)}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.travelAddBtnText}>+ Add</Text>
                          </TouchableOpacity>
                        </GlassCard>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </GlassCard>
        </ScrollView>
      </View>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 120, gap: 14 },

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

  // Unified official sources card
  officialSourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  officialSourceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  officialSourceInfo: { flex: 1 },
  officialSourceName: { fontSize: 14, fontWeight: '700', color: dc.textPrimary },
  officialSourceDetail: { fontSize: 12, color: dc.textSecondary, marginTop: 2, lineHeight: 17 },
  officialSourceLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  officialSourceLinkText: { fontSize: 12, fontWeight: '700', color: dc.accentCyan },
  officialSourceDivider: { height: StyleSheet.hairlineWidth, backgroundColor: dc.cardStroke, marginVertical: 2 },
  officialLinksRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  officialLinkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: dc.cardGlassStrong, borderWidth: 1, borderColor: dc.cardStrokeSoft },
  officialLinkBtnText: { fontSize: 11, fontWeight: '700', color: dc.accentCyan },
  officialAlertsToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dc.cardStroke },
  officialAlertsToggleText: { fontSize: 13, fontWeight: '600', color: dc.accentRed },

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

  majorRoutesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
    gap: 12,
  },
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

  travelCustomizeContent: { padding: 18 },
  travelCustomizeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  travelCustomizeBody: {
    fontSize: 13,
    color: dc.textSecondary,
    lineHeight: 19,
    marginTop: 6,
  },
  travelCustomizeToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  resetMiniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: dc.cardGlassStrong,
    borderWidth: 1,
    borderColor: dc.cardStrokeSoft,
  },
  resetMiniText: {
    fontSize: 12,
    fontWeight: '700',
    color: dc.accentCyan,
  },
  travelSectionItemCard: {
    marginTop: 10,
  },
  travelSectionItemContent: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  travelSectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: dc.cardGlassStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelSectionInfo: {
    flex: 1,
  },
  travelSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: dc.textPrimary,
  },
  travelSectionDesc: {
    fontSize: 12,
    color: dc.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  travelSectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  orderBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: dc.cardGlassStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnDisabled: {
    opacity: 0.35,
  },
  orderBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: dc.textPrimary,
  },
  hiddenTravelWrap: {
    marginTop: 16,
  },
  hiddenTravelLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: dc.textMuted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  travelAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: dc.accentCyan,
  },
  travelAddBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: dc.bgTop,
  },

  // Closure detail sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: 'rgba(32,44,62,0.98)',
    borderWidth: 1,
    borderColor: dc.cardStroke,
    padding: 22,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: dc.cardStroke,
    alignSelf: 'center',
    marginBottom: 22,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  sheetAlertIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: dc.dangerGlass,
    borderWidth: 1,
    borderColor: dc.dangerStroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: dc.accentRed,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: dc.textPrimary,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: dc.cardGlassStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetClosureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
  },
  sheetClosureDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dc.cardStrokeSoft,
  },
  sheetClosureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: dc.accentRed,
    marginTop: 5,
  },
  sheetClosureRoute: {
    fontSize: 14,
    fontWeight: '700',
    color: dc.textPrimary,
    marginBottom: 2,
  },
  sheetClosureSector: {
    fontSize: 12,
    color: dc.textSecondary,
    marginBottom: 3,
  },
  sheetClosureStatus: {
    fontSize: 12,
    color: dc.accentRed,
    fontWeight: '600',
    lineHeight: 18,
  },
  sheetCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: dc.accentCyan,
  },
  sheetCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: dc.bgTop,
  },

  // Tourist stations header
  touristHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  touristLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(155,200,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(155,200,255,0.28)',
  },
  touristLiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: dc.accentCyan,
    letterSpacing: 0.8,
  },
  touristNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(155,200,255,0.07)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  touristNoticeText: {
    fontSize: 11,
    color: dc.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
  touristViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: dc.cardGlassStrong,
    borderWidth: 1,
    borderColor: dc.cardStrokeSoft,
  },
  touristViewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: dc.accentCyan,
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
    gap: 8,
    marginTop: 4,
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
