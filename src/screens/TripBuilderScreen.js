import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fetchApiJson } from '../config/api';
import { fetchWeatherForLocation } from '../hooks/useWeather';
import { fetchAqiForLocation } from '../hooks/useAQI';
import { getWeatherDescription } from '../utils/weatherCodes';
import {
  buildPlannerCandidates,
  getPlannerCityOptions,
  getPlannerQuickPairs,
  scorePlannerCandidates,
} from '../utils/routePlanner';

function StopConditionRow({ stop, condition, colors }) {
  const weather = getWeatherDescription(condition?.weatherCode);
  return (
    <View style={[styles.stopRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.stopRowLeft}>
        <Text style={[styles.stopName, { color: colors.text }]}>{stop.name}</Text>
        <Text style={[styles.stopMeta, { color: colors.textSecondary }]}>
          {weather.icon} {weather.description}
        </Text>
      </View>
      <View style={styles.stopRowRight}>
        <Text style={[styles.stopMetric, { color: colors.text }]}>
          {condition?.temp != null ? `${Math.round(condition.temp)}°` : '--'}
        </Text>
        <Text style={[styles.stopMetricSub, { color: colors.textSecondary }]}>
          AQI {condition?.aqi ?? '--'}
        </Text>
      </View>
    </View>
  );
}

function RoutePlanCard({ plan, expanded, onToggle, stopConditions, colors, isDark }) {
  return (
    <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={onToggle} style={styles.planHeader}>
        <View style={styles.planHeaderCopy}>
          <Text style={[styles.planTitle, { color: colors.text }]}>{plan.title}</Text>
          <Text style={[styles.planSummary, { color: colors.textSecondary }]}>{plan.summary}</Text>
        </View>
        <View style={[styles.planRiskBadge, { backgroundColor: plan.tone + '18' }]}>
          <Text style={[styles.planRiskText, { color: plan.tone }]}>{plan.recommendation}</Text>
          <Text style={[styles.planRiskValue, { color: plan.tone }]}>{Math.max(0, Math.round(plan.totalRisk))}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.planChipRow}>
        <View style={[styles.planChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F8FAFC', borderColor: colors.border }]}>
          <Text style={[styles.planChipText, { color: colors.textSecondary }]}>
            {plan.legs.length === 1 ? 'Direct corridor' : `${plan.legs.length} leg route`}
          </Text>
        </View>
        {plan.reasons.slice(0, 2).map((reason) => (
          <View key={reason} style={[styles.planChip, { backgroundColor: plan.tone + '12', borderColor: plan.tone + '22' }]}>
            <Text style={[styles.planChipText, { color: plan.tone }]} numberOfLines={1}>
              {reason}
            </Text>
          </View>
        ))}
      </View>

      {expanded && (
        <View style={styles.planExpanded}>
          {plan.legs.map((leg) => (
            <View key={`${plan.id}-${leg.routeId}-${leg.from}-${leg.to}`} style={styles.legWrap}>
              <Text style={[styles.legTitle, { color: colors.text }]}>
                {leg.emoji} {leg.routeName}
              </Text>
              <Text style={[styles.legMeta, { color: colors.textSecondary }]}>
                {leg.from} to {leg.to}
              </Text>
              {leg.metrics.advisory?.status ? (
                <Text style={[styles.legWarning, { color: leg.metrics.advisory.severity === 'clear' ? colors.textSecondary : '#EF4444' }]}>
                  NHMP: {leg.metrics.advisory.status}
                </Text>
              ) : null}
              {leg.metrics.weatherAlerts[0] ? (
                <Text style={[styles.legWarning, { color: '#F97316' }]}>
                  PMD: {leg.metrics.weatherAlerts[0]}
                </Text>
              ) : null}
              <View style={styles.stopList}>
                {leg.stops.map((stop) => {
                  const key = `${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`;
                  return (
                    <StopConditionRow
                      key={`${plan.id}-${key}`}
                      stop={stop}
                      condition={stopConditions[key]}
                      colors={colors}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function TripBuilderScreen() {
  const { colors, isDark } = useTheme();
  const plannerCities = useMemo(() => getPlannerCityOptions(), []);
  const quickPairs = useMemo(() => getPlannerQuickPairs(), []);
  const [fromCity, setFromCity] = useState('Lahore');
  const [toCity, setToCity] = useState('Islamabad');
  const [nhmpData, setNhmpData] = useState([]);
  const [pmdAlerts, setPmdAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [stopConditions, setStopConditions] = useState({});

  const candidateRoutes = useMemo(
    () => buildPlannerCandidates(fromCity, toCity),
    [fromCity, toCity]
  );

  const scoredPlans = useMemo(
    () => scorePlannerCandidates(candidateRoutes, nhmpData, pmdAlerts, stopConditions),
    [candidateRoutes, nhmpData, pmdAlerts, stopConditions]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPlannerData() {
      if (candidateRoutes.length === 0) {
        setStopConditions({});
        return;
      }

      setLoading(true);

      try {
        const [nhmpJson, pmdJson] = await Promise.all([
          fetchApiJson('/api/nhmp').catch(() => ({ success: false, advisories: [] })),
          fetchApiJson('/api/pmd').catch(() => ({ success: false, alerts: [] })),
        ]);

        if (cancelled) return;

        setNhmpData(Array.isArray(nhmpJson?.advisories) ? nhmpJson.advisories : []);
        setPmdAlerts(Array.isArray(pmdJson?.alerts) ? pmdJson.alerts : []);

        const uniqueStops = [];
        const seenStops = new Set();

        candidateRoutes.forEach((candidate) => {
          candidate.legs.forEach((leg) => {
            leg.stops.forEach((stop) => {
              const key = `${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`;
              if (!seenStops.has(key)) {
                seenStops.add(key);
                uniqueStops.push(stop);
              }
            });
          });
        });

        const entries = await Promise.all(uniqueStops.map(async (stop) => {
          const [weather, aqi] = await Promise.all([
            fetchWeatherForLocation(stop.lat, stop.lon).catch(() => null),
            fetchAqiForLocation(stop.lat, stop.lon).catch(() => null),
          ]);

          return [
            `${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`,
            {
              temp: weather?.current?.temp ?? null,
              feelsLike: weather?.current?.feelsLike ?? null,
              windSpeed: weather?.current?.windSpeed ?? null,
              weatherCode: weather?.current?.weatherCode ?? null,
              aqi: aqi?.aqi ?? null,
              pm25: aqi?.pm25 ?? null,
            },
          ];
        }));

        if (cancelled) return;
        setStopConditions(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPlannerData();
    return () => {
      cancelled = true;
    };
  }, [candidateRoutes]);

  useEffect(() => {
    setExpandedPlanId(scoredPlans[0]?.id || null);
  }, [fromCity, toCity, scoredPlans]);

  const bestPlan = scoredPlans[0] || null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.heroCard, { backgroundColor: '#0F3B57', borderColor: 'rgba(255,255,255,0.08)' }]}>
          <Text style={styles.heroTitle}>RouteAdvisor</Text>
          <Text style={styles.heroBody}>
            Plan city-to-city trips across Pakistan with live NHMP advisories, PMD alerts, weather, and AQI — ranked into the safest route first.
          </Text>
          <View style={styles.heroBadgeRow}>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <Text style={styles.heroBadgeText}>Live safety data</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(34,197,94,0.22)' }]}>
              <Text style={[styles.heroBadgeText, { color: '#86EFAC' }]}>Risk scored</Text>
            </View>
          </View>
        </View>

        <View style={[styles.selectorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.selectorHeader}>
            <View style={styles.selectorColumn}>
              <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>From</Text>
              <Text style={[styles.selectorValue, { color: colors.text }]}>{fromCity}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setFromCity(toCity);
                setToCity(fromCity);
              }}
              style={[styles.swapBtn, { backgroundColor: colors.primary + '14' }]}
            >
              <Text style={[styles.swapBtnText, { color: colors.primary }]}>Swap</Text>
            </TouchableOpacity>
            <View style={[styles.selectorColumn, { alignItems: 'flex-end' }]}>
              <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>To</Text>
              <Text style={[styles.selectorValue, { color: colors.text }]}>{toCity}</Text>
            </View>
          </View>

          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Quick pairs</Text>
          <View style={styles.quickPairRow}>
            {quickPairs.map((pair) => (
              <TouchableOpacity
                key={`${pair.from}-${pair.to}`}
                activeOpacity={0.8}
                onPress={() => {
                  setFromCity(pair.from);
                  setToCity(pair.to);
                }}
                style={[styles.quickPairChip, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '22' }]}
              >
                <Text style={[styles.quickPairText, { color: colors.primary }]}>{pair.from} to {pair.to}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Supported cities</Text>
          <View style={styles.cityGrid}>
            {plannerCities.map((city) => {
              const selectedFrom = city.name === fromCity;
              const selectedTo = city.name === toCity;
              return (
                <View key={city.name} style={styles.cityChipWrap}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setFromCity(city.name)}
                    style={[
                      styles.cityChip,
                      {
                        backgroundColor: selectedFrom ? colors.primary : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
                        borderColor: selectedFrom ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.cityChipText, { color: selectedFrom ? '#FFFFFF' : colors.text }]}>From {city.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setToCity(city.name)}
                    style={[
                      styles.cityChip,
                      {
                        marginTop: 8,
                        backgroundColor: selectedTo ? '#0F766E' : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
                        borderColor: selectedTo ? '#0F766E' : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.cityChipText, { color: selectedTo ? '#FFFFFF' : colors.text }]}>To {city.name}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Checking route conditions across the network…</Text>
          </View>
        ) : candidateRoutes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No supported route found</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Try a popular pair like Lahore to Islamabad, Islamabad to Murree, or Multan to Sukkur.
            </Text>
          </View>
        ) : (
          <>
            {bestPlan && (
              <View style={[styles.bestCard, { backgroundColor: bestPlan.tone + '12', borderColor: bestPlan.tone + '22' }]}>
                <Text style={[styles.bestEyebrow, { color: colors.textSecondary }]}>Best route right now</Text>
                <Text style={[styles.bestTitle, { color: bestPlan.tone }]}>{bestPlan.title}</Text>
                <Text style={[styles.bestBody, { color: colors.text }]}>
                  {bestPlan.summary}. {bestPlan.recommendation} based on latest available advisory and stop conditions.
                </Text>
                {bestPlan.reasons[0] ? (
                  <Text style={[styles.bestReason, { color: colors.textSecondary }]}>
                    Main watch item: {bestPlan.reasons[0]}
                  </Text>
                ) : null}
                <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
                  Verify conditions before departure.
                </Text>
              </View>
            )}

            <Text style={[styles.resultsTitle, { color: colors.text }]}>Route options</Text>
            {scoredPlans.map((plan) => (
              <RoutePlanCard
                key={plan.id}
                plan={plan}
                expanded={expandedPlanId === plan.id}
                onToggle={() => setExpandedPlanId((current) => (current === plan.id ? null : plan.id))}
                stopConditions={stopConditions}
                colors={colors}
                isDark={isDark}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  heroBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  heroBody: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 21 },
  selectorCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  selectorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  selectorColumn: { flex: 1 },
  selectorLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  selectorValue: { fontSize: 22, fontWeight: '800' },
  swapBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, marginHorizontal: 10 },
  swapBtnText: { fontSize: 13, fontWeight: '700' },
  sectionHint: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginTop: 4 },
  quickPairRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  quickPairChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  quickPairText: { fontSize: 12, fontWeight: '700' },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cityChipWrap: { width: '48%' },
  cityChip: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  cityChipText: { fontSize: 13, fontWeight: '700' },
  loadingCard: { borderWidth: 1, borderRadius: 18, padding: 18, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyBody: { fontSize: 14, lineHeight: 21 },
  bestCard: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 14 },
  bestEyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  bestTitle: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  bestBody: { fontSize: 14, lineHeight: 21 },
  bestReason: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 8, fontStyle: 'italic' },
  resultsTitle: { fontSize: 19, fontWeight: '800', marginBottom: 10, marginTop: 6 },
  planCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  planHeaderCopy: { flex: 1 },
  planTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  planSummary: { fontSize: 13, lineHeight: 19 },
  planRiskBadge: { alignItems: 'center', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, minWidth: 86 },
  planRiskText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3, textAlign: 'center' },
  planRiskValue: { fontSize: 20, fontWeight: '800' },
  planChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  planChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  planChipText: { fontSize: 11, fontWeight: '700', maxWidth: 210 },
  planExpanded: { marginTop: 14, gap: 14 },
  legWrap: { gap: 6 },
  legTitle: { fontSize: 15, fontWeight: '800' },
  legMeta: { fontSize: 12, lineHeight: 18 },
  legWarning: { fontSize: 12, lineHeight: 18 },
  stopList: { gap: 8, marginTop: 4 },
  stopRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopRowLeft: { flex: 1, paddingRight: 12 },
  stopName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  stopMeta: { fontSize: 12, lineHeight: 18 },
  stopRowRight: { alignItems: 'flex-end' },
  stopMetric: { fontSize: 18, fontWeight: '800' },
  stopMetricSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
