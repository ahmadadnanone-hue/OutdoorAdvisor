import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  Pressable, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { CITIES } from '../../data/cities';
import { colors as dc } from '../../design';
import Icon, { ICON } from '../Icon';
import { GOOGLE_MAPS_API_KEY } from '../../config/googleApi';
import { getPremiumFeatureCopy } from '../../lib/premium';

// ─── Google Places REST (works on iOS — no JS SDK needed) ────────────────────
async function fetchPredictions(input) {
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(input)}` +
    `&types=(cities)` +
    `&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(json.status);
  }
  return json.predictions ?? [];
}

async function fetchPlaceDetails(placeId) {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=geometry,name,formatted_address` +
    `&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK') throw new Error(json.status);
  return json.result;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CityPickerModal({
  visible, onClose, city,
  isPremium,
  refreshLocation, refreshAqi, refreshWeather, refreshPollen,
  selectCity, selectPlace,
}) {
  const [query, setQuery]           = useState('');
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [selecting, setSelecting]   = useState(false);
  const debounceRef                 = useRef(null);
  const inputRef                    = useRef(null);

  // Local filtered list (shown while query is short / no predictions yet)
  const localFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CITIES;
    return CITIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const handleChange = useCallback((text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchPredictions(text.trim());
        setPredictions(results.slice(0, 8));
      } catch {
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectPrediction = useCallback(async (prediction) => {
    setSelecting(true);
    try {
      const detail = await fetchPlaceDetails(prediction.place_id);
      const lat = detail.geometry.location.lat;
      const lon = detail.geometry.location.lng;
      const name =
        detail.name ||
        prediction.structured_formatting?.main_text ||
        prediction.description;
      // Use Google's secondary_text (e.g. "Qatar", "Punjab, India") as the region
      const region = prediction.structured_formatting?.secondary_text || '';
      selectPlace({ name, lat, lon, region });
      handleClose();
    } catch {
      // fallback — do nothing, keep modal open
    } finally {
      setSelecting(false);
    }
  }, [selectPlace]);

  const handleSelectLocal = useCallback((item) => {
    selectCity(item.name);
    handleClose();
  }, [selectCity]);

  const handleDeviceLocation = useCallback(async () => {
    const loc = await refreshLocation(true);
    if (loc?.lat != null && loc?.lon != null) {
      await Promise.all([
        refreshAqi(loc.lat, loc.lon, { force: true }),
        refreshWeather(loc.lat, loc.lon, { force: true }),
        refreshPollen(loc.lat, loc.lon, { force: true }),
      ]);
    }
    handleClose();
  }, [refreshLocation, refreshAqi, refreshWeather, refreshPollen]);

  const handleClose = useCallback(() => {
    setQuery('');
    setPredictions([]);
    setSearching(false);
    onClose();
  }, [onClose]);

  // Decide what list to show
  const showPredictions = query.trim().length >= 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={() => setTimeout(() => inputRef.current?.focus(), 100)}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>

          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose City</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Icon name="close" size={20} color={dc.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search input — premium only */}
          {isPremium ? (
            <View style={styles.searchRow}>
              <Icon name={ICON.search} size={18} color={dc.textMuted} style={styles.searchIcon} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={handleChange}
                placeholder="Search any city in the world…"
                placeholderTextColor={dc.textMuted}
                style={styles.input}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {searching && (
                <ActivityIndicator size="small" color={dc.accentCyan} style={styles.spinner} />
              )}
            </View>
          ) : (
            /* Locked search bar for free users */
            <View style={[styles.searchRow, styles.searchRowLocked]}>
              <Icon name="lock-closed-outline" size={16} color="rgba(251,191,36,0.7)" style={styles.searchIcon} />
              <Text style={styles.lockedInputText}>Search cities worldwide</Text>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
            </View>
          )}

          {/* Current location — always available */}
          <TouchableOpacity style={styles.deviceRow} activeOpacity={0.75} onPress={handleDeviceLocation}>
            <View style={styles.deviceIconWrap}>
              <Icon name={ICON.location} size={18} color={dc.accentCyan} />
            </View>
            <Text style={styles.deviceText}>Use Current Location</Text>
            <Icon name={ICON.chevronRight} size={16} color={dc.textMuted} />
          </TouchableOpacity>

          {/* Premium upsell banner for free users */}
          {!isPremium && (
            <View style={styles.upsellBanner}>
              <View style={styles.upsellIcon}>
                <Icon name="star" size={16} color="#FCD34D" />
              </View>
              <View style={styles.upsellText}>
                <Text style={styles.upsellTitle}>Unlock Worldwide City Search</Text>
                <Text style={styles.upsellBody}>Premium members can search any city globally and get tailored forecasts wherever they go.</Text>
              </View>
            </View>
          )}

          {/* Section label */}
          {isPremium && (
            <Text style={styles.sectionLabel}>
              {showPredictions
                ? (predictions.length > 0 ? `${predictions.length} results` : (searching ? 'Searching…' : 'No results'))
                : 'POPULAR CITIES'}
            </Text>
          )}

          {/* Results list — premium only */}
          {isPremium ? (
            showPredictions ? (
              <FlatList
                data={predictions}
                keyExtractor={(item) => item.place_id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cityRow}
                    onPress={() => handleSelectPrediction(item)}
                    activeOpacity={0.7}
                    disabled={selecting}
                  >
                    <View style={styles.pinWrap}>
                      <Icon name={ICON.locationPin} size={14} color={dc.accentCyan} />
                    </View>
                    <View style={styles.predictionText}>
                      <Text style={styles.cityName} numberOfLines={1}>
                        {item.structured_formatting?.main_text || item.description}
                      </Text>
                      {item.structured_formatting?.secondary_text ? (
                        <Text style={styles.citySubtitle} numberOfLines={1}>
                          {item.structured_formatting.secondary_text}
                        </Text>
                      ) : null}
                    </View>
                    {selecting && <ActivityIndicator size="small" color={dc.textMuted} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !searching ? (
                    <View style={styles.empty}>
                      <Icon name={ICON.search} size={26} color={dc.textMuted} />
                      <Text style={styles.emptyText}>No cities found for "{query}"</Text>
                    </View>
                  ) : null
                }
              />
            ) : (
              <FlatList
                data={localFiltered}
                keyExtractor={(item) => item.name}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const active = item.name === city;
                  return (
                    <TouchableOpacity
                      style={[styles.cityRow, active && styles.cityRowActive]}
                      onPress={() => handleSelectLocal(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pinWrap}>
                        <Icon
                          name={active ? ICON.locationPin : ICON.location}
                          size={14}
                          color={active ? dc.accentCyan : dc.textMuted}
                        />
                      </View>
                      <Text style={[styles.cityName, active && styles.cityNameActive]}>
                        {item.name}
                      </Text>
                      {active && <Icon name={ICON.check} size={15} color={dc.accentCyan} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )
          ) : null}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#151D2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: dc.cardStroke,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: dc.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 46,
  },
  searchIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    color: dc.textPrimary,
    height: '100%',
  },
  spinner: { marginLeft: 8 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: dc.cardStrokeSoft,
    gap: 12,
    marginBottom: 4,
  },
  deviceIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(155,200,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  deviceText: { flex: 1, fontSize: 15, fontWeight: '600', color: dc.textPrimary },
  sectionLabel: {
    fontSize: 11, fontWeight: '800',
    color: dc.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 14, marginBottom: 6,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dc.cardStrokeSoft,
    gap: 10,
  },
  cityRowActive: {
    backgroundColor: 'rgba(155,200,255,0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: -6,
  },
  pinWrap: { width: 20, alignItems: 'center' },
  predictionText: { flex: 1 },
  cityName: { fontSize: 15, color: dc.textSecondary, flex: 1 },
  cityNameActive: { color: dc.textPrimary, fontWeight: '600' },
  citySubtitle: { fontSize: 12, color: dc.textMuted, marginTop: 1 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyText: { fontSize: 14, color: dc.textMuted, textAlign: 'center' },

  // Premium gate styles
  searchRowLocked: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderColor: 'rgba(251,191,36,0.18)',
  },
  lockedInputText: {
    flex: 1,
    fontSize: 15,
    color: dc.textMuted,
    fontStyle: 'italic',
  },
  premiumBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FCD34D',
    letterSpacing: 1,
  },
  upsellBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.15)',
    padding: 14,
    marginTop: 10,
    gap: 10,
  },
  upsellIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  upsellText: { flex: 1, gap: 3 },
  upsellTitle: { fontSize: 13, fontWeight: '700', color: '#FCD34D' },
  upsellBody: { fontSize: 12, color: dc.textMuted, lineHeight: 17 },
});
