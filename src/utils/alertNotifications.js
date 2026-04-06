import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as persistentCache from './persistentCache';

const ALERT_CACHE_NS = 'local_alert_notice';
const DEFAULT_COOLDOWN_MS = 3 * 60 * 60 * 1000;
const ANDROID_CHANNEL_ID = 'outdooradvisor-alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isBrowserNotificationsAvailable() {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  );
}

export async function ensureLocalNotificationPermission({ prompt = false } = {}) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { granted: false, supported: false };
    }

    if (Notification.permission === 'granted') return { granted: true, supported: true };
    if (Notification.permission === 'default' && prompt) {
      const permission = await Notification.requestPermission();
      return { granted: permission === 'granted', supported: true };
    }

    return { granted: false, supported: true, blocked: Notification.permission === 'denied' };
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted' && prompt) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status === 'granted' && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'OutdoorAdvisor alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#4F8EF7',
    });
  }

  return {
    granted: status === 'granted',
    supported: true,
    blocked: status === 'denied',
  };
}

export async function maybeSendLocalAlert(key, payload, cooldownMs = DEFAULT_COOLDOWN_MS) {
  if (!payload?.title || !payload?.body) return false;

  const sentRecently = persistentCache.get(ALERT_CACHE_NS, key, cooldownMs);
  if (sentRecently) return false;

  try {
    const permission = await ensureLocalNotificationPermission();
    if (!permission.granted) return false;

    if (Platform.OS === 'web' && isBrowserNotificationsAvailable()) {
      const notification = new Notification(payload.title, {
        body: payload.body,
        tag: payload.tag || key,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });

      notification.onclick = () => {
        if (payload.url) window.open(payload.url, '_blank');
      };
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.url ? { url: payload.url } : undefined,
          sound: 'default',
        },
        trigger: null,
      });
    }

    persistentCache.set(ALERT_CACHE_NS, key, { sentAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}
