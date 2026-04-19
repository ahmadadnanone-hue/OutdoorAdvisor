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
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import useAQI from '../hooks/useAQI';
import useWeather from '../hooks/useWeather';
import useLocation from '../hooks/useLocation';
import { getWeatherDescription } from '../utils/weatherCodes';
import { getActivitySummary } from '../utils/activityScoring';
import { ACTIVITY_CATALOG, getActivityById } from '../data/activities';
import { ScreenGradient } from '../components/layout';
import { GlassCard } from '../components/glass';
import { colors as dc } from '../design';

function getScoreBand(score) {
  if (score >= 75) return 'Great now';
  if (score >= 60) return 'Usable window';
  if (score >= 45) return 'Go with care';
  return 'Better later';
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

  return { recommendation: recs.join(' '), tips: tips.slice(0, 5), healthImpact, indoorAlt };
}

export default function ActivitiesScreen() {
  const { enabledActivities, addActivity, removeActivity } = useSettings();
  const { isPremium } = useAuth();
  const { city, location, loading: locLoading } = useLocation();
  const { aqi, loading: aqiLoading } = useAQI(location.lat, location.lon);
  const { current: weatherCurrent, hourly } = useWeather(location.lat, location.lon);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const loading = locLoading || aqiLoading;
  const currentAqi = aqi ?? 0;

  const aqiColor =
    currentAqi <= 50 ? dc.accentGreen
    : currentAqi <= 100 ? dc.accentYellow
    : currentAqi <= 150 ? dc.accentOrange
    : currentAqi <= 200 ? dc.accentOrange
    : dc.accentRed;

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
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
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
                      <Text style={styles.addRowEmoji}>{act.emoji}</Text>
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
                    <Text style={styles.modalEmoji}>{selectedActivity.emoji}</Text>
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
  cardEmoji: { fontSize: 38 },
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
  addRowEmoji: { fontSize: 30, marginRight: 12 },
  addRowInfo: { flex: 1 },
  addRowName: { fontSize: 15, fontWeight: '600', color: dc.textPrimary },
  addRowHint: { fontSize: 12, color: dc.textSecondary, marginTop: 2 },
  addToggle: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  addToggleIcon: { fontSize: 18, fontWeight: '700' },

  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, alignItems: 'center' },
  modalEmoji: { fontSize: 72, marginBottom: 8 },
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

  closeBtn: {
    marginHorizontal: 20, marginBottom: 16, paddingVertical: 14,
    borderRadius: 16, alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '700' },
});
