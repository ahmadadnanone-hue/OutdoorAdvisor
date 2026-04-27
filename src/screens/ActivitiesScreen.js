import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import useAQI from '../hooks/useAQI';
import useWeather from '../hooks/useWeather';
import { useLocationContext } from '../context/LocationContext';
import { getWeatherDescription } from '../utils/weatherCodes';
import { getActivitySummary } from '../utils/activityScoring';
import { ACTIVITY_CATALOG, getActivityById } from '../data/activities';
import { ScreenGradient } from '../components/layout';
import { GlassCard } from '../components/glass';
import { colors as dc } from '../design';
import { fetchApiJson } from '../config/api';
import { GOOGLE_MAPS_API_KEY } from '../config/googleApi';
import Icon, { ICON } from '../components/Icon';

function getScoreBand(score) {
  if (score >= 75) return 'Great now';
  if (score >= 60) return 'Usable window';
  if (score >= 45) return 'Go with care';
  return 'Better later';
}

function getSmartAdvisory(activity, aqi, weather) {
  const indoorShelterActivities = new Set(['yoga', 'badminton', 'martial_arts']);
  const temp = weather?.temp;
  const humidity = weather?.humidity;
  const windSpeed = weather?.windSpeed;
  const weatherCode = weather?.weatherCode;
  const feelsLike = weather?.feelsLike;

  const isRaining = weatherCode && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);
  const isHeavyRain = weatherCode && [65, 82].includes(weatherCode);
  const isStormy = weatherCode && [95, 96, 99].includes(weatherCode);
  const isFoggy = weatherCode && [45, 48].includes(weatherCode);
  const heatValue = feelsLike ?? temp;
  const isExtremeHeat = heatValue != null && heatValue >= 47;
  const isVeryHot = heatValue != null && heatValue >= 38;
  const isCold = temp != null && temp <= 10;
  const isHighHumidity = humidity != null && humidity >= 85;
  const isHighWind = windSpeed != null && windSpeed >= 30;
  const isSmoggy = aqi > 150;
  const isHazardousAir = aqi > 300;
  const isVeryUnhealthyAir = aqi > 200;
  const prefersIndoor = indoorShelterActivities.has(activity.id);

  const recs = [];
  if (prefersIndoor && aqi > 100) {
    recs.push('This is one of the better options today because the session can happen indoors, away from the worst outdoor air and heat.');
  }
  if (aqi <= 50) recs.push('Air quality is excellent right now, so most outdoor plans should feel comfortable.');
  else if (aqi <= 100) recs.push('Air quality is generally fine for going out. Sensitive users may want lighter effort near busy roads.');
  else if (aqi <= 150) recs.push('Air quality is elevated, but most people can still go out if they keep sessions moderate and avoid high-traffic routes.');
  else if (aqi <= 200) recs.push('Air quality is poor enough to plan smart: shorten hard workouts, choose cleaner areas, and wear an N95 mask if you are sensitive or staying out for long.');
  else if (aqi <= 300) recs.push('Air quality is very poor. Keep outdoor time brief and light, use a well-fitted N95 mask, and move intense exercise indoors.');
  else recs.push('Air quality is hazardous right now. Go outside only if necessary, keep exposure short, and use a well-fitted N95 mask.');

  if (isExtremeHeat) recs.push(`Heat is the bigger risk right now at feels-like ${Math.round(heatValue)}C. Save outdoor activity for early or late hours, keep trips short, and avoid hard exertion.`);
  else if (isVeryHot) recs.push('It is hot enough to plan around the heat. Go earlier or later in the day, drink water often, and take shade breaks.');
  if (isCold) recs.push(`Cold conditions at ${Math.round(temp)}C can tighten airways, so layer up and give yourself a longer warm-up.`);
  if (isStormy) recs.push('Thunderstorms are a real safety risk. Wait for the storm to pass before heading out.');
  else if (isHeavyRain) recs.push('Heavy rain can still work for necessary trips, but use waterproof gear, slow down, and avoid flooded or low-visibility stretches.');
  else if (isRaining) recs.push('Light rain is manageable with waterproof gear and good grip, especially for shorter outdoor plans.');
  if (isFoggy) recs.push('Fog lowers visibility, so stick to parks or quieter roads and avoid fast traffic corridors.');
  if (isHighHumidity && isVeryHot) recs.push(`Humidity is ${humidity}%, which makes the heat feel heavier. Take cooling breaks and do less than you normally would.`);
  else if (isHighHumidity) recs.push(`Humidity is high at ${humidity}%, so effort may feel tougher than usual even if the temperature looks manageable.`);
  if (isHighWind) recs.push(`Strong winds at ${Math.round(windSpeed)} km/h. Cycling, tennis, and cricket may be significantly affected.`);
  if (prefersIndoor && aqi > 100) recs.push('If you go, choose a gym, studio, court, or hall with HEPA filters or visible air purifiers running.');

  if (recs.length === 1 && aqi <= 50 && !isVeryHot && !isCold && !isRaining) {
    recs.push('Weather conditions are favorable, so this is a good window for outdoor plans.');
  }

  const tips = [...activity.tips];
  if (isExtremeHeat || isVeryHot) {
    tips.unshift('Drink water every 15-20 minutes. Carry electrolytes for sessions over 30 minutes.');
    tips.unshift('Wear light-colored, breathable clothing and apply sunscreen SPF 50+.');
  }
  if (isCold) tips.unshift('Wear layered clothing and cover extremities. Warm up for 10+ minutes before starting.');
  if (isRaining) tips.unshift('Wear waterproof gear and shoes with good grip. Avoid flooded areas and give yourself extra travel time.');
  if (isSmoggy) tips.unshift('Wear an N95 mask, choose a cleaner route, and keep the session shorter than usual.');
  if (isHighHumidity && isVeryHot) tips.unshift('Take breaks in air-conditioned spaces every 15 minutes to prevent heat exhaustion.');
  if (prefersIndoor) tips.unshift('Prefer venues with air purifiers, HEPA filtration, or a visibly well-managed ventilation system.');

  let healthImpact = activity.healthImpact;
  if (isHazardousAir) healthImpact += ` Current AQI (${aqi}) is hazardous, so even brief exposure can aggravate breathing and cardiovascular symptoms.`;
  else if (isVeryUnhealthyAir) healthImpact += ` Current AQI (${aqi}) will noticeably increase your particle intake, so shorter sessions, a mask, and cleaner routes matter much more than usual.`;
  else if (isSmoggy) healthImpact += ` Current AQI (${aqi}) is high enough that harder breathing will pull more particles into the lungs, especially during longer or higher-intensity sessions.`;
  if (isExtremeHeat) healthImpact += ` With feels-like conditions near ${Math.round(heatValue)}C, your body's cooling system is under heavy stress.`;
  if (isHighHumidity && isVeryHot) healthImpact += ` High humidity (${humidity}%) slows sweat evaporation, so you heat up faster and recover more slowly.`;
  if (isCold) healthImpact += ` Cold air at ${Math.round(temp)}C can constrict airways and trigger exercise-induced asthma.`;

  let indoorAlt = activity.indoorAlt;
  if (isStormy) indoorAlt = 'While the storm is active, indoor options are the safer call. ' + indoorAlt;
  else if (isExtremeHeat) indoorAlt = 'If you still want activity today, indoor options are the cooler and safer call. ' + indoorAlt;
  else if (isHazardousAir) indoorAlt = 'With hazardous air quality, indoor options are strongly recommended right now. ' + indoorAlt;
  else if (isVeryUnhealthyAir) indoorAlt = 'If you want to avoid heavy smoke exposure, indoor options are the better choice for longer or harder sessions. ' + indoorAlt;
  if (prefersIndoor) indoorAlt += ' Try to pick a venue with air purifiers or strong HVAC filtration so the indoor air is meaningfully cleaner than outside.';

  return { recommendation: recs.join(' '), tips: tips.slice(0, 5), healthImpact, indoorAlt };
}

