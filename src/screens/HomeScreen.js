import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import useLocation from '../hooks/useLocation';
import useAQI from '../hooks/useAQI';
import useWeather from '../hooks/useWeather';
import { getWeatherDescription } from '../utils/weatherCodes';
import { getAqiColor } from '../theme/colors';
import { CITIES } from '../data/cities';
import AQIHeroCard from '../components/AQIHeroCard';
import ForecastStrip from '../components/ForecastStrip';
import ActivityCard from '../components/ActivityCard';
import CacheIndicator from '../components/CacheIndicator';
import ThemeToggle from '../components/ThemeToggle';

const ACTIVITIES = [
  { name: 'Running', icon: '🏃' },
  { name: 'Cricket', icon: '🏏' },
  { name: 'Cycling', icon: '🚴' },
  { name: 'Walking', icon: '🚶' },
  { name: 'Outdoor Dining', icon: '🍽️' },
  { name: 'School Outdoor', icon: '🏫' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { location, city, loading: locationLoading, refresh: refreshLocation, selectCity } = useLocation();
  const {
    aqi,
    pm25,
    pm10,
    loading: aqiLoading,
    isUsingCache: aqiCached,
    refresh: refreshAqi,
  } = useAQI(city);
  const {
    current: weatherCurrent,
    daily,
    loading: weatherLoading,
    isUsingCache: weatherCached,
    refresh: refreshWeather,
  } = useWeather(location.lat, location.lon);

  const [refreshing, setRefreshing] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [forecastDetail, setForecastDetail] = useState(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLocation();
    refreshAqi();
    refreshWeather();
    setRefreshing(false);
  }, [refreshLocation, refreshAqi, refreshWeather]);

  const handleActivityPress = (activity) => {
    navigation.navigate('Activities');
  };

  const lastUpdated = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const weather = getWeatherDescription(weatherCurrent?.weatherCode);

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
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
                  {city}
                </Text>
                <Text style={[styles.cityChevron, { color: colors.textSecondary }]}>▼</Text>
              </TouchableOpacity>
              <Text style={[styles.areaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {city}, Pakistan
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerWeather}>
              <Text style={styles.weatherEmoji}>{weather.icon}</Text>
              <Text style={[styles.headerTemp, { color: colors.text }]}>
                {weatherCurrent?.temp != null ? `${Math.round(weatherCurrent.temp)}°` : '--'}
              </Text>
            </View>
            <ThemeToggle />
          </View>
        </View>

        {/* Cache Indicator */}
        <CacheIndicator visible={aqiCached || weatherCached} />

        {/* ===== 2. AQI Hero Card ===== */}
        <View style={styles.section}>
          <AQIHeroCard aqi={aqi} pm25={pm25} pm10={pm10} humidity={weatherCurrent?.humidity} loading={aqiLoading} />
        </View>

        {/* ===== 3. Wind Section ===== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Wind</Text>
          <View
            style={[
              styles.windCard,
              { backgroundColor: colors.card },
              cardShadow,
              cardBorder,
            ]}
          >
            <View style={styles.windColumns}>
              <View style={styles.windColumn}>
                <Text style={[styles.windValue, { color: colors.text }]}>
                  {weatherCurrent?.windSpeed != null
                    ? `${Math.round(weatherCurrent.windSpeed)}`
                    : '--'}
                </Text>
                <Text style={[styles.windUnit, { color: colors.textSecondary }]}>km/h</Text>
                <Text style={[styles.windLabel, { color: colors.textSecondary }]}>Speed</Text>
              </View>
              <View
                style={[
                  styles.windDivider,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                ]}
              />
              <View style={styles.windColumn}>
                <Text style={[styles.windValue, { color: colors.text }]}>--</Text>
                <Text style={[styles.windUnit, { color: colors.textSecondary }]}>km/h</Text>
                <Text style={[styles.windLabel, { color: colors.textSecondary }]}>Gusts</Text>
              </View>
              <View
                style={[
                  styles.windDivider,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                ]}
              />
              <View style={styles.windColumn}>
                <Text style={[styles.windValue, { color: colors.text }]}>--</Text>
                <Text style={[styles.windUnit, { color: colors.textSecondary }]}>{' '}</Text>
                <Text style={[styles.windLabel, { color: colors.textSecondary }]}>Direction</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== 4. Current Details Section ===== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Details</Text>
          <View style={styles.detailsGrid}>
            <View style={[styles.detailCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
              <Text style={styles.detailIcon}>🌡️</Text>
              <Text style={[styles.detailValue, { color: feelsLikeColor }]}>
                {feelsLikeTemp != null ? `${Math.round(feelsLikeTemp)}°` : '--'}
              </Text>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Feels Like</Text>
            </View>
            <View style={[styles.detailCard, { backgroundColor: colors.card }, cardShadow, cardBorder]}>
              <Text style={styles.detailIcon}>💨</Text>
              <Text style={[styles.detailValue, { color: '#F97316' }]}>
                {weatherCurrent?.windSpeed != null ? `${Math.round(weatherCurrent.windSpeed)}` : '--'}
              </Text>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Wind km/h</Text>
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
                {weatherCurrent?.temp != null ? `${Math.round(weatherCurrent.temp)}°` : '--'}
              </Text>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Temp</Text>
            </View>
          </View>
        </View>

        {/* ===== 5. 7-Day Forecast ===== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>7-Day Forecast</Text>
          <ForecastStrip daily={daily} loading={weatherLoading} onDayPress={(day) => setForecastDetail(day)} />
        </View>

        {/* ===== 6. Activity Advisory ===== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity Advisory</Text>
          <View style={styles.activityGrid}>
            {ACTIVITIES.map((activity) => (
              <View key={activity.name} style={styles.activityItem}>
                <ActivityCard
                  name={activity.name}
                  icon={activity.icon}
                  aqi={aqi}
                  onPress={() => handleActivityPress(activity)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* ===== 7. Last Updated ===== */}
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
          Last updated at {lastUpdated}
        </Text>
      </ScrollView>

      {/* ===== City Picker Modal ===== */}
      <Modal visible={cityPickerVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setCityPickerVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#151D2E' : '#FFFFFF' }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select City</Text>
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
          </View>
        </Pressable>
      </Modal>

      {/* ===== Forecast Detail Modal ===== */}
      <Modal visible={forecastDetail !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setForecastDetail(null)}>
          {forecastDetail && (
            <View style={[styles.forecastModal, { backgroundColor: isDark ? '#151D2E' : '#FFFFFF' }]}>
              <Text style={[styles.forecastModalDay, { color: colors.text }]}>
                {new Date(forecastDetail.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <Text style={{ fontSize: 48, textAlign: 'center', marginVertical: 12 }}>
                {getWeatherDescription(forecastDetail.weatherCode).icon}
              </Text>
              <Text style={[styles.forecastModalDesc, { color: colors.textSecondary }]}>
                {getWeatherDescription(forecastDetail.weatherCode).description}
              </Text>
              <View style={styles.forecastModalTemps}>
                <View style={styles.forecastTempCol}>
                  <Text style={[styles.forecastTempLabel, { color: colors.textSecondary }]}>High</Text>
                  <Text style={[styles.forecastTempValue, { color: colors.text }]}>{Math.round(forecastDetail.maxTemp)}°</Text>
                </View>
                <View style={[styles.forecastTempDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                <View style={styles.forecastTempCol}>
                  <Text style={[styles.forecastTempLabel, { color: colors.textSecondary }]}>Low</Text>
                  <Text style={[styles.forecastTempValue, { color: colors.textSecondary }]}>{Math.round(forecastDetail.minTemp)}°</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.forecastCloseBtn, { backgroundColor: colors.primary }]}
                onPress={() => setForecastDetail(null)}
              >
                <Text style={styles.forecastCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.2,
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

  /* ---- Forecast Detail Modal ---- */
  forecastModal: {
    position: 'absolute',
    top: '25%',
    left: 24,
    right: 24,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  forecastModalDay: {
    fontSize: 18,
    fontWeight: '700',
  },
  forecastModalDesc: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
  },
  forecastModalTemps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
