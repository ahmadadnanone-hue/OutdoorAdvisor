import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getAqiColor, getAqiCategory } from '../theme/colors';
import typography from '../theme/typography';
import { CITIES, ALL_AQI_POINTS } from '../data/cities';
import { fetchAqiForLocation } from '../hooks/useAQI';
import { loadGoogleMaps } from '../config/googleApi';
import * as persistentCache from '../utils/persistentCache';

const MAP_CACHE_NS = 'aqi_map';
const MAP_CACHE_KEY = 'all_points_v1';
const MAP_CACHE_TTL = 30 * 60 * 1000;

// Google Maps dark style (subtle, to match app dark theme)
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#2c3e50' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

function markerSvg(aqi, color, major) {
  const label = aqi != null ? String(aqi) : '--';
  // Sub-area balloons are smaller so major cities stand out
  const size = major ? 44 : 34;
  const fontSize = major ? 13 : 11;
  const r = major ? 18 : 14;
  const stroke = major ? 3 : 2;
  const center = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="${r}" fill="${color}" stroke="white" stroke-width="${stroke}"/>
    <text x="${center}" y="${center + fontSize / 3 + 1}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function GoogleMapView({ points, aqiData, isDark, onReady }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const infoWindowRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    loadGoogleMaps().then((maps) => {
      if (!maps || !mapRef.current || mapInstanceRef.current) return;

      const map = new maps.Map(mapRef.current, {
        center: { lat: 30.3753, lng: 69.3451 },
        zoom: 5,
        disableDefaultUI: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: isDark ? DARK_MAP_STYLES : undefined,
      });
      mapInstanceRef.current = map;
      infoWindowRef.current = new maps.InfoWindow();

      if (onReady) onReady({ map, maps, markers: markersRef, infoWindow: infoWindowRef });
    });

    return () => {
      Object.values(markersRef.current).forEach((m) => m.setMap && m.setMap(null));
      markersRef.current = {};
      mapInstanceRef.current = null;
    };
  }, [isDark]);

  // (Re)build markers when AQI data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof window === 'undefined' || !window.google) return;
    const maps = window.google.maps;

    // Clear existing
    Object.values(markersRef.current).forEach((m) => m.setMap(null));
    markersRef.current = {};

    points.forEach((point) => {
      const data = aqiData[point.key];
      const aqi = data?.aqi;
      const color = aqi != null ? getAqiColor(aqi) : '#9CA3AF';
      const category = aqi != null ? getAqiCategory(aqi) : 'N/A';
      const pm25 = data?.pm25 != null ? data.pm25 : 'N/A';
      const size = point.isMajor ? 44 : 34;
      const half = size / 2;

      const marker = new maps.Marker({
        position: { lat: point.lat, lng: point.lon },
        map,
        title: point.sub ? `${point.label}, ${point.sub}` : point.label,
        // Major cities sit on top so they're never covered by sub-areas
        zIndex: point.isMajor ? 1000 : 100,
        icon: {
          url: markerSvg(aqi, color, point.isMajor),
          scaledSize: new maps.Size(size, size),
          anchor: new maps.Point(half, half),
        },
      });

      marker.addListener('click', () => {
        const title = point.sub ? `${point.label}<span style="color:#666;font-weight:500"> · ${point.sub}</span>` : point.label;
        infoWindowRef.current.setContent(`
          <div style="font-family: system-ui, sans-serif; min-width: 160px; color:#111;">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 13px;">AQI: <strong style="color:${color}">${aqi != null ? aqi : 'N/A'}</strong></div>
            <div style="font-size: 13px;">${category}</div>
            <div style="font-size: 13px;">PM2.5: ${pm25}</div>
          </div>
        `);
        infoWindowRef.current.open({ anchor: marker, map });
      });

      markersRef.current[point.key] = marker;
    });
  }, [aqiData, points]);

  if (Platform.OS !== 'web') {
    return (
      <View style={webStyles.fallback}>
        <Text style={webStyles.fallbackTitle}>Interactive AQI map is available on the web app.</Text>
        <Text style={webStyles.fallbackBody}>
          On mobile, use the city air quality list below for the same live readings.
        </Text>
      </View>
    );
  }

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

const webStyles = {
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  fallbackTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  fallbackBody: { fontSize: 13, lineHeight: 18, textAlign: 'center', opacity: 0.75 },
};

export default function MapScreen() {
  const { colors, isDark } = useTheme();
  const [aqiData, setAqiData] = useState({});
  const [loading, setLoading] = useState(true);
  const mapCtxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      const cached = persistentCache.get(MAP_CACHE_NS, MAP_CACHE_KEY, MAP_CACHE_TTL);
      if (cached && !cancelled) {
        setAqiData(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      // Fetch every point (major cities + sub-areas) in parallel.
      // Google Air Quality API is hyperlocal so each point returns a distinct reading.
      const results = await Promise.allSettled(
        ALL_AQI_POINTS.map(async (point) => {
          const data = await fetchAqiForLocation(point.lat, point.lon);
          return { key: point.key, data };
        })
      );

      if (cancelled) return;

      const aqiMap = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          aqiMap[result.value.key] = result.value.data;
        }
      });

      setAqiData(aqiMap);
      persistentCache.set(MAP_CACHE_NS, MAP_CACHE_KEY, aqiMap);
      setLoading(false);
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCityPress = useCallback((city) => {
    const ctx = mapCtxRef.current;
    if (!ctx) return;
    ctx.map.panTo({ lat: city.lat, lng: city.lon });
    ctx.map.setZoom(11);
    const marker = ctx.markers.current[city.name];
    if (marker) {
      // Trigger the click handler so the InfoWindow content gets built
      window.google?.maps?.event?.trigger(marker, 'click');
    }
  }, []);

  const renderCityRow = useCallback(
    ({ item }) => {
      const data = aqiData[item.name];
      const aqi = data?.aqi;
      const dotColor = aqi != null ? getAqiColor(aqi) : colors.textSecondary;
      const category = aqi != null ? getAqiCategory(aqi) : 'N/A';

      return (
        <TouchableOpacity
          style={[styles.cityRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={() => handleCityPress(item)}
        >
          <View style={[styles.aqiDot, { backgroundColor: dotColor }]} />
          <View style={styles.cityInfo}>
            <Text style={[styles.cityName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.categoryText, { color: colors.textSecondary }]}>{category}</Text>
          </View>
          <Text style={[styles.aqiNumber, { color: dotColor }]}>
            {aqi != null ? aqi : '--'}
          </Text>
        </TouchableOpacity>
      );
    },
    [aqiData, colors, handleCityPress]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.mapContainer}>
        <GoogleMapView
          points={ALL_AQI_POINTS}
          aqiData={aqiData}
          isDark={isDark}
          onReady={(ctx) => {
            mapCtxRef.current = ctx;
          }}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </View>

      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.listHeader, { color: colors.text }]}>City Air Quality</Text>
        {loading ? (
          <View style={styles.listLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Fetching AQI data...
            </Text>
          </View>
        ) : (
          <FlatList
            data={CITIES}
            keyExtractor={(item) => item.name}
            renderItem={renderCityRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 6,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  listContainer: {
    flex: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listHeader: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 24,
  },
  listLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: typography.caption,
    marginTop: 6,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  aqiDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  categoryText: {
    fontSize: typography.caption,
    marginTop: 2,
  },
  aqiNumber: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
});
