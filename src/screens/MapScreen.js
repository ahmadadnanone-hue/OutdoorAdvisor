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
import { CITIES } from '../data/cities';
import { fetchAqiForCity } from '../hooks/useAQI';

function WebMap({ cities, cityAqiData, colors, onCitySelect }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    const loadLeaflet = () => {
      return new Promise((resolve) => {
        if (window.L) {
          resolve(window.L);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });
    };

    loadLeaflet().then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([30.3753, 69.3451], 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add markers for each city
      cities.forEach((city) => {
        const data = cityAqiData[city.name];
        const aqi = data?.aqi;
        const color = aqi != null ? getAqiColor(aqi) : '#9CA3AF';
        const category = aqi != null ? getAqiCategory(aqi) : 'N/A';
        const pm25 = data?.pm25 != null ? data.pm25 : 'N/A';

        const icon = L.divIcon({
          className: 'custom-aqi-marker',
          html: `<div style="
            background-color: ${color};
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 13px;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            font-family: system-ui, sans-serif;
          ">${aqi != null ? aqi : '--'}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([city.lat, city.lon], { icon }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 140px;">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">${city.name}</div>
            <div style="font-size: 13px; color: #555;">AQI: <strong style="color: ${color}">${aqi != null ? aqi : 'N/A'}</strong></div>
            <div style="font-size: 13px; color: #555;">${category}</div>
            <div style="font-size: 13px; color: #555;">PM2.5: ${pm25}</div>
          </div>
        `);

        markersRef.current.push({ name: city.name, marker });
      });

      // Fix tile rendering after mount
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
      }
    };
  }, [cityAqiData]);

  const flyToCity = useCallback((cityName) => {
    if (!mapInstanceRef.current) return;
    const city = cities.find((c) => c.name === cityName);
    if (city) {
      mapInstanceRef.current.flyTo([city.lat, city.lon], 10, { duration: 0.8 });
      const found = markersRef.current.find((m) => m.name === cityName);
      if (found) found.marker.openPopup();
    }
  }, [cities]);

  // Expose flyToCity to parent
  useEffect(() => {
    if (onCitySelect) {
      onCitySelect.current = flyToCity;
    }
  }, [flyToCity, onCitySelect]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[webStyles.fallback, { backgroundColor: colors.card }]}>
        <Text style={{ color: colors.textSecondary }}>Map requires web platform.</Text>
      </View>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 0,
      }}
    />
  );
}

const webStyles = {
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
};

export default function MapScreen() {
  const { colors } = useTheme();
  const [cityAqiData, setCityAqiData] = useState({});
  const [loading, setLoading] = useState(true);
  const flyToCityRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      const results = await Promise.allSettled(
        CITIES.map(async (city) => {
          const data = await fetchAqiForCity(city.waqiName);
          return { name: city.name, data };
        })
      );

      if (cancelled) return;

      const aqiMap = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          aqiMap[result.value.name] = result.value.data;
        }
      });

      setCityAqiData(aqiMap);
      setLoading(false);
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCityPress = useCallback((city) => {
    if (flyToCityRef.current) {
      flyToCityRef.current(city.name);
    }
  }, []);

  const renderCityRow = useCallback(
    ({ item }) => {
      const data = cityAqiData[item.name];
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
    [cityAqiData, colors, handleCityPress]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.mapContainer}>
        <WebMap
          cities={CITIES}
          cityAqiData={cityAqiData}
          colors={colors}
          onCitySelect={flyToCityRef}
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
