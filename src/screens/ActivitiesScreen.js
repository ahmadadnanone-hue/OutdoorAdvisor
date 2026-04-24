import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import useAQI from '../hooks/useAQI';
import useWeather from '../hooks/useWeather';
import useLocation from '../hooks/useLocation';
import { getAqiColor } from '../theme/colors';
import { getWeatherDescription } from '../utils/weatherCodes';
import { getActivitySummary } from '../utils/activityScoring';
import typography from '../theme/typography';
import NearbyPlaces from '../components/NearbyPlaces';
import { ACTIVITY_CATALOG, getActivityById } from '../data/activities';

function getScoreBand(score) {
  if (score >= 75) return 'Great now';
  if (score >= 60) return 'Usable window';
  if (score >= 45) return 'Go with care';
  return 'Better later';
}

function getDiningAdvisories(aqi, weather) {
  const temp = weather?.temp;
  const feelsLike = weather?.feelsLike;
  const heatValue = feelsLike ?? temp;

  const isExtremeHeat = heatValue != null && heatValue >= 47;
  const isVeryHot = heatValue != null && heatValue >= 38;
  const isCold = temp != null && temp <= 10;
  const isHazardousAir = aqi > 300;
  const isVeryUnhealthyAir = aqi > 200;
  const isSmoggy = aqi > 150;

  const alerts = [];

  if (isHazardousAir) {
    alerts.push({
      icon: '☣',
      color: '#991B1B',
      title: 'Hazardous Air — Avoid Outdoor Dining',
      message: `AQI ${aqi}: Toxic particles settle on food and saturate the air you breathe throughout the meal. Dine strictly indoors in a well-ventilated restaurant.`,
      action: 'Move all meals indoors immediately.',
    });
  } else if (isVeryUnhealthyAir) {
    alerts.push({
      icon: '⚠',
      color: '#7C3AED',
      title: 'Very Poor Air — Indoor Dining Advised',
      message: `AQI ${aqi}: Smog particles contaminate food and air during the meal. Choose fully enclosed patios or move indoors.`,
      action: 'Prefer enclosed patios or indoor seating.',
    });
  } else if (isSmoggy) {
    alerts.push({
      icon: '😷',
      color: '#D97706',
      title: 'Smog Advisory',
      message: `AQI ${aqi}: Elevated pollution settles on outdoor food. Choose covered seating away from busy roads, or dine indoors.`,
      action: 'Seek covered or enclosed dining areas.',
    });
  }

  if (isExtremeHeat) {
    alerts.push({
      icon: '🌡',
      color: '#DC2626',
      title: 'Extreme Heat — Avoid Outdoor Dining',
      message: `Feels like ${Math.round(heatValue)}°C — prolonged outdoor exposure risks heat exhaustion. Dine in air-conditioned indoor restaurants.`,
      action: 'Dine indoors in air-conditioned spaces.',
    });
  } else if (isVeryHot) {
    alerts.push({
      icon: '☀',
      color: '#EA580C',
      title: 'High Heat Advisory',
      message: `Feels like ${Math.round(heatValue)}°C. Request shaded, covered, or umbrella seating. Dine before 11am or after 7pm. Drink water throughout the meal.`,
      action: 'Seek shaded, covered, or umbrella seating.',
    });
  }

  if (isCold) {
    alerts.push({
      icon: '🥶',
      color: '#0284C7',
      title: 'Cold Weather — Seek Shelter',
      message: `${Math.round(temp)}°C outdoor temperatures make extended meals uncomfortable quickly. Look for heated patios, enclosed outdoor sections, or dine indoors.`,
      action: 'Look for heated or enclosed outdoor seating.',
    });
  }

  return alerts;
}

