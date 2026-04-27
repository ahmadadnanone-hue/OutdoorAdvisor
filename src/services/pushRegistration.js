import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { fetchApiJson } from '../config/api';
import { loadStoredNotifications, loadStoredThresholds } from '../utils/alertPreferences';
import { loadLocationSnapshot } from '../utils/locationSnapshot';
import { ensureLocalNotificationPermission } from '../utils/alertNotifications';

const EXPO_PROJECT_ID = '0b8b92b0-0722-4ab1-b4c4-34df3ba8e956';
const DEVICE_ID_KEY = 'outdooradvisor_native_push_device_id_v1';
const TOKEN_KEY = 'outdooradvisor_expo_push_token_v1';

function makeDeviceId() {
  return `oa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = makeDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

export async function registerNativePushToken({
  prompt = false,
  preferencesOverride = null,
  thresholdsOverride = null,
  locationOverride = null,
} = {}) {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return { registered: false, reason: 'unsupported-platform' };
  }

  const permission = await ensureLocalNotificationPermission({ prompt });
  if (!permission.granted) {
    return { registered: false, reason: permission.blocked ? 'permission-blocked' : 'permission-not-granted' };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId: EXPO_PROJECT_ID,
  });
  const expoPushToken = tokenResponse?.data;
  if (!expoPushToken) return { registered: false, reason: 'missing-token' };

  const [deviceId, preferences, thresholds, location] = await Promise.all([
    getDeviceId(),
    preferencesOverride ? Promise.resolve(preferencesOverride) : loadStoredNotifications(),
    thresholdsOverride ? Promise.resolve(thresholdsOverride) : loadStoredThresholds(),
    locationOverride ? Promise.resolve(locationOverride) : loadLocationSnapshot(),
  ]);

  await fetchApiJson('/api/push?action=register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expoPushToken,
      deviceId,
      platform: Platform.OS,
      appVersion: '1.0.0',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi',
      preferences,
      thresholds,
      location,
    }),
  });

  await AsyncStorage.setItem(TOKEN_KEY, expoPushToken);
  return { registered: true, expoPushToken };
}

export async function syncNativePushRegistration() {
  try {
    return await registerNativePushToken({ prompt: false });
  } catch (error) {
    return { registered: false, reason: error.message || 'registration-failed' };
  }
}

export async function unregisterNativePushToken() {
  const expoPushToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (!expoPushToken) return { unregistered: false, reason: 'missing-token' };

  await fetchApiJson('/api/push?action=unregister', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expoPushToken }),
  });

  await AsyncStorage.removeItem(TOKEN_KEY);
  return { unregistered: true };
}
