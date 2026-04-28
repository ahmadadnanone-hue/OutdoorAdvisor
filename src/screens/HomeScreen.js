/**
 * HomeScreen — data container only.
 * All UI sections live in src/components/home/.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, RefreshControl, ActivityIndicator, Platform, Modal, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import useAQI from '../hooks/useAQI';
import useWeather from '../hooks/useWeather';
import usePollen from '../hooks/usePollen';
import useAiBriefing from '../hooks/useAiBriefing';
import useAlerts from '../hooks/useAlerts';
import useSynthesis from '../hooks/useSynthesis';
import { getWeatherDescription, isNight } from '../utils/weatherCodes';
import { maybeSendLocalAlert } from '../utils/alertNotifications';
import { loadStoredNotifications, loadStoredThresholds } from '../utils/alertPreferences';
import { getActivitySummary } from '../utils/activityScoring';
import { getActivityById } from '../data/activities';
import { ScreenGradient } from '../components/layout';
import { colors as dc } from '../design';
import CacheIndicator from '../components/CacheIndicator';
import { GlassCard } from '../components/glass';
import useHealthData from '../hooks/useHealthData';
import { requestNotificationPermission } from '../services/notificationService';
import { getSmartAdvisorSnapshot } from '../services/smartAdvisor';

// Home sub-components
import HomeHeader from '../components/home/HomeHeader';
import DecisionSection from '../components/home/DecisionSection';
import SynthesisCard from '../components/home/SynthesisCard';
import AqiSection from '../components/home/AqiSection';
import WindSection from '../components/home/WindSection';
import DetailsSection from '../components/home/DetailsSection';
import PollenSection from '../components/home/PollenSection';
import ForecastSection from '../components/home/ForecastSection';
import ActivitySection from '../components/home/ActivitySection';
import TravelSection from '../components/home/TravelSection';
import AlertBanner from '../components/home/AlertBanner';
import HealthStatsSection from '../components/home/HealthStatsSection';
import CityPickerModal from '../components/home/CityPickerModal';
import InsightModal from '../components/home/InsightModal';
import ForecastDetailModal from '../components/home/ForecastDetailModal';
import {
  getAqiColor, getAqiCategory, getHomeDecision, decisionStatus,
  getWindDirectionLabel, getGreeting, getUserGreetingName, getLocationDisplay,
  getActivityToneColor, buildAqiHistoryInsight, getWindInsight, getPollenInsight,
  isRainCode, isStormCode, isFogCode,
} from '../components/home/homeUtils';
import { loadNotificationInbox, markInboxSeen } from '../utils/notificationInbox';

const LIVE_REFRESH_WINDOW_MS   = 5 * 60 * 1000;
const MAX_LIVE_REFRESHES       = 2;
const PREMIUM_SECTIONS         = new Set(['pollen', 'wind', 'details', 'forecast']);
const ACTIVITY_IDS             = ['running', 'cycling', 'walking', 'swimming', 'cricket', 'dining'];

export default function HomeScreen({ navigation, route }) {
  const { colors } = useTheme();
  const settings = useSettings();
  const { isPremium, user } = useAuth();
  const insets = useSafeAreaInsets();
  const health = useHealthData({ prompt: false });

  // ── Location ──────────────────────────────────────────────────────────────
  const { location, city, region, isUsingDeviceLocation, loading: locationLoading, refresh: refreshLocation, selectCity, selectPlace } = useLocationContext();

  // ── Data ──────────────────────────────────────────────────────────────────
  const { aqi, pm25, history: aqiHistory, loading: aqiLoading, isUsingCache: aqiCached, updatedAt: aqiUpdatedAt, refresh: refreshAqi } = useAQI(location.lat, location.lon);
  const { current: weatherCurrent, daily, hourly, loading: weatherLoading, isUsingCache: weatherCached, updatedAt: weatherUpdatedAt, refresh: refreshWeather } = useWeather(location.lat, location.lon);
  const { primary: pollenPrimary, types: pollenTypes, refresh: refreshPollen } = usePollen(location.lat, location.lon);

  // ── Derived ───────────────────────────────────────────────────────────────
  const greetingName      = useMemo(() => getUserGreetingName(user), [user]);
  const locationDisplay   = getLocationDisplay(city, region);
  const todayForecast     = daily?.[0] || null;
  // Prefer the API's own day/night flag (WeatherKit: daylight bool, Open-Meteo: is_day).
  // Fall back to sunrise/sunset math, then a simple hour-of-day heuristic.
  const nightMode         = weatherCurrent?.daylight != null
    ? !weatherCurrent.daylight
    : isNight(new Date(), todayForecast?.sunrise, todayForecast?.sunset);
  const weather           = getWeatherDescription(weatherCurrent?.weatherCode, { isNight: nightMode });
  const displayWindGusts  = weatherCurrent?.windGusts ?? todayForecast?.windGusts ?? null;
  const displayWindDir    = weatherCurrent?.windDirection ?? todayForecast?.windDirection ?? null;
  const gustsFromForecast = weatherCurrent?.windGusts == null && todayForecast?.windGusts != null;
  const dirFromForecast   = weatherCurrent?.windDirection == null && todayForecast?.windDirection != null;
  const currentWindDir    = displayWindDir != null ? getWindDirectionLabel(displayWindDir) : '--';
  const feelsLikeTemp     = weatherCurrent?.feelsLike;
  const feelsLikeColor    = feelsLikeTemp == null ? dc.textMuted : feelsLikeTemp < 15 ? '#5B9CF6' : feelsLikeTemp < 30 ? '#F5A623' : '#EF4444';
  const pm25Color         = pm25 != null ? getAqiColor(pm25) : dc.textMuted;
  const pollenValue       = pollenPrimary?.value;
  const pollenDisplayName = pollenPrimary?.displayName || 'Pollen';
  const pollenCategory    = pollenPrimary?.indexDisplayName || pollenPrimary?.category || '--';
  const pollenColor       = pollenValue != null ? getAqiColor((pollenValue + 1) * 50) : dc.textMuted;
  const decision          = getHomeDecision({ aqi, temp: weatherCurrent?.temp, feelsLike: feelsLikeTemp, weatherCode: weatherCurrent?.weatherCode, pollenValue, windSpeed: weatherCurrent?.windSpeed });
  const nextSixHours      = (hourly || []).slice(0, 6);
  const peakRainChance    = nextSixHours.reduce((max, h) => Math.max(max, h?.precipProbability ?? 0), 0);
  const nextActivityWindows = ACTIVITY_IDS.slice(0, 3).map((id) => { const a = getActivityById(id); if (!a) return null; const s = getActivitySummary(a, aqi ?? 0, weatherCurrent, hourly); return { name: a.name, score: s.score, bestTime: s.bestTime, label: s.label }; }).filter(Boolean);
  const topHomeActivities = useMemo(() =>
    ACTIVITY_IDS.map((id) => { const a = getActivityById(id); if (!a) return null; const s = getActivitySummary(a, aqi ?? 0, weatherCurrent, hourly); return { id, activity: a, summary: s, toneColor: getActivityToneColor(s.label) }; })
      .filter(Boolean).sort((a, b) => b.summary.score - a.summary.score).slice(0, 4),
    [aqi, weatherCurrent, hourly]);

  const freshestUpdate = [aqiUpdatedAt, weatherUpdatedAt].filter(Boolean).sort((a, b) => b - a)[0] || null;
  const lastUpdated    = freshestUpdate ? new Date(freshestUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

  // ── AI briefing ───────────────────────────────────────────────────────────
  const homeAiPayload   = useMemo(() => ({ locationName: locationDisplay.primary, decisionLabel: decision.label, decisionTone: decision.tone, aqi, pm25, temp: weatherCurrent?.temp, feelsLike: feelsLikeTemp, humidity: weatherCurrent?.humidity, windSpeed: weatherCurrent?.windSpeed, weatherLabel: weather.description, weatherCode: weatherCurrent?.weatherCode, pollenLabel: pollenCategory, pollenValue, peakRainChance, nextActivityWindows }), [locationDisplay.primary, decision.label, decision.tone, aqi, pm25, weatherCurrent?.temp, feelsLikeTemp, weatherCurrent?.humidity, weatherCurrent?.windSpeed, weatherCurrent?.weatherCode, weather.description, pollenCategory, pollenValue, peakRainChance, nextActivityWindows]);
  const homeAiSignature = useMemo(() => [locationDisplay.primary, decision.label, aqi ?? 'na', pm25 ?? 'na', weatherCurrent?.temp ?? 'na', feelsLikeTemp ?? 'na', weatherCurrent?.humidity ?? 'na', weatherCurrent?.windSpeed ?? 'na', weatherCurrent?.weatherCode ?? 'na', pollenValue ?? 'na', peakRainChance].join('|'), [locationDisplay.primary, decision.label, aqi, pm25, weatherCurrent?.temp, feelsLikeTemp, weatherCurrent?.humidity, weatherCurrent?.windSpeed, weatherCurrent?.weatherCode, pollenValue, peakRainChance]);
  const { alerts } = useAlerts();
  const { data: homeAiBriefing, loading: homeAiLoading } = useAiBriefing({ kind: 'home', signature: homeAiSignature, payload: homeAiPayload, enabled: isPremium && (aqi != null || weatherCurrent?.weatherCode != null || weatherCurrent?.temp != null || pollenValue != null) });

  // ── Unified synthesis (all sources → one brief) ───────────────────────────
  const { synthesis, loading: synthesisLoading, fetchedAt: synthesisFetchedAt, refresh: refreshSynthesis } = useSynthesis({
    lat:          location.lat,
    lon:          location.lon,
    locationName: locationDisplay.primary,
    pollenLabel:  pollenCategory !== '--' ? pollenCategory : null,
    enabled:      location.lat != null && location.lon != null,
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing]           = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [forecastDetail, setForecastDetail]   = useState(null);
  const [insightModal, setInsightModal]       = useState(null);
  const [refreshNote, setRefreshNote]         = useState('');
  const [notificationCenterVisible, setNotificationCenterVisible] = useState(false);
  const [notificationInbox, setNotificationInbox] = useState([]);
  const [smartSnapshot, setSmartSnapshot] = useState(null);
  const refreshWindowRef                      = useRef([]);
  const scrollRef                             = useRef(null);

  useEffect(() => {
    if (!refreshNote) return;
    const t = setTimeout(() => setRefreshNote(''), 5000);
    return () => clearTimeout(t);
  }, [refreshNote]);

  // ── FAB trigger (refresh / ai-brief / location) ────────────────────────────
  const fabTrigger = route?.params?.fabTrigger;
  useEffect(() => {
    if (!fabTrigger) return;
    if (fabTrigger.startsWith('refresh-')) {
      onRefresh();
    } else if (fabTrigger.startsWith('ai-brief-')) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      refreshSynthesis(true);
    } else if (fabTrigger.startsWith('location-')) {
      setCityPickerVisible(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabTrigger]);

  const unreadNotificationCount = useMemo(
    () => notificationInbox.filter((item) => !item.seen).length,
    [notificationInbox]
  );

  const refreshNotificationInbox = useCallback(async () => {
    const items = await loadNotificationInbox();
    setNotificationInbox(items);
  }, []);

  useEffect(() => {
    refreshNotificationInbox();
  }, [refreshNotificationInbox]);

  useEffect(() => {
    let cancelled = false;

    const loadSmartSnapshot = async () => {
      const snapshot = await getSmartAdvisorSnapshot({ promptForHealth: false });
      if (!cancelled) {
        setSmartSnapshot(snapshot);
      }
    };

    loadSmartSnapshot();
    return () => {
      cancelled = true;
    };
  }, [health.steps, health.distanceKm, health.calories, aqi, weatherCurrent?.temp, weatherCurrent?.weatherCode]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const now = Date.now();
    const recent = refreshWindowRef.current.filter((t) => now - t < LIVE_REFRESH_WINDOW_MS);
    refreshWindowRef.current = recent;
    const force = recent.length < MAX_LIVE_REFRESHES;
    if (force) {
      refreshWindowRef.current = [...recent, now];
      setRefreshNote('Checking fresh live conditions now.');
    } else {
      const retryIn = Math.max(1, Math.ceil((LIVE_REFRESH_WINDOW_MS - (now - recent[0])) / 60000));
      setRefreshNote(`Using cached conditions. Fresh refresh opens again in about ${retryIn} min.`);
    }
    try {
      const loc = isUsingDeviceLocation ? await refreshLocation(force) : location;
      if (loc?.lat != null && loc?.lon != null) {
        await Promise.all([refreshAqi(loc.lat, loc.lon, { force }), refreshWeather(loc.lat, loc.lon, { force }), refreshPollen(loc.lat, loc.lon, { force })]);
      }
    } finally { setRefreshing(false); }
  }, [isUsingDeviceLocation, location, refreshLocation, refreshAqi, refreshWeather, refreshPollen]);

  // ── Local alert notifications ─────────────────────────────────────────────
  useEffect(() => {
    if (aqi == null && pm25 == null && weatherCurrent?.weatherCode == null && weatherCurrent?.windSpeed == null && pollenValue == null) return;
    let cancelled = false;
    (async () => {
      const [prefs, thresholds] = await Promise.all([loadStoredNotifications(), loadStoredThresholds()]);
      if (cancelled) return;
      const label = locationDisplay.primary || 'your area';
      const key   = city || `${location.lat?.toFixed?.(2) || '0'}-${location.lon?.toFixed?.(2) || '0'}`;
      if (prefs.severeAqiWarnings && aqi >= thresholds.aqiAlert)                                             maybeSendLocalAlert(`aqi-${key}`,    { title: 'Severe AQI warning',     body: `${label} is reading AQI ${aqi}. Use an N95 and keep longer outdoor exposure lighter today.` });
      if (isPremium && prefs.smogAlerts && pm25 >= thresholds.pm25Alert)                                     maybeSendLocalAlert(`smog-${key}`,   { title: 'Smog alert',             body: `PM2.5 is elevated around ${label}. A mask and shorter outdoor sessions will help.` });
      if (prefs.rainAlerts && isRainCode(weatherCurrent?.weatherCode))                                       maybeSendLocalAlert(`rain-${key}`,   { title: 'Rain alert',             body: `Rain is active near ${label}. Carry rain gear and slow down on the road.` });
      if (prefs.thunderstormAlerts && isStormCode(weatherCurrent?.weatherCode))                              maybeSendLocalAlert(`storm-${key}`,  { title: 'Thunderstorm alert',     body: `Storm risk is active around ${label}. Delay exposed outdoor plans until the cell passes.` });
      if (prefs.windAlerts && ((weatherCurrent?.windSpeed ?? 0) >= 28 || (displayWindGusts ?? 0) >= 38))    maybeSendLocalAlert(`wind-${key}`,   { title: 'Wind alert',             body: `Wind is picking up around ${label}. Choose sheltered routes and secure loose items.` });
      if (isPremium && prefs.pollenAlerts && pollenValue >= 4)                                               maybeSendLocalAlert(`pollen-${key}`, { title: 'High pollen alert',      body: `${pollenDisplayName} pollen is elevated near ${label}. A mask and allergy medication can help.` });
      if (prefs.heatAlerts && weatherCurrent?.feelsLike >= thresholds.heatAlert)                            maybeSendLocalAlert(`heat-${key}`,   { title: 'Heat alert',             body: `Feels-like heat is high around ${label}. Go later, hydrate well, and take shade breaks.` });
      if (isPremium && prefs.fogWarnings && isFogCode(weatherCurrent?.weatherCode))                         maybeSendLocalAlert(`fog-${key}`,    { title: 'Low-visibility alert',   body: `Visibility looks reduced around ${label}. Slow down and leave extra margin while driving.` });
      setTimeout(() => {
        refreshNotificationInbox();
      }, 250);
    })();
    return () => { cancelled = true; };
  }, [aqi, city, displayWindGusts, location.lat, location.lon, locationDisplay.primary, pm25, pollenDisplayName, pollenValue, weatherCurrent?.feelsLike, weatherCurrent?.weatherCode, weatherCurrent?.windSpeed, isPremium, refreshNotificationInbox]);

  const openNotificationCenter = useCallback(() => {
    setNotificationCenterVisible(true);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const next = await markInboxSeen();
    setNotificationInbox(next);
  }, []);

  const enableHealthAndNotifications = useCallback(async () => {
    await requestNotificationPermission({ prompt: true }).catch(() => {});
    await health.requestAccess().catch(() => {});
    const snapshot = await getSmartAdvisorSnapshot({ promptForHealth: false });
    setSmartSnapshot(snapshot);
  }, [health]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (locationLoading) {
    return (
      <ScreenGradient>
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator size="large" color={dc.accentCyan} />
          <Text style={styles.loadingText}>Detecting your location…</Text>
        </SafeAreaView>
      </ScreenGradient>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScreenGradient>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 90, 120) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          <HomeHeader
            greeting={getGreeting()}
            isPremium={isPremium}
            locationLabel={locationDisplay.primary}
            onLocationPress={() => setCityPickerVisible(true)}
            onRefresh={onRefresh}
            onNotificationsPress={openNotificationCenter}
            unreadNotificationCount={unreadNotificationCount}
          />

          <CacheIndicator visible={aqiCached || weatherCached} updatedAt={lastUpdated !== '--' ? lastUpdated : null} />
          {!!refreshNote && <Text style={styles.refreshNote}>{refreshNote}</Text>}

          {/* ── Unified outdoor brief (all sources) ── */}
          <SynthesisCard
            synthesis={synthesis}
            loading={synthesisLoading}
            fetchedAt={synthesisFetchedAt}
            isPremium={isPremium}
            onRefresh={() => refreshSynthesis(true)}
          />

          <AlertBanner alerts={alerts} />

          <HealthStatsSection
            steps={health.steps}
            distanceKm={health.distanceKm}
            outdoorScore={smartSnapshot?.outdoorScore ?? 0}
            healthAuthorized={health.authorized}
            notificationsReady={!!smartSnapshot?.notificationsReady}
            loading={health.loading}
            onRequestAccess={enableHealthAndNotifications}
          />

          {settings.homeSections.map((key) => {
            if (PREMIUM_SECTIONS.has(key) && !isPremium) return null;
            switch (key) {
              case 'decision':
                return (
                  <DecisionSection
                    key="decision"
                    decision={decision}
                    isPremium={isPremium}
                    homeAiBriefing={homeAiBriefing}
                    homeAiLoading={homeAiLoading}
                    onInsightPress={setInsightModal}
                    onAiPress={() => setInsightModal({ title: 'What today means', body: `${homeAiBriefing.headline} ${homeAiBriefing.summary} ${homeAiBriefing.tip}` })}
                  />
                );
              case 'travel':
                return (
                  <TravelSection
                    key="travel"
                    onNavigateTravel={(id) => id ? navigation.navigate('Travel', { highlightRoute: id, requestKey: Date.now() }) : navigation.navigate('Travel')}
                  />
                );
              case 'aqi':
                return (
                  <AqiSection
                    key="aqi"
                    aqi={aqi} pm25={pm25} aqiHistory={aqiHistory}
                    weather={weather} weatherCurrent={weatherCurrent}
                    locationDisplay={locationDisplay}
                    isUsingDeviceLocation={isUsingDeviceLocation}
                    nightMode={nightMode}
                    settings={settings}
                    onInsightPress={() => setInsightModal({ title: 'AQI Trend', body: buildAqiHistoryInsight(aqiHistory, aqi, pm25) })}
                  />
                );
              case 'wind':
                return (
                  <WindSection
                    key="wind"
                    weatherCurrent={weatherCurrent}
                    displayWindGusts={displayWindGusts}
                    currentWindDirection={currentWindDir}
                    gustsFromForecast={gustsFromForecast}
                    directionFromForecast={dirFromForecast}
                    settings={settings}
                    onInsightPress={() => setInsightModal({ title: 'Wind Insight', body: getWindInsight({ windSpeed: weatherCurrent?.windSpeed, windGusts: displayWindGusts, windDirectionLabel: currentWindDir, gustsFromForecast, directionFromForecast: dirFromForecast, formatWind: settings.formatWind }) })}
                  />
                );
              case 'details':
                return (
                  <DetailsSection
                    key="details"
                    weatherCurrent={weatherCurrent}
                    feelsLikeTemp={feelsLikeTemp}
                    feelsLikeColor={feelsLikeColor}
                    pm25={pm25}
                    pm25Color={pm25Color}
                    settings={settings}
                  />
                );
              case 'pollen':
                return (
                  <PollenSection
                    key="pollen"
                    pollenValue={pollenValue}
                    pollenDisplayName={pollenDisplayName}
                    pollenCategory={pollenCategory}
                    pollenColor={pollenColor}
                    onInsightPress={() => setInsightModal({ title: 'Pollen Insight', body: getPollenInsight(pollenPrimary, pollenTypes) })}
                  />
                );
              case 'forecast':
                return (
                  <ForecastSection
                    key="forecast"
                    daily={daily} hourly={hourly}
                    weatherLoading={weatherLoading}
                    onDayPress={setForecastDetail}
                  />
                );
              case 'activities':
                return (
                  <ActivitySection
                    key="activities"
                    topHomeActivities={topHomeActivities}
                    aqi={aqi}
                    weatherCurrent={weatherCurrent}
                    hourly={hourly}
                    onSeeAll={() => navigation.navigate('Activities')}
                    onActivityPress={() => navigation.navigate('Activities')}
                  />
                );
              default:
                return null;
            }
          })}

          <Text style={styles.footer}>Data updated at {lastUpdated}</Text>
        </ScrollView>

        <CityPickerModal
          visible={cityPickerVisible}
          onClose={() => setCityPickerVisible(false)}
          city={city}
          isPremium={isPremium}
          refreshLocation={refreshLocation}
          refreshAqi={refreshAqi}
          refreshWeather={refreshWeather}
          refreshPollen={refreshPollen}
          selectCity={selectCity}
          selectPlace={selectPlace}
        />
        <InsightModal insightModal={insightModal} onClose={() => setInsightModal(null)} />
        <ForecastDetailModal forecastDetail={forecastDetail} onClose={() => setForecastDetail(null)} settings={settings} />
        <Modal
          visible={notificationCenterVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setNotificationCenterVisible(false)}
        >
          <ScreenGradient>
            {/* Use explicit insets instead of SafeAreaView so horizontal insets
                are correctly applied inside a transparent Modal on all devices */}
            <View style={[styles.notificationSafe, {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
              paddingLeft: Math.max(insets.left + 16, 20),
              paddingRight: Math.max(insets.right + 16, 20),
            }]}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>Notifications</Text>
                <TouchableOpacity onPress={markAllNotificationsRead} activeOpacity={0.8}>
                  <Text style={styles.notificationAction}>Mark all read</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.notificationList} showsVerticalScrollIndicator={false}>
                {notificationInbox.length === 0 ? (
                  <GlassCard contentStyle={styles.notificationCardContent}>
                    <Text style={styles.notificationEmptyTitle}>No alerts saved yet</Text>
                    <Text style={styles.notificationEmptyBody}>
                      Weather, AQI, pollen, and travel alerts you receive will appear here with time and category.
                    </Text>
                  </GlassCard>
                ) : notificationInbox.map((item) => (
                  <GlassCard key={item.id} style={styles.notificationCard} contentStyle={styles.notificationCardContent}>
                    <View style={styles.notificationRowTop}>
                      <View style={styles.notificationMetaGroup}>
                        {!item.seen ? <View style={styles.notificationDot} /> : null}
                        <Text style={styles.notificationCategory}>{item.category}</Text>
                      </View>
                      <Text style={styles.notificationTime}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.notificationItemTitle}>{item.title}</Text>
                    <Text style={styles.notificationItemBody}>{item.body}</Text>
                  </GlassCard>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.notificationCloseButton}
                onPress={() => setNotificationCenterVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.notificationCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScreenGradient>
        </Modal>
      </SafeAreaView>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  loading:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, fontWeight: '500', color: dc.textSecondary },
  scroll:      { flex: 1 },
  content:     { padding: 16, gap: 16 },
  refreshNote: { fontSize: 12, color: dc.textMuted, textAlign: 'center', paddingVertical: 6 },
  footer:      { fontSize: 11, color: dc.textMuted, textAlign: 'center', marginTop: 8 },
  notificationSafe: { flex: 1, gap: 14 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  notificationTitle: { fontSize: 22, fontWeight: '700', color: dc.textPrimary, letterSpacing: -0.25 },
  notificationAction: { fontSize: 13, fontWeight: '700', color: dc.accentCyan },
  notificationList: { gap: 12, paddingTop: 4, paddingBottom: 8 },
  notificationCard: { marginBottom: 12 },
  notificationCardContent: { padding: 16, gap: 8 },
  notificationRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notificationMetaGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4D5F' },
  notificationCategory: { fontSize: 11, fontWeight: '700', color: dc.accentCyan, textTransform: 'uppercase', letterSpacing: 0.6 },
  notificationTime: { fontSize: 11, color: dc.textMuted },
  notificationItemTitle: { fontSize: 15, fontWeight: '700', color: dc.textPrimary },
  notificationItemBody: { fontSize: 13, lineHeight: 19, color: dc.textSecondary },
  notificationEmptyTitle: { fontSize: 15, fontWeight: '700', color: dc.textPrimary },
  notificationEmptyBody: { fontSize: 13, lineHeight: 19, color: dc.textSecondary },
  notificationCloseButton: {
    marginTop: 'auto',
    height: 50,
    borderRadius: 18,
    backgroundColor: dc.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCloseText: { fontSize: 15, fontWeight: '700', color: dc.bgTop },
});
