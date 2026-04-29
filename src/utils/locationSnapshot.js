import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_SNAPSHOT_KEY = 'outdooradvisor_location_snapshot_v1';

export async function saveLocationSnapshot(snapshot) {
  if (snapshot?.lat == null || snapshot?.lon == null) return;

  const payload = {
    lat: snapshot.lat,
    lon: snapshot.lon,
    city: snapshot.city || 'Selected',
    region: snapshot.region || '',
    address: snapshot.address || snapshot.region || '',
    source: snapshot.source || 'manual',
    updatedAt: Date.now(),
  };

  await AsyncStorage.setItem(LOCATION_SNAPSHOT_KEY, JSON.stringify(payload));
}

export async function loadLocationSnapshot() {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.lat == null || parsed?.lon == null) return null;
    return parsed;
  } catch {
    return null;
  }
}