function getSmartAdvisory(activity, aqi, weather) {
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

  const recs = [];
  if (aqi <= 50) recs.push('Air quality is excellent right now, so most outdoor plans should feel comfortable.');
  else if (aqi <= 100) recs.push('Air quality is generally fine for going out. Sensitive users may want lighter effort near busy roads.');
  else if (aqi <= 150) recs.push('Air quality is elevated, but most people can still go out if they keep sessions moderate and avoid high-traffic routes.');
  else if (aqi <= 200) recs.push('Air quality is poor enough to plan smart: shorten hard workouts, choose cleaner areas, and wear an N95 mask if you are sensitive or staying out for long.');
  else if (aqi <= 300) recs.push('Air quality is very poor. Keep outdoor time brief and light, use a well-fitted N95 mask, and move intense exercise indoors.');
  else recs.push('Air quality is hazardous right now. Go outside only if necessary, keep exposure short, and use a well-fitted N95 mask.');

  if (isExtremeHeat) recs.push(`Heat is the bigger risk right now at feels-like ${Math.round(heatValue)}°C. Save outdoor activity for early or late hours, keep trips short, and avoid hard exertion.`);
  else if (isVeryHot) recs.push(`It is hot enough to plan around the heat. Go earlier or later in the day, drink water often, and take shade breaks.`);
  if (isCold) recs.push(`Cold conditions at ${Math.round(temp)}°C can tighten airways, so layer up and give yourself a longer warm-up.`);
  if (isStormy) recs.push('Thunderstorms are a real safety risk. Wait for the storm to pass before heading out.');
  else if (isHeavyRain) recs.push('Heavy rain can still work for necessary trips, but use waterproof gear, slow down, and avoid flooded or low-visibility stretches.');
  else if (isRaining) recs.push('Light rain is manageable with waterproof gear and good grip, especially for shorter outdoor plans.');
  if (isFoggy) recs.push('Fog lowers visibility, so stick to parks or quieter roads and avoid fast traffic corridors.');
  if (isHighHumidity && isVeryHot) recs.push(`Humidity is ${humidity}%, which makes the heat feel heavier. Take cooling breaks and do less than you normally would.`);
  else if (isHighHumidity) recs.push(`Humidity is high at ${humidity}%, so effort may feel tougher than usual even if the temperature looks manageable.`);
  if (isHighWind) recs.push(`Strong winds at ${Math.round(windSpeed)} km/h. Cycling, tennis, and cricket may be significantly affected.`);

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

  if (activity.id === 'dining') {
    if (isHazardousAir) tips.unshift('Skip outdoor dining — fine particles settle on food and saturate the air you breathe. Eat indoors.');
    else if (isSmoggy) tips.unshift('Choose enclosed or covered patio seating away from busy roads to reduce smog exposure during the meal.');
    if (isExtremeHeat) tips.unshift('Avoid outdoor dining today — dine in air-conditioned restaurants to prevent heat stress.');
    else if (isVeryHot) tips.unshift('Ask for shaded, covered, or umbrella seating and plan the meal for after 7pm when it cools down.');
    if (isCold) tips.unshift('Request a heated outdoor section or move indoors — cold temperatures make long outdoor meals uncomfortable.');
  }

  let healthImpact = activity.healthImpact;
  if (isHazardousAir) healthImpact += ` Current AQI (${aqi}) is hazardous, so even brief exposure can aggravate breathing and cardiovascular symptoms.`;
  else if (isVeryUnhealthyAir) healthImpact += ` Current AQI (${aqi}) will noticeably increase your particle intake, so shorter sessions, a mask, and cleaner routes matter much more than usual.`;
  else if (isSmoggy) healthImpact += ` Current AQI (${aqi}) is high enough that harder breathing will pull more particles into the lungs, especially during longer or higher-intensity sessions.`;
  if (isExtremeHeat) healthImpact += ` With feels-like conditions near ${Math.round(heatValue)}°C, your body's cooling system is under heavy stress.`;
  if (isHighHumidity && isVeryHot) healthImpact += ` High humidity (${humidity}%) slows sweat evaporation, so you heat up faster and recover more slowly.`;
  if (isCold) healthImpact += ` Cold air at ${Math.round(temp)}°C can constrict airways and trigger exercise-induced asthma.`;

  let indoorAlt = activity.indoorAlt;
  if (isStormy) indoorAlt = 'While the storm is active, indoor options are the safer call. ' + indoorAlt;
  else if (isExtremeHeat) indoorAlt = 'If you still want activity today, indoor options are the cooler and safer call. ' + indoorAlt;
  else if (isHazardousAir) indoorAlt = 'With hazardous air quality, indoor options are strongly recommended right now. ' + indoorAlt;
  else if (isVeryUnhealthyAir) indoorAlt = 'If you want to avoid heavy smoke exposure, indoor options are the better choice for longer or harder sessions. ' + indoorAlt;

  return {
    recommendation: recs.join(' '),
    tips: tips.slice(0, 5),
    healthImpact,
    indoorAlt,
  };
}

