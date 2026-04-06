import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking, Platform } from 'react-native';
import { loadGoogleMaps } from '../config/googleApi';
import { fetchAqiForLocation } from '../hooks/useAQI';
import * as persistentCache from '../utils/persistentCache';
import typography from '../theme/typography';
import { getAqiColor, getAqiCategory } from '../theme/colors';

// 24-hour cache — places don't move
const PLACES_CACHE_TTL = 24 * 60 * 60 * 1000;
const PLACES_CACHE_NS = 'places';

// Haversine-ish approximation (good enough for short distances to label a card)
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function NearbyPlaces({ lat, lon, keyword, type, colors, title = 'Nearby Places' }) {
  const [places, setPlaces] = useState(null); // null = loading, [] = empty, [...] = results
  const [error, setError] = useState(null);
  const dummyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (Platform.OS !== 'web') {
        setError('Nearby venue suggestions are available on the web app. AQI and activity guidance still work on mobile.');
        setPlaces([]);
        return;
      }
      if (lat == null || lon == null || (!keyword && !type)) {
        setPlaces([]);
        return;
      }

      // Check persistent cache first — places don't move, 24h TTL.
      // Key: query + location rounded to 2 decimals (~1.1 km cell)
      const cacheKey = `${type || ''}|${keyword || ''}|${lat.toFixed(2)},${lon.toFixed(2)}`;
      const cached = persistentCache.get(PLACES_CACHE_NS, cacheKey, PLACES_CACHE_TTL);
      if (cached) {
        setPlaces(cached);
        return;
      }

      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !maps) return;

        // PlacesService needs an HTMLDivElement (or an existing map) as attribution container.
        const container = document.createElement('div');
        const service = new maps.places.PlacesService(container);

        const request = {
          location: new maps.LatLng(lat, lon),
          radius: 15000, // 15 km
          keyword: keyword || undefined,
          type: type || undefined,
        };

        service.nearbySearch(request, async (results, status) => {
          if (cancelled) return;
          if (status !== maps.places.PlacesServiceStatus.OK || !results) {
            setPlaces([]);
            return;
          }

          const basePlaces = results
            .filter((r) => r.geometry?.location)
            .map((r) => {
              const pLat = r.geometry.location.lat();
              const pLon = r.geometry.location.lng();
              return {
                id: r.place_id,
                name: r.name,
                rating: r.rating,
                userRatingsTotal: r.user_ratings_total,
                vicinity: r.vicinity,
                lat: pLat,
                lon: pLon,
                distanceKm: distanceKm(lat, lon, pLat, pLon),
                open: r.opening_hours?.open_now,
              };
            })
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, 6);

          try {
            const enriched = await Promise.all(
              basePlaces.map(async (place) => {
                const aqiData = await fetchAqiForLocation(place.lat, place.lon);
                return {
                  ...place,
                  aqi: aqiData?.aqi ?? null,
                };
              })
            );

            if (cancelled) return;
            persistentCache.set(PLACES_CACHE_NS, cacheKey, enriched);
            setPlaces(enriched);
          } catch {
            if (cancelled) return;
            persistentCache.set(PLACES_CACHE_NS, cacheKey, basePlaces);
            setPlaces(basePlaces);
          }
        });
      } catch (e) {
        if (!cancelled) {
          setError('Could not load nearby places.');
          setPlaces([]);
        }
      }
    }

    setPlaces(null);
    setError(null);
    run();

    return () => {
      cancelled = true;
    };
  }, [lat, lon, keyword, type]);

  const openInMaps = (place) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.id}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]} ref={dummyRef}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>

      {places === null && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Finding venues near you...
          </Text>
        </View>
      )}

      {places && places.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {error || 'No venues found within 15 km. Try searching on Google Maps.'}
        </Text>
      )}

      {places && places.length > 0 &&
        places.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.placeRow, { borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => openInMaps(p)}
          >
            <View style={styles.placeInfo}>
              <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>
                {p.name}
              </Text>
              {p.vicinity ? (
                <Text style={[styles.placeVicinity, { color: colors.textSecondary }]} numberOfLines={1}>
                  {p.vicinity}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                {p.rating != null && (
                  <Text style={[styles.metaText, { color: '#F59E0B' }]}>
                    ★ {p.rating.toFixed(1)}{p.userRatingsTotal ? ` (${p.userRatingsTotal})` : ''}
                  </Text>
                )}
                {p.open === true && (
                  <Text style={[styles.metaText, { color: '#10B981' }]}>Open now</Text>
                )}
                {p.open === false && (
                  <Text style={[styles.metaText, { color: '#EF4444' }]}>Closed</Text>
                )}
                {p.aqi != null && (
                  <Text style={[styles.metaText, { color: getAqiColor(p.aqi) }]}>
                    AQI {p.aqi} · {getAqiCategory(p.aqi)}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.distanceBlock}>
              <Text style={[styles.distanceValue, { color: colors.primary }]}>
                {p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm.toFixed(1)} km`}
              </Text>
              <Text style={[styles.distanceLabel, { color: colors.textSecondary }]}>away</Text>
            </View>
          </TouchableOpacity>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: typography.body,
  },
  emptyText: {
    fontSize: typography.body,
    fontStyle: 'italic',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  placeInfo: {
    flex: 1,
    paddingRight: 8,
  },
  placeName: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  placeVicinity: {
    fontSize: typography.caption,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  distanceBlock: {
    alignItems: 'flex-end',
  },
  distanceValue: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  distanceLabel: {
    fontSize: 10,
  },
});
