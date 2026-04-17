import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
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
import CityPicker from '../components/CityPicker';
import VehicleToggle from '../components/VehicleToggle';

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

export default function RoutePlannerScreen() {
  const { colors, isDark } = useTheme();
  const { isPremium } = useAuth();
  const plannerCities = useMemo(() => getPlannerCityOptions(), []);
  const quickPairs = useMemo(() => getPlannerQuickPairs(), []);
  const [fromCity, setFromCity] = useState('Lahore');
  const [toCity, setToCity] = useState('Islamabad');
  const [vehicleType, setVehicleType] = useState('car');
  const [nhmpData, setNhmpData] = useState([]);
  const [pmdAlerts, setPmdAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [stopConditions, setStopConditions] = useState({});
  // hasSearched gates the results area and API fetch. Resets whenever the
  // user changes inputs so they always tap "Plan route" explicitly.
  const [hasSearched, setHasSearched] = useState(false);

  const candidateRoutes = useMemo(
    () => buildPlannerCandidates(fromCity, toCity),
    [fromCity, toCity]
  );

  const scoredPlans = useMemo(
    () => scorePlannerCandidates(candidateRoutes, nhmpData, pmdAlerts, stopConditions, { vehicleType }),
    [candidateRoutes, nhmpData, pmdAlerts, stopConditions, vehicleType]
  );

  // Invalidate prior search whenever the user edits inputs.
  useEffect(() => {
    setHasSearched(false);
  }, [fromCity, toCity, vehicleType]);

  const sameCity = !fromCity || !toCity || fromCity === toCity;

  useEffect(() => {
    let cancelled = false;

    async function loadPlannerData() {
      if (!isPremium || candidateRoutes.length === 0 || !hasSearched) {
        if (!hasSearched) setStopConditions({});
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
  }, [candidateRoutes, isPremium, hasSearched]);

  useEffect(() => {
    setExpandedPlanId(scoredPlans[0]?.id || null);
  }, [fromCity, toCity, scoredPlans]);

  const bestPlan = scoredPlans[0] || null;

  if (!isPremium) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.heroCard, { backgroundColor: '#0F3B57', borderColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={styles.heroBadgeRow}>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <Text style={styles.heroBadgeText}>Premium</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,214,102,0.16)' }]}>
              <Text style={[styles.heroBadgeText, { color: '#FDE68A' }]}>Experimental</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Route Planner</Text>
          <Text style={styles.heroBody}>
            Compare supported city-to-city corridors, check live NHMP and PMD signals, and rank the lowest-risk route before you leave.
          </Text>
        </View>

        <View style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.lockedTitle, { color: colors.text }]}>Premium route planning is locked</Text>
          <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>
            This experimental feature reads motorway advisories, PMD alerts, rain, wind, and AQI across route stops to suggest the calmer option first.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.heroCard, { backgroundColor: '#0F3B57', borderColor: 'rgba(255,255,255,0.08)' }]}>
        <View style={styles.heroBadgeRow}>
          <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
            <Text style={styles.heroBadgeText}>Premium</Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,214,102,0.16)' }]}>
            <Text style={[styles.heroBadgeText, { color: '#FDE68A' }]}>Experimental</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>Route Planner</Text>
        <Text style={styles.heroBody}>
          Plan supported city-to-city trips with live NHMP, PMD, AQI, rain, fog, and wind signals ranked into the lowest-risk option first.
        </Text>
      </View>

      <View style={[styles.selectorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.pickerRow}>
          <CityPicker
            label="From"
            value={fromCity}
            options={plannerCities}
            onChange={setFromCity}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setFromCity(toCity);
              setToCity(fromCity);
            }}
            style={[styles.swapCircle, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '33' }]}
            accessibilityLabel="Swap from and to"
          >
            <Text style={[styles.swapArrow, { color: colors.primary }]}>⇄</Text>
          </TouchableOpacity>
          <CityPicker
            label="To"
            value={toCity}
            options={plannerCities}
            onChange={setToCity}
            accentColor="#0F766E"
          />
        </View>

        <VehicleToggle value={vehicleType} onChange={setVehicleType} />

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={sameCity}
          onPress={() => setHasSearched(true)}
          style={[
            styles.planButton,
            { backgroundColor: colors.primary },
            sameCity && styles.planButtonDisabled,
          ]}
          accessibilityLabel="Plan route"
        >
          <Text style={styles.planButtonText}>
            {sameCity ? 'Pick two different cities' : 'Plan route'}
          </Text>
        </TouchableOpacity>

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
              <Text style={[styles.quickPairText, { color: colors.primary }]}>{pair.from} → {pair.to}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!hasSearched ? (
        <View style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.lockedTitle, { color: colors.text }]}>Ready when you are</Text>
          <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>
            Choose your From and To cities, pick a vehicle, then tap Plan route to pull live NHMP, PMD, and stop-by-stop AQI for every supported corridor.
          </Text>
        </View>
      ) : loading ? (
        <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Checking route conditions across the supported network…</Text>
        </View>
      ) : candidateRoutes.length === 0 ? (
        <View style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.lockedTitle, { color: colors.text }]}>No supported route found yet</Text>
          <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>
            This experimental planner currently works on the motorway and corridor network already mapped in Travel. Try Lahore to Islamabad, Islamabad to Murree, Islamabad to Mansehra, Multan to Sukkur, or Hyderabad to Karachi.
          </Text>
        </View>
      ) : (
        <>
          {bestPlan && (
            <View style={[styles.bestCard, { backgroundColor: bestPlan.tone + '12', borderColor: bestPlan.tone + '22' }]}>
              <Text style={[styles.bestEyebrow, { color: colors.textSecondary }]}>Best route right now</Text>
              <Text style={[styles.bestTitle, { color: bestPlan.tone }]}>{bestPlan.title}</Text>
              <Text style={[styles.bestBody, { color: colors.text }]}>
                {bestPlan.summary}. {bestPlan.recommendation} based on the current advisory and stop scan mix.
              </Text>
              {bestPlan.reasons[0] ? (
                <Text style={[styles.bestReason, { color: colors.textSecondary }]}>
                  Main watch item: {bestPlan.reasons[0]}
                </Text>
              ) : null}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  heroBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  heroBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  heroBody: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 21 },
  selectorCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 14,
  },
  swapCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapArrow: { fontSize: 18, fontWeight: '800' },
  planButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  planButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  planButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionHint: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginTop: 4 },
  quickPairRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickPairChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  quickPairText: { fontSize: 12, fontWeight: '700' },
  loadingCard: { borderWidth: 1, borderRadius: 18, padding: 18, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  lockedCard: { borderWidth: 1, borderRadius: 18, padding: 18 },
  lockedTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  lockedBody: { fontSize: 14, lineHeight: 21 },
  bestCard: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 14 },
  bestEyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  bestTitle: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  bestBody: { fontSize: 14, lineHeight: 21 },
  bestReason: { fontSize: 12, lineHeight: 18, marginTop: 8 },
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