export default function ActivitiesScreen() {
  const { colors } = useTheme();
  const { enabledActivities, addActivity, removeActivity } = useSettings();
  const { isPremium } = useAuth();
  const { city, location, loading: locLoading } = useLocation();
  const { aqi, loading: aqiLoading } = useAQI(location.lat, location.lon);
  const { current: weatherCurrent, hourly } = useWeather(location.lat, location.lon);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const loading = locLoading || aqiLoading;
  const currentAqi = aqi ?? 0;

  // The activities the user has enabled, in order
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
  const featuredActivities = rankedActivities.slice(0, 2);

  // Grid data = enabled activities + a synthetic "add" card at the end
  const gridData = useMemo(
    () => [...rankedActivities, { id: '__add__', isAddCard: true }],
    [rankedActivities]
  );

  const renderCard = ({ item }) => {
    if (item.isAddCard) {
      return (
        <TouchableOpacity
          style={[styles.card, styles.addCard, { borderColor: colors.primary }]}
          activeOpacity={0.7}
          onPress={() => setAddModalVisible(true)}
        >
          <Text style={[styles.addPlus, { color: colors.primary }]}>+</Text>
          <Text style={[styles.cardName, { color: colors.primary }]}>Add Activity</Text>
        </TouchableOpacity>
      );
    }
    const activitySummary = item.summary;
    const rank = rankedActivities.findIndex((activity) => activity.id === item.id) + 1;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: rank <= 2 ? activitySummary.color + '55' : colors.border },
        ]}
        activeOpacity={0.7}
        onPress={() => setSelectedActivity(item)}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
          <View style={[styles.rankPill, { backgroundColor: activitySummary.color + '18' }]}>
            <Text style={[styles.rankPillText, { color: activitySummary.color }]}>#{rank}</Text>
          </View>
        </View>
        <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.cardScore, { color: activitySummary.color }]}>
          {activitySummary.score}/100
        </Text>
        <Text style={[styles.cardHint, { color: colors.textSecondary }]} numberOfLines={1}>
          {activitySummary.bestTime}
        </Text>
        <Text style={[styles.cardSubHint, { color: colors.textSecondary }]} numberOfLines={1}>
          {getScoreBand(activitySummary.score)}
        </Text>
        <View style={[styles.badge, { backgroundColor: activitySummary.color + '16' }]}>
          <Text style={[styles.badgeText, { color: activitySummary.color }]}>{activitySummary.label}</Text>
        </View>
        {item.id === 'dining' && (() => {
          const dAlerts = getDiningAdvisories(currentAqi, weatherCurrent);
          if (!dAlerts.length) return null;
          return (
            <View style={[styles.diningStrip, { backgroundColor: dAlerts[0].color + '18' }]}>
              <Text style={[styles.diningStripText, { color: dAlerts[0].color }]} numberOfLines={1}>
                {dAlerts[0].icon}  {dAlerts[0].action}
              </Text>
            </View>
          );
        })()}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading air quality data...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Activities</Text>
        <View style={styles.headerInfo}>
          <Text style={[styles.cityLabel, { color: colors.textSecondary }]} numberOfLines={1}>{city}</Text>
          <View style={[styles.aqiBadge, { backgroundColor: getAqiColor(currentAqi) + '22' }]}>
            <Text style={[styles.aqiBadgeText, { color: getAqiColor(currentAqi) }]}>
              AQI {currentAqi}
            </Text>
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.addModalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Manage Activities</Text>
            <Text style={[styles.addModalSubtitle, { color: colors.textSecondary }]}>
              Tap to add or remove activities from your dashboard.
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.addListContent} showsVerticalScrollIndicator={false}>
            {ACTIVITY_CATALOG.map((act) => {
              const enabled = enabledActivities.includes(act.id);
              return (
                <TouchableOpacity
                  key={act.id}
                  style={[styles.addRow, { backgroundColor: colors.card, borderColor: enabled ? colors.primary : colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => (enabled ? removeActivity(act.id) : addActivity(act.id))}
                >
                  <Text style={styles.addRowEmoji}>{act.emoji}</Text>
                  <View style={styles.addRowInfo}>
                    <Text style={[styles.addRowName, { color: colors.text }]}>{act.name}</Text>
                    {act.placesQuery && (
                      <Text style={[styles.addRowHint, { color: colors.textSecondary }]} numberOfLines={1}>
                        Shows nearby {act.placesQuery}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.addToggle,
                      {
                        backgroundColor: enabled ? colors.primary : 'transparent',
                        borderColor: enabled ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.addToggleIcon, { color: enabled ? '#fff' : colors.textSecondary }]}>
                      {enabled ? '✓' : '+'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.primary }]}
            onPress={() => setAddModalVisible(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
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
            <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalEmoji}>{selectedActivity.emoji}</Text>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedActivity.name}</Text>

                <View style={[styles.conditionsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.conditionItem}>
                    <Text style={[styles.conditionValue, { color: getAqiColor(currentAqi) }]}>{currentAqi}</Text>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>AQI</Text>
                  </View>
                  <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.conditionItem}>
                    <Text style={[styles.conditionValue, { color: colors.text }]}>
                      {weatherCurrent?.temp != null ? `${Math.round(weatherCurrent.temp)}°` : '--'}
                    </Text>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>Temp</Text>
                  </View>
                  <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.conditionItem}>
                    <Text style={[styles.conditionValue, { color: '#06B6D4' }]}>{weatherCurrent?.humidity ?? '--'}%</Text>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>Humidity</Text>
                  </View>
                  <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.conditionItem}>
                    <Text style={[styles.conditionValue, { color: colors.text }]}>{weatherDesc.icon}</Text>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>Weather</Text>
                  </View>
                  <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.conditionItem}>
                    <View style={[styles.modalStatusBadge, { backgroundColor: activitySummary.color + '22' }]}>
                      <Text style={[styles.modalStatusSmall, { color: activitySummary.color }]}>{activitySummary.label}</Text>
                    </View>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>Status</Text>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Activity Score</Text>
                    <Text style={[styles.summaryValue, { color: activitySummary.color }]}>
                      {activitySummary.score}/100
                    </Text>
                    <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>
                      {activitySummary.label}
                    </Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Best Time Today</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {activitySummary.bestTime}
                    </Text>
                    <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>
                      Based on the strongest upcoming time window today
                    </Text>
                  </View>
                </View>

                {selectedActivity.id === 'dining' && (() => {
                  const dAlerts = getDiningAdvisories(currentAqi, weatherCurrent);
                  if (!dAlerts.length) return null;
                  return (
                    <View style={{ width: '100%', marginBottom: 12 }}>
                      {dAlerts.map((alert, idx) => (
                        <View key={idx} style={[styles.diningAdvisory, { backgroundColor: alert.color + '14', borderColor: alert.color + '44' }]}>
                          <View style={styles.diningAdvisoryRow}>
                            <Text style={styles.diningAdvisoryIcon}>{alert.icon}</Text>
                            <Text style={[styles.diningAdvisoryTitle, { color: alert.color }]}>{alert.title}</Text>
                          </View>
                          <Text style={[styles.diningAdvisoryMsg, { color: colors.text }]}>{alert.message}</Text>
                          <View style={[styles.diningActionTag, { backgroundColor: alert.color + '20' }]}>
                            <Text style={[styles.diningActionLabel, { color: alert.color }]}>{alert.action}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>Why This Score</Text>
                  {activitySummary.rationale.map((line, idx) => (
                    <View key={idx} style={styles.tipRow}>
                      <Text style={[styles.tipBullet, { color: colors.accent }]}>•</Text>
                      <Text style={[styles.tipText, { color: colors.text }]}>{line}</Text>
                    </View>
                  ))}
                  <Text style={[styles.scoreWhyMeta, { color: colors.textSecondary }]}>
                    Best-case setup: {activitySummary.idealScenario}
                  </Text>
                  <Text style={[styles.scoreWhyMeta, { color: colors.textSecondary }]}>
                    Activity profile: {activitySummary.profileReason}
                  </Text>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>Recommendation</Text>
                  <Text style={[styles.sectionBody, { color: colors.text }]}>{advisory.recommendation}</Text>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>Health Impact</Text>
                  <Text style={[styles.sectionBody, { color: colors.text }]}>{advisory.healthImpact}</Text>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>Tips</Text>
                  {advisory.tips.map((tip, idx) => (
                    <View key={idx} style={styles.tipRow}>
                      <Text style={[styles.tipBullet, { color: colors.accent }]}>{idx + 1}.</Text>
                      <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
                    </View>
                  ))}
                </View>

                {/* Nearby Places — powered by Google Places */}
                {selectedActivity.placesQuery && location?.lat != null && (
                  isPremium ? (
                    <NearbyPlaces
                      lat={location.lat}
                      lon={location.lon}
                      keyword={selectedActivity.placesQuery}
                      type={selectedActivity.placesType}
                      colors={colors}
                      title={`Nearby ${selectedActivity.name}`}
                    />
                  ) : (
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.sectionTitle, { color: colors.primary }]}>Nearby {selectedActivity.name}</Text>
                      <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
                        Premium unlock: nearby venue suggestions with live local context for this activity.
                      </Text>
                    </View>
                  )
                )}

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>Indoor Alternatives</Text>
                  <Text style={[styles.sectionBody, { color: colors.text }]}>{advisory.indoorAlt}</Text>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.primary }]}
                onPress={() => setSelectedActivity(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </SafeAreaView>
          );
        })()}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: typography.body },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: typography.title, fontWeight: '700' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  cityLabel: { fontSize: typography.body, flexShrink: 1 },
  aqiBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  aqiBadgeText: { fontSize: typography.caption, fontWeight: '700' },
  grid: { paddingHorizontal: 12, paddingBottom: 24 },
  row: { justifyContent: 'space-between', paddingHorizontal: 4 },
  card: {
    flex: 1,
    marginHorizontal: 4,
    marginVertical: 6,
    borderRadius: 16,
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
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 190,
  },
  addPlus: { fontSize: 44, fontWeight: '300', lineHeight: 48, marginBottom: 4 },
  cardEmoji: { fontSize: 38 },
  rankPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rankPillText: { fontSize: 11, fontWeight: '700' },
  cardName: { fontSize: typography.body, fontWeight: '700', marginBottom: 10, textAlign: 'center', minHeight: 42 },
  cardScore: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 11, marginBottom: 4, textAlign: 'center' },
  cardSubHint: { fontSize: 11, marginBottom: 10, textAlign: 'center' },
  badge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: typography.caption, fontWeight: '700' },

  /* Add Modal */
  addModalHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  addModalSubtitle: { fontSize: typography.caption, marginTop: 6 },
  addListContent: { paddingHorizontal: 16, paddingBottom: 20 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  addRowEmoji: { fontSize: 30, marginRight: 12 },
  addRowInfo: { flex: 1 },
  addRowName: { fontSize: typography.body, fontWeight: '600' },
  addRowHint: { fontSize: typography.caption, marginTop: 2 },
  addToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToggleIcon: { fontSize: 18, fontWeight: '700' },

  /* Detail Modal */
  modalContainer: { flex: 1 },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, alignItems: 'center' },
  modalEmoji: { fontSize: 72, marginBottom: 8 },
  modalTitle: { fontSize: typography.title, fontWeight: '700', marginBottom: 20 },
  conditionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  conditionItem: { alignItems: 'center', flex: 1 },
  conditionValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  conditionLabel: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 },
  conditionDivider: { width: 1, height: 32, opacity: 0.3 },
  modalStatusSmall: { fontSize: 12, fontWeight: '700' },
  modalStatusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  summaryRow: { width: '100%', flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: typography.subtitle, fontWeight: '700', marginBottom: 8 },
  sectionBody: { fontSize: typography.body, lineHeight: 24 },
  scoreWhyMeta: { fontSize: typography.caption, lineHeight: 20, marginTop: 8 },
  tipRow: { flexDirection: 'row', marginBottom: 6, paddingRight: 8 },
  tipBullet: { fontSize: typography.body, fontWeight: '700', marginRight: 8, minWidth: 18 },
  tipText: { fontSize: typography.body, lineHeight: 24, flex: 1 },
  closeBtn: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeBtnText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '700' },

  diningStrip: { width: '100%', marginTop: 8, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 8 },
  diningStripText: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  diningAdvisory: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  diningAdvisoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  diningAdvisoryIcon: { fontSize: 18, marginRight: 8 },
  diningAdvisoryTitle: { fontSize: 13, fontWeight: '800', flex: 1, lineHeight: 18 },
  diningAdvisoryMsg: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  diningActionTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  diningActionLabel: { fontSize: 11, fontWeight: '700' },
});
