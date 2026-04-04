import React, { useState } from 'react';
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
import useAQI from '../hooks/useAQI';
import useWeather from '../hooks/useWeather';
import useLocation from '../hooks/useLocation';
import { getActivityStatus, getAqiColor, getAqiCategory } from '../theme/colors';
import { getWeatherDescription } from '../utils/weatherCodes';
import typography from '../theme/typography';

const ACTIVITIES = [
  {
    id: 'running',
    name: 'Running',
    emoji: '\u{1F3C3}',
    healthImpact:
      'Running significantly increases your breathing rate, pulling 10-20 times more air into your lungs than at rest. In polluted conditions, this means inhaling far greater quantities of fine particulate matter (PM2.5) and toxic gases deep into your respiratory system, which can cause airway inflammation, reduced lung function, and cardiovascular strain.',
    tips: [
      'Run early in the morning when pollution levels tend to be lowest.',
      'Avoid running near busy roads or industrial areas.',
      'Wear a certified N95 mask designed for exercise if air quality is poor.',
    ],
    indoorAlt:
      'Use a treadmill at home or in a gym with air filtration. High-intensity interval training (HIIT) indoors can replicate outdoor running benefits.',
  },
  {
    id: 'cricket',
    name: 'Cricket',
    emoji: '\u{1F3CF}',
    healthImpact:
      'Cricket matches can last several hours outdoors, leading to prolonged exposure to pollutants. Fielding, bowling, and batting all require bursts of exertion that increase respiration. Smoggy conditions also reduce visibility, making it harder to track the ball and increasing injury risk.',
    tips: [
      'Schedule matches during times of day with better air quality.',
      'Take breaks in shaded, less polluted areas between overs.',
      'Keep hydrated to help your body flush out inhaled toxins.',
    ],
    indoorAlt:
      'Practice batting in indoor nets. Use bowling machines in covered facilities. Play indoor cricket or table cricket for fun.',
  },
  {
    id: 'cycling',
    name: 'Cycling',
    emoji: '\u{1F6B4}',
    healthImpact:
      'Cyclists breathe heavily and are often positioned at vehicle exhaust height on roads. This combination results in very high intake of carbon monoxide, nitrogen dioxide, and particulate matter. Chronic exposure while cycling in polluted areas can lead to long-term respiratory and cardiovascular issues.',
    tips: [
      'Choose routes away from heavy traffic, such as parks or bike trails.',
      'Ride during off-peak traffic hours to minimize exhaust exposure.',
      'Use a pollution-filtering face mask rated for cycling.',
    ],
    indoorAlt:
      'Use a stationary bike or indoor cycling trainer. Join virtual cycling apps like Zwift for an engaging indoor ride experience.',
  },
  {
    id: 'walking',
    name: 'Walking',
    emoji: '\u{1F6B6}',
    healthImpact:
      'While walking involves lower exertion than running, extended walks in polluted air still expose you to harmful particulates. The elderly, children, and those with asthma are especially vulnerable. Even moderate PM2.5 levels can trigger symptoms during a 30-minute walk.',
    tips: [
      'Walk in green areas with trees, which help filter some pollutants.',
      'Avoid walking during peak traffic hours (morning and evening rush).',
      'Shorten your walk duration when AQI is elevated.',
    ],
    indoorAlt:
      'Walk on an indoor track or treadmill. Shopping malls offer climate-controlled walking paths. Try indoor yoga or stretching as a low-impact alternative.',
  },
  {
    id: 'swimming',
    name: 'Swimming',
    emoji: '\u{1F3CA}',
    healthImpact:
      'Outdoor swimming pools expose you to airborne pollutants while you breathe heavily during laps. Additionally, pollutants can settle on the water surface. The combination of chlorine fumes and air pollution can be particularly irritating to the respiratory system.',
    tips: [
      'Prefer indoor pools with proper ventilation and filtration systems.',
      'Avoid outdoor pools on high-AQI days, especially in the afternoon.',
      'Rinse off thoroughly after swimming to remove surface pollutants.',
    ],
    indoorAlt:
      'Swim at an indoor heated pool. Aqua aerobics classes in covered facilities provide similar cardiovascular benefits.',
  },
  {
    id: 'gardening',
    name: 'Gardening',
    emoji: '\u{1F331}',
    healthImpact:
      'Gardening involves extended time outdoors at ground level, where pollutant concentrations can be high. Digging and raking stir up dust that mixes with airborne PM2.5. Prolonged low-level exertion means steady inhalation of contaminated air over hours.',
    tips: [
      'Garden in the early morning when air quality tends to be better.',
      'Wear a dust mask to reduce particulate inhalation.',
      'Water soil before working to reduce dust being kicked up.',
    ],
    indoorAlt:
      'Maintain indoor plants and herb gardens. Use a small indoor greenhouse setup. Try hydroponic gardening kits that work indoors.',
  },
  {
    id: 'dining',
    name: 'Outdoor Dining',
    emoji: '\u{1F37D}\u{FE0F}',
    healthImpact:
      'Eating outdoors in polluted air means that fine particles settle on your food and are ingested along with being inhaled. Pollutants can irritate the eyes and throat, diminishing the dining experience. Children and the elderly face higher risk during prolonged outdoor meals.',
    tips: [
      'Choose restaurants with covered, enclosed patio areas.',
      'Avoid outdoor dining near busy roads or construction sites.',
      'Check the AQI before booking an outdoor reservation.',
    ],
    indoorAlt:
      'Dine indoors at restaurants with good ventilation. Host meals at home with air purifiers running. Try a picnic-style indoor dinner setup.',
  },
  {
    id: 'schoolpe',
    name: 'School PE',
    emoji: '\u{1F3EB}',
    healthImpact:
      "Children's lungs are still developing, making them especially vulnerable to air pollution during physical education classes. Vigorous outdoor exercise at school forces children to breathe in large amounts of polluted air, which can worsen asthma, reduce lung growth, and impair concentration for the rest of the school day.",
    tips: [
      'Schools should monitor AQI and move PE indoors on bad air days.',
      'Reduce intensity of outdoor activities when AQI exceeds 100.',
      'Ensure children with asthma have inhalers readily accessible.',
    ],
    indoorAlt:
      'Conduct PE in the school gymnasium or multipurpose hall. Indoor activities like dance, yoga, stretching, and light calisthenics are excellent substitutes.',
  },
  {
    id: 'biking',
    name: 'Biking',
    emoji: '\u{1F6B2}',
    healthImpact:
      'Recreational biking often takes place on roads and trails where vehicle emissions and dust are present. The elevated breathing rate during biking pulls pollutants deep into the lungs. Long rides in smoggy conditions can cause chest tightness, coughing, and reduced performance.',
    tips: [
      'Plan routes through parks and low-traffic neighborhoods.',
      'Bike in the early morning before pollution levels rise.',
      'Carry water and take breaks in cleaner-air spots along your route.',
    ],
    indoorAlt:
      'Use a stationary bike at home or at the gym. Spin classes offer a social, high-energy indoor cycling workout.',
  },
  {
    id: 'tennis',
    name: 'Tennis',
    emoji: '\u{1F3BE}',
    healthImpact:
      'Tennis involves repeated sprints, quick direction changes, and heavy breathing over matches that can last one to three hours. This extended cardiovascular effort in polluted air leads to deep inhalation of PM2.5 and ozone, which can trigger asthma attacks and reduce aerobic capacity.',
    tips: [
      'Play on indoor courts when outdoor AQI is above 100.',
      'Schedule matches in the early morning or after sunset.',
      'Stay well-hydrated and take longer rest breaks between sets.',
    ],
    indoorAlt:
      'Play at indoor tennis facilities. Badminton and table tennis are excellent indoor racquet alternatives that provide similar agility training.',
  },
];

