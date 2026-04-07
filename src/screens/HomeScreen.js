import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import useLocation from '../hooks/useLocation';
import useAQI from '../hooks/useAQI';
import useWeather from '../hooks/useWeather';
import usePollen from '../hooks/usePollen';
import { getWeatherDescription } from '../utils/weatherCodes';
import { getAqiColor } from '../theme/colors';
import { CITIES } from '../data/cities';
import AQIHeroCard from '../components/AQIHeroCard';
import ForecastStrip from '../components/ForecastStrip';
import HourlyForecastStrip from '../components/HourlyForecastStrip';
import AnimatedWeatherIcon from '../components/AnimatedWeatherIcon';
import ActivityCard from '../components/ActivityCard';
import CacheIndicator from '../components/CacheIndicator';
import PlacesAutocomplete from '../components/PlacesAutocomplete';
import { maybeSendLocalAlert } from '../utils/alertNotifications';
import { loadStoredNotifications, loadStoredThresholds } from '../utils/alertPreferences';
import { getActivitySummary } from '../utils/activityScoring';
import { getActivityById } from '../data/activities';
import useAiBriefing from '../hooks/useAiBriefing';

const LIVE_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const MAX_LIVE_REFRESHES_PER_WINDOW = 2;

function getWindDirectionLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function getUvLabel(uv) {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

function isRainCode(code) {
  return code != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);
}

function isStormCode(code) {
  return code != null && [95, 96, 99].includes(code);
}

function isFogCode(code) {
  return code != null && [45, 48].includes(code);
}

const ACTIVITIES = [
  'running',
  'cricket',
  'cycling',
  'walking',
  'dining',
  'schoolpe',
];

const HOME_TRIP_ACTIONS = [
  {
    id: 'MURREE',
    eyebrow: 'Trip Planning',
    title: 'Planning Murree trip?',
    body: 'Check road, weather, and route alerts before you leave.',
  },
  {
    id: 'M2',
    eyebrow: 'Drive Status',
    title: 'Lahore to Islamabad',
    body: 'See M2 conditions, NHMP advisories, and stop-by-stop weather.',
  },
];

function getActivityToneColor(label) {
  if (label === 'Good') return '#22C55E';
  if (label === 'Fair') return '#0EA5E9';
  if (label === 'Care') return '#F97316';
  return '#EF4444';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getLocationDisplay(label) {
  if (!label) {
    return { primary: 'Lahore', secondary: 'Pakistan' };
  }

  const parts = String(label)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      primary: parts[0],
      secondary: `${parts.slice(1).join(', ')}, Pakistan`,
    };
  }

  return {
    primary: label,
    secondary: `${label}, Pakistan`,
  };
}

function getAqiInsight(aqi, pm25) {
  if (aqi == null) {
    return 'Live AQI insight is unavailable right now. Pull to refresh or try another city.';
  }
  if (aqi <= 50) return `Air quality is excellent right now. PM2.5 is ${pm25 ?? '--'}, so outdoor plans are in a comfortable range for most people.`;
  if (aqi <= 100) return `Air quality is acceptable, but sensitive groups should keep an eye on symptoms. PM2.5 is ${pm25 ?? '--'}.`;
  if (aqi <= 150) return `Air quality is elevated for sensitive groups. Consider shorter outdoor sessions and lighter exertion. PM2.5 is ${pm25 ?? '--'}.`;
  if (aqi <= 200) return `Air quality is unhealthy. Limit prolonged outdoor activity and consider a mask for essential time outside. PM2.5 is ${pm25 ?? '--'}.`;
  return `Air quality is very poor right now. Keep outdoor exposure brief and shift activities indoors if possible. PM2.5 is ${pm25 ?? '--'}.`;
}

function getWindInsight({ windSpeed, windGusts, windDirectionLabel, gustsFromForecast, directionFromForecast, formatWind }) {
  const parts = [];
  parts.push(`Current wind speed is ${formatWind(windSpeed)}${windDirectionLabel && windDirectionLabel !== '--' ? ` from the ${windDirectionLabel}` : ''}.`);
  if (windGusts != null) {
    parts.push(`Peak gusts are ${formatWind(windGusts)}.`);
  }
  if (gustsFromForecast || directionFromForecast) {
    parts.push('Some wind details are forecast-derived because live station data was incomplete for this location.');
  }
  return parts.join(' ');
}

function getPollenInsight(primary, types) {
  if (!primary) {
    return 'Pollen insight is unavailable for this location right now. Google does not always return pollen coverage for every area.';
  }
  const topTypes = types
    .filter((type) => type.value != null)
    .slice(0, 3)
    .map((type) => `${type.displayName || type.code}: ${type.indexDisplayName || type.category || type.value}`)
    .join(' · ');

  return `${primary.displayName || 'Pollen'} is the main pollen driver right now with a ${primary.indexDisplayName || primary.category || primary.value} reading.${topTypes ? ` Top pollen types: ${topTypes}.` : ''}`;
}