async function fetchNearbyPlacesDirect({ activity, lat, lon }) {
  const textQuery = activity.placesQuery || activity.name;
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.types,places.rating,places.userRatingCount,places.location,places.shortFormattedAddress,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery,
      pageSize: 6,
      rankPreference: 'DISTANCE',
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius: 4500,
        },
      },
    }),
  });

  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || 'Direct Places lookup failed.');
  }

  return Array.isArray(json.places)
    ? json.places.map((p) => ({
        id: p.id,
        name: p.displayName?.text || '',
        types: p.types || [],
        rating: p.rating ?? null,
        userRatingCount: p.userRatingCount ?? null,
        location: p.location
          ? { lat: p.location.latitude, lon: p.location.longitude }
          : null,
        address: p.shortFormattedAddress || p.formattedAddress || '',
      }))
    : [];
}

async function openPlaceInMaps(place) {
  const label = encodeURIComponent(place?.name || 'Location');
  const hasCoords = place?.location?.lat != null && place?.location?.lon != null;
  const coords = hasCoords ? `${place.location.lat},${place.location.lon}` : null;
  const appleUrl = hasCoords
    ? `http://maps.apple.com/?ll=${coords}&q=${label}`
    : `http://maps.apple.com/?q=${encodeURIComponent(place?.address || place?.name || 'Location')}`;
  const webUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${coords}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place?.address || place?.name || 'Location')}`;

  try {
    const preferred = Platform.OS === 'ios' ? appleUrl : webUrl;
    const supported = await Linking.canOpenURL(preferred);
    await Linking.openURL(supported ? preferred : webUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
}

export default function ActivitiesScreen() {
  const { enabledActivities, addActivity, removeActivity } = useSettings();
  const { isPremium } = useAuth();
  const { city, location, loading: locLoading } = useLocationContext();
  const { aqi, loading: aqiLoading } = useAQI(location.lat, location.lon);
  const { current: weatherCurrent, hourly } = useWeather(location.lat, location.lon);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');

  const loading = locLoading || aqiLoading;
  const currentAqi = aqi ?? 0;

  const aqiColor =
    currentAqi <= 50 ? dc.accentGreen
    : currentAqi <= 100 ? dc.accentYellow
    : currentAqi <= 150 ? dc.accentOrange
    : currentAqi <= 200 ? dc.accentOrange
    : dc.accentRed;

  useEffect(() => {
    let cancelled = false;

    async function loadNearbyPlaces() {
      if (!selectedActivity || !isPremium || !selectedActivity.placesQuery) {
        setNearbyPlaces([]);
        setNearbyError('');
        setNearbyLoading(false);
        return;
      }

      setNearbyLoading(true);
      setNearbyError('');

      try {
        const params = new URLSearchParams({
          lat: String(location.lat),
          lon: String(location.lon),
          radius: '4500',
          maxResults: '6',
        });

        if (selectedActivity.placesType) {
          params.set('types', selectedActivity.placesType);
        } else {
          params.set('query', selectedActivity.placesQuery);
        }

        let places = [];
        try {
          const json = await fetchApiJson(`/api/poi/nearby?${params.toString()}`);
          places = Array.isArray(json.places) ? json.places : [];
        } catch (apiError) {
          if (Platform.OS === 'web') throw apiError;
          places = await fetchNearbyPlacesDirect({
            activity: selectedActivity,
            lat: location.lat,
            lon: location.lon,
          });
        }

        if (!cancelled) {
          setNearbyPlaces(places);
        }
      } catch (error) {
        if (!cancelled) {
          setNearbyPlaces([]);
          setNearbyError('Could not load nearby places right now.');
        }
      } finally {
        if (!cancelled) {
          setNearbyLoading(false);
        }
      }
    }

    loadNearbyPlaces();
    return () => {
      cancelled = true;
    };
  }, [selectedActivity, isPremium, location.lat, location.lon]);

  const rankedActivities = useMemo(
    () =>
      enabledActivities
        .map((id) => {
          const activity = getActivityById(id);
          if (!activity) return null;
          const summary = getActivitySummary(activity, currentAqi, weatherCurrent, hourly);
          return { ...activity, summary };
        })
        .filter(Boolean)
        .sort((a, b) => b.summary.score - a.summary.score),
    [enabledActivities, currentAqi, weatherCurrent, hourly]
  );

  const gridData = useMemo(
    () => [...rankedActivities, { id: '__add__', isAddCard: true }],
    [rankedActivities]
  );

  const renderCard = ({ item }) => {
    if (item.isAddCard) {
      return (
        <TouchableOpacity
          style={[styles.card, styles.addCard]}
          activeOpacity={0.7}
          onPress={() => setAddModalVisible(true)}
        >
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addCardName}>Add Activity</Text>
        </TouchableOpacity>
      );
    }
    const activitySummary = item.summary;
    const rank = rankedActivities.findIndex((a) => a.id === item.id) + 1;
    const isTop = rank <= 2;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: dc.cardGlass,
            borderColor: isTop ? activitySummary.color + '66' : dc.cardStrokeSoft,
          },
        ]}
        activeOpacity={0.7}
        onPress={() => setSelectedActivity(item)}
      >
        <View style={styles.cardTopRow}>
          <Icon name={item.icon} size={36} color={activitySummary.color} style={styles.cardEmoji} />
          <View style={[styles.rankPill, { backgroundColor: activitySummary.color + '22' }]}>
            <Text style={[styles.rankPillText, { color: activitySummary.color }]}>#{rank}</Text>
          </View>
        </View>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.cardScore, { color: activitySummary.color }]}>
          {activitySummary.score}/100
        </Text>
        <Text style={styles.cardHint} numberOfLines={1}>{activitySummary.bestTime}</Text>
        <Text style={styles.cardSubHint} numberOfLines={1}>{getScoreBand(activitySummary.score)}</Text>
        <View style={[styles.badge, { backgroundColor: activitySummary.color + '22' }]}>
          <Text style={[styles.badgeText, { color: activitySummary.color }]}>{activitySummary.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScreenGradient>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color={dc.accentCyan} />
          <Text style={styles.loadingText}>Loading conditions...</Text>
        </SafeAreaView>
      </ScreenGradient>
    );
  }

  return (
    <ScreenGradient>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Activities</Text>
          <View style={styles.headerInfo}>
            <Text style={styles.cityLabel} numberOfLines={1}>{city}</Text>
            <View style={[styles.aqiBadge, { backgroundColor: aqiColor + '22' }]}>
              <Text style={[styles.aqiBadgeText, { color: aqiColor }]}>AQI {currentAqi}</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={gridData}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />

        {/* Add Activity Modal */}
        <Modal
          visible={addModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setAddModalVisible(false)}
        >
          <ScreenGradient>
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.addModalHeader}>
                <Text style={styles.modalTitle}>Manage Activities</Text>
                <Text style={styles.addModalSubtitle}>Tap to add or remove activities from your dashboard.</Text>
              </View>
              <ScrollView contentContainerStyle={styles.addListContent} showsVerticalScrollIndicator={false}>
                {ACTIVITY_CATALOG.map((act) => {
                  const enabled = enabledActivities.includes(act.id);
                  return (
                    <TouchableOpacity
                      key={act.id}
                      style={[
                        styles.addRow,
                        {
                          backgroundColor: dc.cardGlass,
                          borderColor: enabled ? dc.accentCyan : dc.cardStrokeSoft,
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => (enabled ? removeActivity(act.id) : addActivity(act.id))}
                    >
                      <Icon name={act.icon} size={28} color={dc.accentCyan} style={styles.addRowEmoji} />
                      <View style={styles.addRowInfo}>
                        <Text style={styles.addRowName}>{act.name}</Text>
                        {act.placesQuery && (
                          <Text style={styles.addRowHint} numberOfLines={1}>Shows nearby {act.placesQuery}</Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.addToggle,
                          {
                            backgroundColor: enabled ? dc.accentCyan : 'transparent',
                            borderColor: enabled ? dc.accentCyan : dc.cardStrokeSoft,
                          },
                        ]}
                      >
                        <Text style={[styles.addToggleIcon, { color: enabled ? dc.bgTop : dc.textSecondary }]}>
                          {enabled ? '✓' : '+'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: dc.accentCyan }]}
                onPress={() => setAddModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.closeBtnText, { color: dc.bgTop }]}>Done</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </ScreenGradient>
        </Modal>

        {/* Detail Modal */}
        <Modal
          visible={selectedActivity !== null}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setSelectedActivity(null)}
        >
          {selectedActivity && (() => {
            const advisory = getSmartAdvisory(selectedActivity, currentAqi, weatherCurrent);
            const activitySummary = getActivitySummary(selectedActivity, currentAqi, weatherCurrent, hourly);
            const weatherDesc = getWeatherDescription(weatherCurrent?.weatherCode);
            return (
              <ScreenGradient>
                <SafeAreaView style={styles.modalContainer}>
                  <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                    <Icon name={selectedActivity.icon} size={64} color={dc.accentCyan} style={styles.modalEmoji} />
                    <Text style={styles.modalTitle}>{selectedActivity.name}</Text>

                    {/* Conditions bar */}
                    <GlassCard style={styles.conditionsCard} contentStyle={styles.conditionsBar}>
                      <View style={styles.conditionItem}>
                        <Text style={[styles.conditionValue, { color: aqiColor }]}>{currentAqi}</Text>
                        <Text style={styles.conditionLabel}>AQI</Text>
                      </View>
                      <View style={styles.conditionDivider} />
                      <View style={styles.conditionItem}>
                        <Text style={styles.conditionValue}>
                          {weatherCurrent?.temp != null ? `${Math.round(weatherCurrent.temp)}` : '--'}
                        </Text>
                        <Text style={styles.conditionLabel}>Temp</Text>
                      </View>
                      <View style={styles.conditionDivider} />
                      <View style={styles.conditionItem}>
                        <Text style={[styles.conditionValue, { color: dc.accentCyan }]}>
                          {weatherCurrent?.humidity ?? '--'}%
                        </Text>
                        <Text style={styles.conditionLabel}>Humidity</Text>
                      </View>
                      <View style={styles.conditionDivider} />
                      <View style={styles.conditionItem}>
                        <Text style={styles.conditionValue}>{weatherDesc.icon}</Text>
                        <Text style={styles.conditionLabel}>Weather</Text>
                      </View>
                      <View style={styles.conditionDivider} />
                      <View style={styles.conditionItem}>
                        <View style={[styles.modalStatusBadge, { backgroundColor: activitySummary.color + '22' }]}>
                          <Text style={[styles.modalStatusSmall, { color: activitySummary.color }]}>
                            {activitySummary.label}
                          </Text>
                        </View>
                        <Text style={styles.conditionLabel}>Status</Text>
                      </View>
                    </GlassCard>

                    {/* Summary row */}
                    <View style={styles.summaryRow}>
                      <GlassCard style={styles.summaryCardWrap} contentStyle={styles.summaryCardContent}>
                        <Text style={styles.summaryLabel}>Activity Score</Text>
                        <Text style={[styles.summaryValue, { color: activitySummary.color }]}>
                          {activitySummary.score}/100
                        </Text>
                        <Text style={styles.summaryMeta}>{activitySummary.label}</Text>
                      </GlassCard>
                      <GlassCard style={styles.summaryCardWrap} contentStyle={styles.summaryCardContent}>
                        <Text style={styles.summaryLabel}>Best Time Today</Text>
                        <Text style={styles.summaryValuePrimary}>{activitySummary.bestTime}</Text>
                        <Text style={styles.summaryMeta}>Based on strongest upcoming window</Text>
                      </GlassCard>
                    </View>

                    <DetailSection title="Why This Score" accentColor={dc.accentCyan}>
                      {activitySummary.rationale.map((line, idx) => (
                        <View key={idx} style={styles.tipRow}>
                          <Text style={styles.tipBullet}>•</Text>
                          <Text style={styles.tipText}>{line}</Text>
                        </View>
                      ))}
                      <Text style={styles.scoreWhyMeta}>Best-case setup: {activitySummary.idealScenario}</Text>
                      <Text style={styles.scoreWhyMeta}>Activity profile: {activitySummary.profileReason}</Text>
                    </DetailSection>

                    <DetailSection title="Recommendation" accentColor={dc.accentCyan}>
                      <Text style={styles.sectionBody}>{advisory.recommendation}</Text>
                    </DetailSection>

                    <DetailSection title="Health Impact" accentColor={dc.accentCyan}>
                      <Text style={styles.sectionBody}>{advisory.healthImpact}</Text>
                    </DetailSection>

                    <DetailSection title="Tips" accentColor={dc.accentCyan}>
                      {advisory.tips.map((tip, idx) => (
                        <View key={idx} style={styles.tipRow}>
                          <Text style={styles.tipBullet}>{idx + 1}.</Text>
                          <Text style={styles.tipText}>{tip}</Text>
                        </View>
                      ))}
                    </DetailSection>


                    <DetailSection title="Indoor Alternatives" accentColor={dc.accentCyan}>
                      <Text style={styles.sectionBody}>{advisory.indoorAlt}</Text>
                    </DetailSection>

                    {selectedActivity.placesQuery ? (
                      <DetailSection title="Recommended Nearby Places" accentColor={dc.accentCyan}>
                        {!isPremium ? (
                          <Text style={styles.sectionBodyMuted}>
                            Premium unlock: nearby places for this activity around your current location.
                          </Text>
                        ) : nearbyLoading ? (
                          <Text style={styles.sectionBodyMuted}>Loading nearby places…</Text>
                        ) : nearbyError ? (
                          <Text style={styles.sectionBodyMuted}>{nearbyError}</Text>
                        ) : nearbyPlaces.length === 0 ? (
                          <Text style={styles.sectionBodyMuted}>
                            No strong nearby matches found for {selectedActivity.placesQuery} around your current area.
                          </Text>
                        ) : (
                          <View style={styles.placesList}>
                            {nearbyPlaces.map((place, idx) => (
                              <View key={place.id || `${place.name}-${idx}`} style={styles.placeRow}>
                                <View style={styles.placeCopy}>
                                  <Text style={styles.placeName}>{place.name || 'Nearby place'}</Text>
                                  {!!place.address && (
                                    <Text style={styles.placeMeta}>{place.address}</Text>
                                  )}
                                </View>
                                <View style={styles.placeActions}>
                                  <View style={styles.placeBadge}>
                                    <Text style={styles.placeBadgeText}>
                                      {place.rating ? `${Number(place.rating).toFixed(1)}★` : 'Nearby'}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={styles.mapButton}
                                    onPress={() => openPlaceInMaps(place)}
                                    activeOpacity={0.8}
                                  >
                                    <Icon name={ICON.external} size={14} color={dc.accentCyan} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </DetailSection>
                    ) : null}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.closeBtn, { backgroundColor: dc.accentCyan }]}
                    onPress={() => setSelectedActivity(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.closeBtnText, { color: dc.bgTop }]}>Close</Text>
                  </TouchableOpacity>
                </SafeAreaView>
              </ScreenGradient>
            );
          })()}
        </Modal>
      </SafeAreaView>
    </ScreenGradient>
  );
}

function DetailSection({ title, accentColor, children }) {
  return (
    <GlassCard style={styles.section} contentStyle={styles.sectionContent}>
      <Text style={[styles.sectionTitle, { color: accentColor }]}>{title}</Text>
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: dc.textSecondary },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 34, fontWeight: '800', color: dc.textPrimary, letterSpacing: -0.8 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  cityLabel: { fontSize: 15, color: dc.textSecondary, flexShrink: 1 },
  aqiBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  aqiBadgeText: { fontSize: 12, fontWeight: '700' },

  grid: { paddingHorizontal: 12, paddingBottom: 24 },
  row: { justifyContent: 'space-between', paddingHorizontal: 4 },

  card: {
    flex: 1,
    marginHorizontal: 4,
    marginVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 190,
  },
  cardTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addCard: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: dc.cardStroke,
    justifyContent: 'center',
    backgroundColor: dc.cardGlass,
  },
  addPlus: { fontSize: 44, fontWeight: '300', lineHeight: 48, marginBottom: 4, color: dc.accentCyan },
  addCardName: { fontSize: 15, fontWeight: '700', color: dc.accentCyan },
  cardEmoji: { marginBottom: 4 },
  rankPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rankPillText: { fontSize: 11, fontWeight: '700' },
  cardName: { fontSize: 15, fontWeight: '700', color: dc.textPrimary, marginBottom: 10, textAlign: 'center', minHeight: 42 },
  cardScore: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 11, color: dc.textSecondary, marginBottom: 4, textAlign: 'center' },
  cardSubHint: { fontSize: 11, color: dc.textMuted, marginBottom: 10, textAlign: 'center' },
  badge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  modalContainer: { flex: 1 },
  addModalHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  addModalSubtitle: { fontSize: 13, color: dc.textSecondary, marginTop: 6 },
  addListContent: { paddingHorizontal: 16, paddingBottom: 20 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  addRowEmoji: { marginRight: 12 },
  addRowInfo: { flex: 1 },
  addRowName: { fontSize: 15, fontWeight: '600', color: dc.textPrimary },
  addRowHint: { fontSize: 12, color: dc.textSecondary, marginTop: 2 },
  addToggle: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  addToggleIcon: { fontSize: 18, fontWeight: '700' },

  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, alignItems: 'center' },
  modalEmoji: { marginBottom: 12 },
  modalTitle: { fontSize: 28, fontWeight: '800', color: dc.textPrimary, marginBottom: 20 },

  conditionsCard: { width: '100%', marginBottom: 16 },
  conditionsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: 14 },
  conditionItem: { alignItems: 'center', flex: 1 },
  conditionValue: { fontSize: 17, fontWeight: '800', color: dc.textPrimary, marginBottom: 4 },
  conditionLabel: { fontSize: 9, fontWeight: '600', color: dc.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  conditionDivider: { width: 1, height: 32, backgroundColor: dc.cardStrokeSoft },
  modalStatusSmall: { fontSize: 11, fontWeight: '700' },
  modalStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

  summaryRow: { width: '100%', flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCardWrap: { flex: 1 },
  summaryCardContent: { padding: 14 },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: dc.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  summaryValue: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  summaryValuePrimary: { fontSize: 18, fontWeight: '800', color: dc.textPrimary, marginBottom: 4 },
  summaryMeta: { fontSize: 11, color: dc.textSecondary, lineHeight: 16 },

  section: { width: '100%', marginBottom: 12 },
  sectionContent: { padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  sectionBody: { fontSize: 15, color: dc.textPrimary, lineHeight: 24 },
  sectionBodyMuted: { fontSize: 15, color: dc.textSecondary, lineHeight: 24 },
  scoreWhyMeta: { fontSize: 12, color: dc.textSecondary, lineHeight: 20, marginTop: 8 },
  tipRow: { flexDirection: 'row', marginBottom: 6, paddingRight: 8 },
  tipBullet: { fontSize: 15, fontWeight: '700', color: dc.accentCyan, marginRight: 8, minWidth: 18 },
  tipText: { fontSize: 15, color: dc.textPrimary, lineHeight: 24, flex: 1 },
  placesList: { gap: 10 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: dc.cardGlass,
    borderWidth: 1,
    borderColor: dc.cardStrokeSoft,
  },
  placeCopy: { flex: 1, paddingRight: 10 },
  placeName: { fontSize: 14, fontWeight: '700', color: dc.textPrimary, marginBottom: 3 },
  placeMeta: { fontSize: 12, color: dc.textSecondary, lineHeight: 18 },
  placeActions: { alignItems: 'flex-end', gap: 8 },
  placeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: dc.accentCyanBg,
  },
  placeBadgeText: { fontSize: 11, fontWeight: '700', color: dc.accentCyan },
  mapButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: dc.cardStrokeSoft,
    backgroundColor: dc.cardGlassSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeBtn: {
    marginHorizontal: 20, marginBottom: 16, paddingVertical: 14,
    borderRadius: 16, alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '700' },
});