function getSmartAdvisory(activity, aqi, weather) {
  const temp = weather?.temp;
  const humidity = weather?.humidity;
  const windSpeed = weather?.windSpeed;
  const weatherCode = weather?.weatherCode;
  const feelsLike = weather?.feelsLike;

  const isRaining = weatherCode && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);
  const isStormy = weatherCode && [95, 96, 99].includes(weatherCode);
  const isFoggy = weatherCode && [45, 48].includes(weatherCode);
  const isExtremeHeat = temp != null && temp >= 40;
  const isVeryHot = temp != null && temp >= 35;
  const isCold = temp != null && temp <= 10;
  const isHighHumidity = humidity != null && humidity >= 85;
  const isHighWind = windSpeed != null && windSpeed >= 30;
  const isSmoggy = aqi > 150;

  // Build recommendation
  const recs = [];
  if (aqi <= 50) recs.push('Air quality is excellent right now.');
  else if (aqi <= 100) recs.push('Air quality is acceptable. Sensitive individuals should be cautious.');
  else if (aqi <= 150) recs.push('Air is unhealthy for sensitive groups. Reduce prolonged outdoor effort.');
  else if (aqi <= 200) recs.push('Air is unhealthy. Limit outdoor exposure and consider moving indoors.');
  else if (aqi <= 300) recs.push('Air is very unhealthy. Avoid all outdoor activities if possible.');
  else recs.push('HAZARDOUS air quality! Stay indoors with windows closed and air filtration running.');

  if (isExtremeHeat) recs.push(`Extreme heat at ${Math.round(temp)}°C (feels like ${Math.round(feelsLike)}°C). High risk of heatstroke — avoid outdoor exertion.`);
  else if (isVeryHot) recs.push(`It's very hot at ${Math.round(temp)}°C. Stay hydrated and take frequent shade breaks.`);
  if (isCold) recs.push(`Cold conditions at ${Math.round(temp)}°C. Warm up properly before activity and layer clothing.`);
  if (isStormy) recs.push('Thunderstorms detected — stay indoors. Lightning poses a serious danger outdoors.');
  else if (isRaining) recs.push('Rain is expected. Surfaces will be slippery — use caution or postpone outdoor activities.');
  if (isFoggy) recs.push('Fog is reducing visibility. Outdoor activities near roads are risky.');
  if (isHighHumidity && isVeryHot) recs.push(`Humidity is ${humidity}% — combined with heat, sweating won't cool you effectively. Risk of heat exhaustion is high.`);
  else if (isHighHumidity) recs.push(`Humidity is high at ${humidity}%. You may feel more fatigued than usual during exercise.`);
  if (isHighWind) recs.push(`Strong winds at ${Math.round(windSpeed)} km/h. Cycling, tennis, and cricket may be significantly affected.`);

  if (recs.length === 1 && aqi <= 50 && !isVeryHot && !isCold && !isRaining) {
    recs.push('Weather conditions are favorable — great time to be outdoors!');
  }

  // Build dynamic tips based on conditions
  const tips = [...activity.tips]; // start with base tips
  if (isExtremeHeat || isVeryHot) {
    tips.unshift('Drink water every 15-20 minutes. Carry electrolytes for sessions over 30 minutes.');
    tips.unshift('Wear light-colored, breathable clothing and apply sunscreen SPF 50+.');
  }
  if (isCold) {
    tips.unshift('Wear layered clothing and cover extremities. Warm up for 10+ minutes before starting.');
  }
  if (isRaining) {
    tips.unshift('Wear waterproof gear and shoes with good grip. Avoid metal surfaces and flooded areas.');
  }
  if (isSmoggy) {
    tips.unshift('Wear an N95 mask if you must go outside. Limit session to under 20 minutes.');
  }
  if (isHighHumidity && isVeryHot) {
    tips.unshift('Take breaks in air-conditioned spaces every 15 minutes to prevent heat exhaustion.');
  }

  // Build dynamic health impact
  let healthImpact = activity.healthImpact;
  if (isSmoggy) {
    healthImpact += ` Current smog conditions (AQI ${aqi}) mean the air contains dangerously high levels of PM2.5 particles that penetrate deep into your lungs and enter the bloodstream.`;
  }
  if (isExtremeHeat) {
    healthImpact += ` With temperatures at ${Math.round(temp)}°C, your body's cooling system is under extreme stress. Core body temperature can rise rapidly, risking heatstroke, organ damage, and in severe cases, death.`;
  }
  if (isHighHumidity && isVeryHot) {
    healthImpact += ` High humidity (${humidity}%) prevents sweat from evaporating, making your body unable to cool down naturally.`;
  }
  if (isCold) {
    healthImpact += ` Cold air at ${Math.round(temp)}°C can constrict airways, trigger exercise-induced asthma, and increase the risk of muscle strains.`;
  }

  // Dynamic indoor alternatives
  let indoorAlt = activity.indoorAlt;
  if (isRaining || isStormy) {
    indoorAlt = 'With rain/storms outside, ' + indoorAlt.charAt(0).toLowerCase() + indoorAlt.slice(1);
  } else if (isExtremeHeat) {
    indoorAlt = 'Given the extreme heat, indoor activity is strongly recommended. ' + indoorAlt;
  } else if (aqi > 200) {
    indoorAlt = 'With hazardous air quality, indoor options are essential. ' + indoorAlt;
  }

  return {
    recommendation: recs.join(' '),
    tips: tips.slice(0, 5), // max 5 tips
    healthImpact,
    indoorAlt,
  };
}

