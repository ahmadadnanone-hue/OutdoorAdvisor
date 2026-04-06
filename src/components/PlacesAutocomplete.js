import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { loadGoogleMaps } from '../config/googleApi';

/**
 * City search using Google Places Autocomplete (web).
 * Biased to Pakistan and restricted to city-level results. Calls onPlaceSelect({ name, lat, lon }).
 */
export default function PlacesAutocomplete({ onPlaceSelect, placeholder = 'Search cities in Pakistan...' }) {
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    loadGoogleMaps().then((maps) => {
      if (!maps) return;
      serviceRef.current = new maps.places.AutocompleteService();
      // PlacesService needs a DOM node (can be hidden)
      const dummy = document.createElement('div');
      placesServiceRef.current = new maps.places.PlacesService(dummy);
      sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
    });
  }, []);

  const handleChange = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text || text.length < 2) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      if (!serviceRef.current) {
        setLoading(false);
        return;
      }
      serviceRef.current.getPlacePredictions(
        {
          input: text,
          componentRestrictions: { country: 'pk' },
          types: ['(cities)'],
          sessionToken: sessionTokenRef.current,
        },
        (results, status) => {
          setLoading(false);
          if (status === 'OK' && results) {
            setPredictions(results.slice(0, 6));
          } else {
            setPredictions([]);
          }
        }
      );
    }, 250);
  };

  const handleSelect = (prediction) => {
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'name', 'formatted_address'],
        sessionToken: sessionTokenRef.current,
      },
      (place, status) => {
        if (status === 'OK' && place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lon = place.geometry.location.lng();
          const name = place.name || prediction.structured_formatting?.main_text || prediction.description;
          onPlaceSelect({ name, lat, lon });
          setQuery('');
          setPredictions([]);
          // New session token for billing optimization
          if (window.google?.maps?.places) {
            sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
          }
        }
      }
    );
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.card }]}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          City search is available on the web app. On mobile, use the popular cities list below.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <TextInput
        value={query}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            color: colors.text,
          },
        ]}
      />
      {predictions.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: isDark ? '#1A2235' : '#FFFFFF', borderColor: colors.border }]}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => handleSelect(item)}>
                <Text style={styles.pin}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mainText, { color: colors.text }]} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description}
                  </Text>
                  {item.structured_formatting?.secondary_text && (
                    <Text style={[styles.secondaryText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.structured_formatting.secondary_text}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
      {loading && query.length >= 2 && predictions.length === 0 && (
        <View style={[styles.dropdown, { backgroundColor: isDark ? '#1A2235' : '#FFFFFF', borderColor: colors.border }]}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Searching...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', position: 'relative' },
  input: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pin: { fontSize: 16, marginRight: 10 },
  mainText: { fontSize: 14, fontWeight: '600' },
  secondaryText: { fontSize: 12, marginTop: 2 },
  loadingText: { padding: 12, fontSize: 13, textAlign: 'center' },
  fallback: { padding: 16, borderRadius: 12, alignItems: 'center' },
});
