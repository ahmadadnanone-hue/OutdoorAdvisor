import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, FlatList, StyleSheet } from 'react-native';
import PlacesAutocomplete from '../PlacesAutocomplete';
import { CITIES } from '../../data/cities';
import { colors as dc } from '../../design';

export default function CityPickerModal({ visible, onClose, city, refreshLocation, refreshAqi, refreshWeather, refreshPollen, selectCity, selectPlace }) {
  const handleDeviceLocation = async () => {
    const loc = await refreshLocation(true);
    if (loc?.lat != null && loc?.lon != null) {
      await Promise.all([
        refreshAqi(loc.lat, loc.lon, { force: true }),
        refreshWeather(loc.lat, loc.lon, { force: true }),
        refreshPollen(loc.lat, loc.lon, { force: true }),
      ]);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Search City</Text>

          <TouchableOpacity style={styles.deviceRow} activeOpacity={0.75} onPress={handleDeviceLocation}>
            <Text style={styles.deviceIcon}>📍</Text>
            <Text style={styles.deviceText}>Current Location</Text>
          </TouchableOpacity>

          <View style={styles.autocompleteWrap}>
            <PlacesAutocomplete
              onPlaceSelect={(place) => { selectPlace(place); onClose(); }}
              placeholder="Search cities in Pakistan..."
            />
          </View>

          <Text style={styles.popularLabel}>Popular Cities</Text>
          <FlatList
            data={CITIES}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cityRow, item.name === city && styles.cityRowActive]}
                onPress={() => { selectCity(item.name); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.cityName}>{item.name}</Text>
                {item.name === city && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#151D2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: dc.cardStroke, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: dc.textPrimary, marginBottom: 16 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: dc.cardStrokeSoft, gap: 10 },
  deviceIcon: { fontSize: 20 },
  deviceText: { fontSize: 16, fontWeight: '600', color: dc.textPrimary },
  autocompleteWrap: { marginVertical: 14 },
  popularLabel: { fontSize: 11, fontWeight: '800', color: dc.textMuted, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: dc.cardStrokeSoft },
  cityRowActive: { backgroundColor: 'rgba(155,200,255,0.10)', borderRadius: 10, paddingHorizontal: 8 },
  cityName: { fontSize: 16, color: dc.textPrimary },
  check: { fontSize: 16, color: dc.accentCyan, fontWeight: '700' },
});