export default function ActivitiesScreen() {
  const { colors } = useTheme();
  const { city, location, loading: locLoading } = useLocation();
  const { aqi, loading: aqiLoading } = useAQI(city?.toLowerCase());
  const { current: weatherCurrent, loading: weatherLoading } = useWeather(location.lat, location.lon);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const loading = locLoading || aqiLoading;
  const currentAqi = aqi ?? 0;
  const status = getActivityStatus(currentAqi);

  const renderCard = ({ item }) => {
    const actStatus = getActivityStatus(currentAqi);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => setSelectedActivity(item)}
      >
        <Text style={styles.cardEmoji}>{item.emoji}</Text>
        <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.badge, { backgroundColor: actStatus.color + '22' }]}>
          <Text style={[styles.badgeText, { color: actStatus.color }]}>{actStatus.label}</Text>
        </View>
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
          <Text style={[styles.cityLabel, { color: colors.textSecondary }]}>{city}</Text>
          <View style={[styles.aqiBadge, { backgroundColor: getAqiColor(currentAqi) + '22' }]}>
            <Text style={[styles.aqiBadgeText, { color: getAqiColor(currentAqi) }]}>
              AQI {currentAqi}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={ACTIVITIES}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />

      {/* Detail Modal */}
      <Modal
        visible={selectedActivity !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedActivity(null)}
      >
        {selectedActivity && (() => {
          const advisory = getSmartAdvisory(selectedActivity, currentAqi, weatherCurrent);
          const weatherDesc = getWeatherDescription(weatherCurrent?.weatherCode);
          return (
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <Text style={styles.modalEmoji}>{selectedActivity.emoji}</Text>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedActivity.name}
              </Text>

              {/* Current Conditions Bar */}
              <View style={[styles.conditionsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.conditionItem}>
                  <Text style={[styles.conditionValue, { color: getAqiColor(currentAqi) }]}>{currentAqi}</Text>
                  <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>AQI</Text>
                </View>
                <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />
                <View style={styles.conditionItem}>
                  <Text style={[styles.conditionValue, { color: colors.text }]}>{weatherCurrent?.temp != null ? `${Math.round(weatherCurrent.temp)}°` : '--'}</Text>
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
                  <View style={[styles.modalStatusBadge, { backgroundColor: status.color + '22' }]}>
                    <Text style={[styles.modalStatusSmall, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>Status</Text>
                </View>
              </View>

              {/* Recommendation */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                  Recommendation
                </Text>
                <Text style={[styles.sectionBody, { color: colors.text }]}>
                  {advisory.recommendation}
                </Text>
              </View>

              {/* Health Impact */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                  Health Impact
                </Text>
                <Text style={[styles.sectionBody, { color: colors.text }]}>
                  {advisory.healthImpact}
                </Text>
              </View>

              {/* Tips */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                  Tips
                </Text>
                {advisory.tips.map((tip, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <Text style={[styles.tipBullet, { color: colors.accent }]}>{idx + 1}.</Text>
                    <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
                  </View>
                ))}
              </View>

              {/* Indoor Alternatives */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                  Indoor Alternatives
                </Text>
                <Text style={[styles.sectionBody, { color: colors.text }]}>
                  {advisory.indoorAlt}
                </Text>
              </View>
            </ScrollView>

            {/* Close Button */}
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
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.body,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  cityLabel: {
    fontSize: typography.body,
  },
  aqiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aqiBadgeText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  card: {
    flex: 1,
    marginHorizontal: 4,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  cardName: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },

  /* Modal Styles */
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 72,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: 20,
  },
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
  conditionItem: {
    alignItems: 'center',
    flex: 1,
  },
  conditionValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  conditionLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  conditionDivider: {
    width: 1,
    height: 32,
    opacity: 0.3,
  },
  modalStatusSmall: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalAqiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalAqiBlock: {
    alignItems: 'flex-start',
  },
  modalAqiLabel: {
    fontSize: typography.caption,
    marginBottom: 2,
  },
  modalAqiValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  modalCategory: {
    fontSize: typography.caption,
    marginTop: 2,
  },
  modalStatusBadge: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
  },
  modalStatusText: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  section: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: typography.body,
    lineHeight: 24,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingRight: 8,
  },
  tipBullet: {
    fontSize: typography.body,
    fontWeight: '700',
    marginRight: 8,
    minWidth: 18,
  },
  tipText: {
    fontSize: typography.body,
    lineHeight: 24,
    flex: 1,
  },
  closeBtn: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '700',
  },
});