function getHomeDecision({ aqi, temp, feelsLike, weatherCode, pollenValue, windSpeed }) {
  const heatValue = feelsLike ?? temp ?? null;
  const isStormy = weatherCode != null && [95, 96, 99].includes(weatherCode);
  const isHeavyRain = weatherCode != null && [65, 82].includes(weatherCode);
  const isRain = weatherCode != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);
  const hasHighPollen = pollenValue != null && pollenValue >= 4;
  const hasStrongWind = windSpeed != null && windSpeed >= 35;

  if (isStormy || aqi > 200 || heatValue >= 47) {
    const reasons = [];
    if (isStormy) reasons.push('thunderstorm risk');
    if (aqi > 200) reasons.push(`AQI ${aqi}`);
    if (heatValue >= 47) reasons.push(`feels-like ${Math.round(heatValue)}°`);
    return {
      label: 'Better to limit exposure',
      tone: 'Strong risk is present right now.',
      body: `If you still need to go out, keep it brief, avoid hard exertion, and use protection that matches the condition.${reasons.length ? ` Main factor: ${reasons.join(' · ')}.` : ''}`,
      color: '#EF4444',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.24)',
    };
  }

  if (aqi > 100 || heatValue >= 38 || isHeavyRain || hasHighPollen || hasStrongWind || isRain) {
    const guidance = [];
    if (aqi > 100) guidance.push('wear an N95 if you are sensitive or staying out long');
    if (heatValue >= 38) guidance.push('go earlier or later and hydrate often');
    if (isHeavyRain) guidance.push('use waterproof gear and slow down');
    else if (isRain) guidance.push('take rain gear for shorter trips');
    if (hasHighPollen) guidance.push('keep allergy medication or a mask handy');
    if (hasStrongWind) guidance.push('avoid exposed routes and secure loose gear');
    return {
      label: 'Go with care',
      tone: 'Outdoor plans are still workable with a few precautions.',
      body: guidance.length
        ? `Best approach: ${guidance.slice(0, 3).join(' · ')}.`
        : 'Conditions are manageable, but you will feel them more than on an easy-weather day.',
      color: '#F97316',
      bg: 'rgba(249,115,22,0.12)',
      border: 'rgba(249,115,22,0.24)',
    };
  }

  return {
    label: 'Good to go',
    tone: 'Conditions are comfortable for most outdoor plans.',
    body: 'This is a good window for walks, errands, and regular outdoor activity without major adjustments.',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.24)',
  };
}

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const settings = useSettings();
  const {
    location,
    city,
    isUsingDeviceLocation,
    loading: locationLoading,
    refresh: refreshLocation,
    selectCity,
    selectPlace,
  } = useLocation();
  const {
    aqi,
    pm25,
    pm10,
    loading: aqiLoading,
    isUsingCache: aqiCached,
    updatedAt: aqiUpdatedAt,
    refresh: refreshAqi,
  } = useAQI(location.lat, location.lon);
  const {
    current: weatherCurrent,
    daily,
    hourly,
    loading: weatherLoading,
    isUsingCache: weatherCached,
    updatedAt: weatherUpdatedAt,
    refresh: refreshWeather,
  } = useWeather(location.lat, location.lon);
  const { primary: pollenPrimary, types: pollenTypes, refresh: refreshPollen } = usePollen(location.lat, location.lon);

  const [refreshing, setRefreshing] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [forecastDetail, setForecastDetail] = useState(null);
  const [insightModal, setInsightModal] = useState(null);
  const [refreshNote, setRefreshNote] = useState('');
  const refreshWindowRef = useRef([]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const now = Date.now();
    const recentRefreshes = refreshWindowRef.current.filter(
      (timestamp) => now - timestamp < LIVE_REFRESH_WINDOW_MS
    );
    refreshWindowRef.current = recentRefreshes;

    const force = recentRefreshes.length < MAX_LIVE_REFRESHES_PER_WINDOW;
    if (force) {
      refreshWindowRef.current = [...recentRefreshes, now];
      setRefreshNote('Checking fresh live conditions now.');
    } else {
      const retryInMs = Math.max(0, LIVE_REFRESH_WINDOW_MS - (now - recentRefreshes[0]));
      const retryInMinutes = Math.max(1, Math.ceil(retryInMs / 60000));
      setRefreshNote(
        `Using cached conditions for now to save API calls. Fresh live refresh opens again in about ${retryInMinutes} min.`
      );
    }

    try {
      const targetLocation = isUsingDeviceLocation
        ? await refreshLocation(force)
        : location;

      if (targetLocation?.lat != null && targetLocation?.lon != null) {
        await Promise.all([
          refreshAqi(targetLocation.lat, targetLocation.lon, { force }),
          refreshWeather(targetLocation.lat, targetLocation.lon, { force }),
          refreshPollen(targetLocation.lat, targetLocation.lon, { force }),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [
    isUsingDeviceLocation,
    location,
    refreshLocation,
    refreshAqi,
    refreshWeather,
    refreshPollen,
  ]);

  const handleActivityPress = (activity) => {
    navigation.navigate('Activities');
  };

  const freshestUpdate = [aqiUpdatedAt, weatherUpdatedAt].filter(Boolean).sort((a, b) => b - a)[0] || null;
  const lastUpdated = freshestUpdate ? new Date(freshestUpdate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }) : '--';
  const locationDisplay = getLocationDisplay(city);

  const weather = getWeatherDescription(weatherCurrent?.weatherCode);
  const todayForecast = daily?.[0] || null;
  const displayWindGusts = weatherCurrent?.windGusts ?? todayForecast?.windGusts ?? null;
  const displayWindDirection = weatherCurrent?.windDirection ?? todayForecast?.windDirection ?? null;
  const gustsFromForecast = weatherCurrent?.windGusts == null && todayForecast?.windGusts != null;
  const directionFromForecast = weatherCurrent?.windDirection == null && todayForecast?.windDirection != null;
  const currentWindDirection =
    displayWindDirection != null ? getWindDirectionLabel(displayWindDirection) : '--';

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

  // Determine feels-like gauge color
  const feelsLikeTemp = weatherCurrent?.feelsLike;
  const feelsLikeColor =
    feelsLikeTemp != null
      ? feelsLikeTemp < 15
        ? '#5B9CF6'
        : feelsLikeTemp < 30
        ? '#F5A623'
        : '#EF4444'
      : '#7A8BA7';

  // AQI color for pm2.5 metric card
  const pm25Color = pm25 != null ? getAqiColor(pm25) : '#7A8BA7';
  const pollenValue = pollenPrimary?.value;
  const pollenDisplayName = pollenPrimary?.displayName || 'Pollen';
  const pollenCategory = pollenPrimary?.indexDisplayName || pollenPrimary?.category || '--';
  const pollenColor = pollenValue != null ? getAqiColor((pollenValue + 1) * 50) : '#7A8BA7';
  const decision = getHomeDecision({
    aqi,
    temp: weatherCurrent?.temp,
    feelsLike: weatherCurrent?.feelsLike,
    weatherCode: weatherCurrent?.weatherCode,
    pollenValue,
    windSpeed: weatherCurrent?.windSpeed,
  });
  const nextSixHours = hourly.slice(0, 6);
  const peakRainChance = nextSixHours.reduce(
    (max, hour) => Math.max(max, hour?.precipProbability ?? 0),
    0
  );
  const nextActivityWindows = ACTIVITIES.slice(0, 3)
    .map((id) => {
      const activity = getActivityById(id);
      if (!activity) return null;
      const summary = getActivitySummary(activity, aqi ?? 0, weatherCurrent, hourly);
      return {
        name: activity.name,
        score: summary.score,
        bestTime: summary.bestTime,
        label: summary.label,
      };
    })
    .filter(Boolean);
  const homeActivityHighlights = useMemo(
    () =>
      ACTIVITIES.map((id) => {
        const activity = getActivityById(id);
        if (!activity) return null;
        const summary = getActivitySummary(activity, aqi ?? 0, weatherCurrent, hourly);
        return {
          id,
          activity,
          summary,
          toneColor: getActivityToneColor(summary.label),
        };
      })
        .filter(Boolean)
        .sort((a, b) => b.summary.score - a.summary.score),
    [aqi, weatherCurrent, hourly]
  );
  const topHomeActivities = homeActivityHighlights.slice(0, 4);

  const homeAiPayload = useMemo(
    () => ({
      locationName: locationDisplay.primary,
      decisionLabel: decision.label,
      decisionTone: decision.tone,
      aqi,
      pm25,
      temp: weatherCurrent?.temp,
      feelsLike: weatherCurrent?.feelsLike,
      humidity: weatherCurrent?.humidity,
      windSpeed: weatherCurrent?.windSpeed,
      weatherLabel: weather.description,
      weatherCode: weatherCurrent?.weatherCode,
      pollenLabel: pollenCategory,
      pollenValue,
      peakRainChance,
      nextActivityWindows,
    }),
    [
      locationDisplay.primary,
      decision.label,
      decision.tone,
      aqi,
      pm25,
      weatherCurrent?.temp,
      weatherCurrent?.feelsLike,
      weatherCurrent?.humidity,
      weatherCurrent?.windSpeed,
      weatherCurrent?.weatherCode,
      weather.description,
      pollenCategory,
      pollenValue,
      peakRainChance,
      nextActivityWindows,
    ]
  );
  const homeAiSignature = useMemo(
    () =>
      [
        locationDisplay.primary,
        decision.label,
        aqi ?? 'na',
        pm25 ?? 'na',
        weatherCurrent?.temp ?? 'na',
        weatherCurrent?.feelsLike ?? 'na',
        weatherCurrent?.humidity ?? 'na',
        weatherCurrent?.windSpeed ?? 'na',
        weatherCurrent?.weatherCode ?? 'na',
        pollenValue ?? 'na',
        peakRainChance,
      ].join('|'),
    [
      locationDisplay.primary,
      decision.label,
      aqi,
      pm25,
      weatherCurrent?.temp,
      weatherCurrent?.feelsLike,
      weatherCurrent?.humidity,
      weatherCurrent?.windSpeed,
      weatherCurrent?.weatherCode,
      pollenValue,
      peakRainChance,
    ]
  );
  const { data: homeAiBriefing, loading: homeAiLoading } = useAiBriefing({
    kind: 'home',
    signature: homeAiSignature,
    payload: homeAiPayload,
    enabled:
      aqi != null ||
      weatherCurrent?.weatherCode != null ||
      weatherCurrent?.temp != null ||
      pollenValue != null,
  });

  useEffect(() => {
    if (!refreshNote) return undefined;
    const timer = setTimeout(() => setRefreshNote(''), 5000);
    return () => clearTimeout(timer);
  }, [refreshNote]);

  useEffect(() => {
    let cancelled = false;

    if (
      aqi == null &&
      pm25 == null &&
      weatherCurrent?.weatherCode == null &&
      weatherCurrent?.windSpeed == null &&
      pollenValue == null
    ) {
      return undefined;
    }

    (async () => {
      const [notificationPrefs, thresholds] = await Promise.all([
        loadStoredNotifications(),
        loadStoredThresholds(),
      ]);

      if (cancelled) return;

      const placeLabel = locationDisplay.primary || 'your area';
      const placeKey =
        city || `${location.lat?.toFixed?.(2) || '0'}-${location.lon?.toFixed?.(2) || '0'}`;

      if (notificationPrefs.severeAqiWarnings && aqi != null && aqi >= thresholds.aqiAlert) {
        maybeSendLocalAlert(`aqi-${placeKey}`, {
          title: 'Severe AQI warning',
          body: `${placeLabel} is reading AQI ${aqi}. Use an N95 and keep longer outdoor exposure lighter today.`,
        });
      }

      if (notificationPrefs.smogAlerts && pm25 != null && pm25 >= thresholds.pm25Alert) {
        maybeSendLocalAlert(`smog-${placeKey}`, {
          title: 'Smog alert',
          body: `PM2.5 is elevated around ${placeLabel}. A mask and shorter outdoor sessions will help.`,
        });
      }

      if (notificationPrefs.rainAlerts && isRainCode(weatherCurrent?.weatherCode)) {
        maybeSendLocalAlert(`rain-${placeKey}`, {
          title: 'Rain alert',
          body: `Rain is active near ${placeLabel}. Outdoor plans can still work, but carry rain gear and slow down on the road.`,
        });
      }

      if (notificationPrefs.thunderstormAlerts && isStormCode(weatherCurrent?.weatherCode)) {
        maybeSendLocalAlert(`storm-${placeKey}`, {
          title: 'Thunderstorm alert',
          body: `Storm risk is active around ${placeLabel}. Delay exposed outdoor plans until the cell passes.`,
        });
      }

      if (
        notificationPrefs.windAlerts &&
        ((weatherCurrent?.windSpeed ?? 0) >= 28 || (displayWindGusts ?? 0) >= 38)
      ) {
        maybeSendLocalAlert(`wind-${placeKey}`, {
          title: 'Wind alert',
          body: `Wind is picking up around ${placeLabel}. Choose sheltered routes and secure loose items before heading out.`,
        });
      }

      if (notificationPrefs.pollenAlerts && pollenValue != null && pollenValue >= 4) {
        maybeSendLocalAlert(`pollen-${placeKey}`, {
          title: 'High pollen alert',
          body: `${pollenDisplayName} pollen is elevated near ${placeLabel}. A mask and allergy medication can make time outside easier.`,
        });
      }

      if (
        notificationPrefs.heatAlerts &&
        weatherCurrent?.feelsLike != null &&
        weatherCurrent.feelsLike >= thresholds.heatAlert
      ) {
        maybeSendLocalAlert(`heat-${placeKey}`, {
          title: 'Heat alert',
          body: `Feels-like heat is high around ${placeLabel}. Go later, hydrate well, and take shade breaks.`,
        });
      }

      if (notificationPrefs.fogWarnings && isFogCode(weatherCurrent?.weatherCode)) {
        maybeSendLocalAlert(`fog-${placeKey}`, {
          title: 'Low-visibility alert',
          body: `Visibility looks reduced around ${placeLabel}. Slow down and leave extra margin while driving.`,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    aqi,
    city,
    displayWindGusts,
    location.lat,
    location.lon,
    locationDisplay.primary,
    pm25,
    pollenDisplayName,
    pollenValue,
    weatherCurrent?.feelsLike,
    weatherCurrent?.weatherCode,
    weatherCurrent?.windSpeed,
  ]);

  // Loading screen while location is being determined
  if (locationLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Detecting your location...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={Platform.OS !== 'web' ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined}
      >
        {/* ===== 1. Premium Header ===== */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <View style={styles.locationTextGroup}>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                {getGreeting()}
              </Text>
              <TouchableOpacity style={styles.cityRow} onPress={() => setCityPickerVisible(true)} activeOpacity={0.7}>
                <Text style={styles.locationPin}>📍</Text>
                <Text style={[styles.cityText, { color: colors.text }]} numberOfLines={1}>
                  {locationDisplay.primary}
                </Text>
                <Text style={[styles.cityChevron, { color: colors.textSecondary }]}>▼</Text>
              </TouchableOpacity>
              <Text style={[styles.areaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {locationDisplay.secondary}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.webRefreshBtn, { backgroundColor: colors.primary + '14' }]}
                onPress={onRefresh}
                activeOpacity={0.75}
              >
                <Text style={[styles.webRefreshBtnText, { color: colors.primary }]}>Refresh</Text>
              </TouchableOpacity>
            )}
            <View style={styles.headerWeather}>
              <Text style={styles.weatherEmoji}>{weather.icon}</Text>
              <Text style={[styles.headerTemp, { color: colors.text }]}>
                {settings.formatTempShort(weatherCurrent?.temp)}
              </Text>
            </View>
          </View>
        </View>

        {/* Cache Indicator */}
        <CacheIndicator
          visible={aqiCached || weatherCached}
          updatedAt={lastUpdated !== '--' ? lastUpdated : null}
        />
        {!!refreshNote && (
          <View style={[styles.refreshNotice, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
            <Text style={[styles.refreshNoticeText, { color: colors.textSecondary }]}>{refreshNote}</Text>
          </View>
        )}
        {/* ===== Customizable Sections ===== */}
        {settings.homeSections.map((key) => {
          switch (key) {
            case 'decision':
              return (
                <View key="decision" style={styles.section}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.decisionCard,
                      {
                        backgroundColor: decision.bg,
                        borderColor: decision.border,
                      },
                    ]}
                    onPress={() =>
                      setInsightModal({
                        title: decision.label,
                        body: `${decision.tone} ${decision.body}`,
                      })
                    }
                  >
                    <View style={styles.decisionHeader}>
                      <Text style={[styles.decisionEyebrow, { color: colors.textSecondary }]}>Outdoor decision</Text>
                      <Text style={[styles.decisionLabel, { color: decision.color }]}>{decision.label}</Text>
                    </View>
                    <Text style={[styles.decisionTone, { color: colors.text }]}>{decision.tone}</Text>
                    <Text style={[styles.decisionBody, { color: colors.textSecondary }]}>{decision.body}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.aiBriefingCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}
                    onPress={() =>
                      homeAiBriefing &&
                      setInsightModal({
                        title: 'What today means',
                        body: `${homeAiBriefing.headline} ${homeAiBriefing.summary} ${homeAiBriefing.tip}`,
                      })
                    }
                    disabled={!homeAiBriefing}
                  >
                    <Text style={[styles.aiBriefingEyebrow, { color: colors.primary }]}>What today means</Text>
                    <Text style={[styles.aiBriefingTitle, { color: colors.text }]}>
                      {homeAiLoading && !homeAiBriefing ? 'Writing a quick read of today’s conditions…' : homeAiBriefing?.headline || 'Today’s conditions summary will appear here.'}
                    </Text>
                    {!!homeAiBriefing?.summary && (
                      <Text style={[styles.aiBriefingBody, { color: colors.textSecondary }]}>{homeAiBriefing.summary}</Text>
                    )}
                    {!!homeAiBriefing?.tip && (
                      <Text style={[styles.aiBriefingTip, { color: colors.text }]}>{homeAiBriefing.tip}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            case 'travel':
              return (
                <View key="travel" style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Travel Quick Checks</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Travel')} activeOpacity={0.75}>
                      <Text style={[styles.sectionLink, { color: colors.primary }]}>Open travel</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.tripActionGrid}>
                    {HOME_TRIP_ACTIONS.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        style={[
                          styles.tripActionCard,
                          { backgroundColor: colors.card },
                          cardShadow,
                          cardBorder,
                        ]}
                        onPress={() =>
                          navigation.navigate('Travel', {
                            highlightRoute: item.id,
                            requestKey: Date.now(),
                          })
                        }
                      >
                        <View style={styles.tripActionText}>
                          <Text style={[styles.tripActionEyebrow, { color: colors.primary }]}>{item.eyebrow}</Text>
                          <Text style={[styles.tripActionTitle, { color: colors.text }]}>{item.title}</Text>
                          <Text style={[styles.tripActionBody, { color: colors.textSecondary }]}>{item.body}</Text>
                        </View>
                        <View style={[styles.tripActionArrowWrap, { backgroundColor: colors.primary + '14' }]}>
                          <Text style={[styles.tripActionArrow, { color: colors.primary }]}>→</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            case 'aqi':
              return (
                <View key="aqi" style={styles.section}>
                  <AQIHeroCard
                    locationTitle={locationDisplay.primary}
                    locationSubtitle={locationDisplay.secondary}
                    conditionLabel={weather.description}
                    weatherCode={weatherCurrent?.weatherCode}
                    weatherEmoji={weather.icon}
                    tempLabel={settings.formatTempShort(weatherCurrent?.temp)}
                    feelsLikeLabel={settings.formatTemp(weatherCurrent?.feelsLike)}
                    windSpeed={weatherCurrent?.windSpeed}
                    aqi={aqi}
                    pm25={pm25}
                    pm10={pm10}
                    humidity={weatherCurrent?.humidity}
                    loading={aqiLoading || weatherLoading}
                    onPress={() =>
                      setInsightModal({
                        title: 'AQI Insight',
                        body: getAqiInsight(aqi, pm25),
                      })
                    }
                  />
                </View>
              );
            case 'wind':
              return (
                <View key="wind" style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Wind</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      setInsightModal({
                        title: 'Wind Insight',
                        body: getWindInsight({
                          windSpeed: weatherCurrent?.windSpeed,
                          windGusts: displayWindGusts,
                          windDirectionLabel: currentWindDirection,
                          gustsFromForecast,
                          directionFromForecast,
                          formatWind: settings.formatWind,
                        }),
                      })
                    }
                  >
                  <View style={[styles.windCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
                    <View style={styles.windColumns}>
                      <View style={styles.windColumn}>
                        <Text style={[styles.windValue, { color: colors.text }]}>
                          {weatherCurrent?.windSpeed != null
                            ? `${Math.round(settings.convertWind(weatherCurrent.windSpeed))}`
                            : '--'}
                        </Text>
                        <Text style={[styles.windUnit, { color: colors.textSecondary }]}>{settings.windUnitLabel}</Text>
                        <Text style={[styles.windLabel, { color: colors.textSecondary }]}>Speed</Text>
                      </View>
                      <View style={[styles.windDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
                      <View style={styles.windColumn}>
                        <Text style={[styles.windValue, { color: colors.text }]}>
                          {displayWindGusts != null
                            ? `${Math.round(settings.convertWind(displayWindGusts))}`
                            : '--'}
                        </Text>
                        <Text style={[styles.windUnit, { color: colors.textSecondary }]}>{settings.windUnitLabel}</Text>
                        <Text style={[styles.windLabel, { color: colors.textSecondary }]}>
                          {gustsFromForecast ? 'Gusts*' : 'Gusts'}
                        </Text>
                      </View>
                      <View style={[styles.windDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
                      <View style={styles.windColumn}>
                        <Text style={[styles.windValue, { color: colors.text }]}>{currentWindDirection}</Text>
                        <Text style={[styles.windUnit, { color: colors.textSecondary }]}>{' '}</Text>
                        <Text style={[styles.windLabel, { color: colors.textSecondary }]}>
                          {directionFromForecast ? 'Direction*' : 'Direction'}
                        </Text>
                      </View>
                    </View>
                    {(gustsFromForecast || directionFromForecast) && (
                      <Text style={[styles.windFootnote, { color: colors.textSecondary }]}>
                        * Forecast-derived when live station data is unavailable.
                      </Text>
                    )}
                  </View>
                  </TouchableOpacity>
                </View>
              );
            case 'details':
              return (
                <View key="details" style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Details</Text>
                  <View style={styles.detailsGrid}>
                    <View style={[styles.detailCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
                      <Text style={styles.detailIcon}>🌡️</Text>
                      <Text style={[styles.detailValue, { color: feelsLikeColor }]}>
                        {settings.formatTempShort(feelsLikeTemp)}
                      </Text>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Feels Like</Text>
                    </View>
                    <View style={[styles.detailCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
                      <Text style={styles.detailIcon}>💨</Text>
                      <Text style={[styles.detailValue, { color: '#F97316' }]}>
                        {weatherCurrent?.windSpeed != null ? `${Math.round(settings.convertWind(weatherCurrent.windSpeed))}` : '--'}
                      </Text>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Wind {settings.windUnitLabel}</Text>
                    </View>
                    <View style={[styles.detailCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
                      <Text style={styles.detailIcon}>🌫️</Text>
                      <Text style={[styles.detailValue, { color: pm25Color }]}>
                        {pm25 != null ? pm25 : '--'}
                      </Text>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>PM2.5</Text>
                    </View>
                    <View style={[styles.detailCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
                      <Text style={styles.detailIcon}>🌤️</Text>
                      <Text style={[styles.detailValue, { color: colors.primary }]}>
                        {settings.formatTempShort(weatherCurrent?.temp)}
                      </Text>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Temp</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.detailCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}
                      onPress={() =>
                        setInsightModal({
                          title: 'Pollen Insight',
                          body: getPollenInsight(pollenPrimary, pollenTypes),
                        })
                      }
                    >
                      <Text style={styles.detailIcon}>🌼</Text>
                      <Text style={[styles.detailValue, { color: pollenColor }]}>
                        {pollenValue != null ? pollenValue : '--'}
                      </Text>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {pollenDisplayName}: {pollenCategory}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            case 'forecast':
              return (
                <View key="forecast" style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>7-Day Forecast</Text>
                  <ForecastStrip daily={daily} loading={weatherLoading} onDayPress={(day) => setForecastDetail(day)} />
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Next 12 Hours</Text>
                  <HourlyForecastStrip hourly={hourly} />
                </View>
              );
            case 'activities':
              return (
                <View key="activities" style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 4 }]}>Activity Advisory</Text>
                      <Text style={[styles.sectionHeaderHint, { color: colors.textSecondary }]}>
                        Best windows first based on current air, rain, heat, and wind.
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Activities')} activeOpacity={0.75}>
                      <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
                    </TouchableOpacity>
                  </View>
                  {!!topHomeActivities[0] && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleActivityPress(topHomeActivities[0].id)}
                      style={[
                        styles.topActivityHero,
                        { backgroundColor: colors.card },
                        cardShadow,
                        cardBorder,
                      ]}
                    >
                      <View style={styles.topActivityIntro}>
                        <View style={[styles.topActivityBadge, { backgroundColor: topHomeActivities[0].summary.color + '18' }]}>
                          <Text style={[styles.topActivityBadgeText, { color: topHomeActivities[0].summary.color }]}>Best right now</Text>
                        </View>
                        <Text style={[styles.topActivityName, { color: colors.text }]}>
                          {topHomeActivities[0].activity.emoji} {topHomeActivities[0].activity.name}
                        </Text>
                        <Text style={[styles.topActivityMeta, { color: colors.textSecondary }]}>
                          Best {topHomeActivities[0].summary.bestTime}
                        </Text>
                      </View>
                      <View style={styles.topActivityScoreWrap}>
                        <Text style={[styles.topActivityScore, { color: topHomeActivities[0].summary.color }]}>
                          {topHomeActivities[0].summary.score}
                        </Text>
                        <Text style={[styles.topActivityScoreLabel, { color: colors.textSecondary }]}>/100</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <View style={styles.activityGrid}>
                    {topHomeActivities.slice(1).map(({ id, activity }, index) => (
                      <View key={id} style={styles.activityItem}>
                        <ActivityCard
                          activity={activity}
                          aqi={aqi}
                          weather={weatherCurrent}
                          hourly={hourly}
                          onPress={() => handleActivityPress(id)}
                          compact
                          rankLabel={`Top ${index + 2}`}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            default:
              return null;
          }
        })}

        {/* ===== 7. Last Updated ===== */}
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
          Data updated at {lastUpdated}
        </Text>
      </ScrollView>

      {/* ===== City Picker Modal ===== */}
      <Modal visible={cityPickerVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setCityPickerVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: isDark ? '#151D2E' : '#FFFFFF' }]} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Search City</Text>
            <TouchableOpacity
              style={[
                styles.currentLocationRow,
                {
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                },
              ]}
              activeOpacity={0.75}
              onPress={async () => {
                const nextLocation = await refreshLocation(true);
                if (nextLocation?.lat != null && nextLocation?.lon != null) {
                  await Promise.all([
                    refreshAqi(nextLocation.lat, nextLocation.lon, { force: true }),
                    refreshWeather(nextLocation.lat, nextLocation.lon, { force: true }),
                    refreshPollen(nextLocation.lat, nextLocation.lon, { force: true }),
                  ]);
                }
                setCityPickerVisible(false);
              }}
            >
              <Text style={styles.currentLocationRowIcon}>📍</Text>
              <Text style={[styles.currentLocationRowText, { color: colors.text }]}>
                Current Location
              </Text>
            </TouchableOpacity>
            <View style={{ marginBottom: 14 }}>
              <PlacesAutocomplete
                onPlaceSelect={(place) => {
                  selectPlace(place);
                  setCityPickerVisible(false);
                }}
                placeholder="Search cities in Pakistan..."
              />
            </View>
            <Text style={[styles.cityOptionText, { color: colors.textSecondary, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Popular Cities</Text>
            <FlatList
              data={CITIES}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.cityOption,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                    item.name === city && { backgroundColor: isDark ? 'rgba(79,142,247,0.15)' : 'rgba(79,142,247,0.08)' },
                  ]}
                  onPress={() => {
                    selectCity(item.name);
                    setCityPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cityOptionText, { color: colors.text }]}>{item.name}</Text>
                  {item.name === city && <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={insightModal !== null} transparent animationType="fade" onRequestClose={() => setInsightModal(null)}>
        <View style={styles.modalOverlay}>
          {insightModal && (
            <View style={[styles.insightModal, { backgroundColor: isDark ? '#151D2E' : '#FFFFFF' }]}>
              <Text style={[styles.insightTitle, { color: colors.text }]}>{insightModal.title}</Text>
              <Text style={[styles.insightBody, { color: colors.textSecondary }]}>{insightModal.body}</Text>
              <TouchableOpacity
                style={[styles.forecastCloseBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
                onPress={() => setInsightModal(null)}
              >
                <Text style={styles.forecastCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ===== Forecast Detail Modal ===== */}
      <Modal visible={forecastDetail !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {forecastDetail && (() => {
            const weather = getWeatherDescription(forecastDetail.weatherCode);
            const windDir = forecastDetail.windDirection != null ? getWindDirectionLabel(forecastDetail.windDirection) : '--';
            const formatTime = (iso) => {
              if (!iso) return '--';
              const d = new Date(iso);
              return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            };
            return (
                <ScrollView
                  style={[styles.forecastModal, { backgroundColor: isDark ? '#151D2E' : '#FFFFFF' }]}
                  contentContainerStyle={styles.forecastModalContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Header */}
                  <Text style={[styles.forecastModalDay, { color: colors.text }]}>
                    {new Date(forecastDetail.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </Text>
                  <View style={{ marginVertical: 12, alignItems: 'center' }}>
                    <AnimatedWeatherIcon weatherCode={forecastDetail.weatherCode} emoji={weather.icon} size={56} />
                  </View>
                  <Text style={[styles.forecastModalDesc, { color: colors.textSecondary }]}>
                    {weather.description}
                  </Text>

                  {/* Temperature */}
                  <View style={styles.forecastModalTemps}>
                    <View style={styles.forecastTempCol}>
                      <Text style={[styles.forecastTempLabel, { color: colors.textSecondary }]}>High</Text>
                      <Text style={[styles.forecastTempValue, { color: colors.text }]}>{settings.formatTempShort(forecastDetail.maxTemp)}</Text>
                    </View>
                    <View style={[styles.forecastTempDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                    <View style={styles.forecastTempCol}>
                      <Text style={[styles.forecastTempLabel, { color: colors.textSecondary }]}>Low</Text>
                      <Text style={[styles.forecastTempValue, { color: colors.textSecondary }]}>{settings.formatTempShort(forecastDetail.minTemp)}</Text>
                    </View>
                  </View>

                  {/* Detail Grid */}
                  <View style={styles.fdGrid}>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>🌡️</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>Feels Like</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {settings.formatTempShort(forecastDetail.feelsLikeMax)} / {settings.formatTempShort(forecastDetail.feelsLikeMin)}
                      </Text>
                    </View>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>💧</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>Rain Chance</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {forecastDetail.precipProbability != null ? `${forecastDetail.precipProbability}%` : '--'}
                      </Text>
                    </View>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>🌧️</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>Precipitation</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {settings.formatPrecip(forecastDetail.precipitation)}
                      </Text>
                    </View>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>💨</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>Humidity</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {forecastDetail.humidityMax != null ? `${forecastDetail.humidityMin}–${forecastDetail.humidityMax}%` : '--'}
                      </Text>
                    </View>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>🌬️</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>Wind</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {forecastDetail.windSpeed != null ? `${settings.formatWind(forecastDetail.windSpeed)} ${windDir}` : '--'}
                      </Text>
                    </View>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>💥</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>Gusts</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {settings.formatWind(forecastDetail.windGusts)}
                      </Text>
                    </View>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>☀️</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>UV Index</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {forecastDetail.uvIndex != null ? `${forecastDetail.uvIndex} ${getUvLabel(forecastDetail.uvIndex)}` : '--'}
                      </Text>
                    </View>
                    <View style={[styles.fdCell, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }]}>
                      <Text style={styles.fdCellIcon}>🌅</Text>
                      <Text style={[styles.fdCellLabel, { color: colors.textSecondary }]}>Sun</Text>
                      <Text style={[styles.fdCellValue, { color: colors.text }]}>
                        {formatTime(forecastDetail.sunrise)} - {formatTime(forecastDetail.sunset)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.forecastCloseBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setForecastDetail(null)}
                  >
                    <Text style={styles.forecastCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
            );
          })()}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  /* ---- Header Bar ---- */
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingTop: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  locationTextGroup: {
    flexShrink: 1,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationPin: {
    fontSize: 16,
  },
  cityText: {
    fontSize: 20,
    fontWeight: '700',
  },
  areaText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    marginLeft: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  webRefreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  webRefreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  refreshNotice: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  refreshNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  headerWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  weatherEmoji: {
    fontSize: 22,
  },
  headerTemp: {
    fontSize: 24,
    fontWeight: '700',
  },

  /* ---- Sections ---- */
  section: {
    marginBottom: 16,
  },
  decisionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  decisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  decisionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  decisionLabel: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
  decisionTone: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8,
  },
  decisionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  aiBriefingCard: {
    borderRadius: 20,
    padding: 16,
  },
  aiBriefingEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  aiBriefingTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 8,
  },
  aiBriefingBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  aiBriefingTip: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  tripActionStack: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 12,
  },
  sectionHeaderHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tripActionGrid: {
    gap: 10,
  },
  tripActionCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 108,
  },
  tripActionText: {
    flex: 1,
    paddingRight: 10,
  },
  tripActionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  tripActionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  tripActionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  tripActionArrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  tripActionArrowWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  /* ---- Wind Card ---- */
  windCard: {
    borderRadius: 20,
    padding: 20,
  },
  windColumns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  windColumn: {
    flex: 1,
    alignItems: 'center',
  },
  windValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  windUnit: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  windLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  windDivider: {
    width: 1,
    height: 44,
  },
  windFootnote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    textAlign: 'center',
  },

  /* ---- Details Grid ---- */
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  detailValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  detailLabel: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },

  /* ---- Activity Grid ---- */
  activityGrid: {
    gap: 10,
  },
  activityItem: {
    width: '100%',
  },
  topActivityHero: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActivityIntro: {
    flex: 1,
    paddingRight: 10,
  },
  topActivityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  topActivityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  topActivityName: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  topActivityMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  topActivityScoreWrap: {
    alignItems: 'flex-end',
  },
  topActivityScore: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 36,
  },
  topActivityScoreLabel: {
    fontSize: 12,
    marginTop: 4,
  },

  /* ---- Last Updated ---- */
  lastUpdated: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },

  /* ---- City Chevron ---- */
  cityChevron: {
    fontSize: 10,
    marginLeft: 6,
    marginTop: 2,
  },

  /* ---- Modal ---- */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 30,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  currentLocationRowIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  currentLocationRowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  cityOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  insightModal: {
    position: 'absolute',
    top: '18%',
    left: 20,
    right: 20,
    borderRadius: 24,
    padding: 24,
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  insightBody: {
    fontSize: 15,
    lineHeight: 24,
  },

  /* ---- Forecast Detail Modal ---- */
  forecastModal: {
    position: 'absolute',
    top: '8%',
    left: 20,
    right: 20,
    maxHeight: '80%',
    borderRadius: 24,
  },
  forecastModalContent: {
    padding: 24,
    alignItems: 'center',
  },
  forecastModalDay: {
    fontSize: 18,
    fontWeight: '700',
  },
  forecastModalDesc: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  forecastModalTemps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 30,
  },
  forecastTempCol: {
    alignItems: 'center',
  },
  forecastTempLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  forecastTempValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  forecastTempDivider: {
    width: 1,
    height: 40,
  },
  fdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    marginBottom: 20,
  },
  fdCell: {
    width: '47%',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  fdCellIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  fdCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fdCellValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  forecastCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  forecastCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
