import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ensureLocalNotificationPermission } from '../utils/alertNotifications';
import { appendInboxNotification } from '../utils/notificationInbox';

const DAILY_LIMIT = 2;
const COUNTER_KEY = 'outdooradvisor_smart_notification_counter_v1';

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

async function readCounter() {
  try {
    const raw = await AsyncStorage.getItem(COUNTER_KEY);
    if (!raw) return { day: todayKey(), count: 0 };
    const parsed = JSON.parse(raw);
    if (parsed?.day !== todayKey()) {
      return { day: todayKey(), count: 0 };
    }
    return parsed;
  } catch {
    return { day: todayKey(), count: 0 };
  }
}

async function writeCounter(counter) {
  await AsyncStorage.setItem(COUNTER_KEY, JSON.stringify(counter));
}

export async function requestNotificationPermission({ prompt = true } = {}) {
  return ensureLocalNotificationPermission({ prompt });
}

export async function getNotificationDeliveryState() {
  const permission = await ensureLocalNotificationPermission({ prompt: false });
  return {
    granted: !!permission.granted,
    supported: permission.supported !== false,
    blocked: !!permission.blocked,
  };
}

export async function getSmartNotificationQuota() {
  const counter = await readCounter();
  return {
    sentToday: counter.count,
    remaining: Math.max(0, DAILY_LIMIT - counter.count),
  };
}

async function canSendSmartNotification() {
  const permission = await getNotificationDeliveryState();
  if (!permission.granted) return { allowed: false, reason: 'permission' };

  const counter = await readCounter();
  if (counter.count >= DAILY_LIMIT) {
    return { allowed: false, reason: 'daily-limit', counter };
  }

  return { allowed: true, counter };
}

async function incrementCounter(counter) {
  const next = {
    day: todayKey(),
    count: Math.min(DAILY_LIMIT, (counter?.count || 0) + 1),
  };
  await writeCounter(next);
}

export async function sendSmartNotification(title, body, options = {}) {
  if (!title || !body) return false;

  const permission = await requestNotificationPermission({
    prompt: options.promptForPermission !== false,
  });
  if (!permission.granted) return false;

  const quota = await canSendSmartNotification();
  if (!quota.allowed) return false;

  const payload = {
    title,
    body,
    category: options.category || 'Smart',
    url: options.url || null,
  };

  if (Platform.OS === 'web' && typeof Notification !== 'undefined') {
    const notification = new Notification(title, {
      body,
      tag: options.tag || 'smart-outdoor-advisor',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });

    notification.onclick = () => {
      if (options.url) window.open(options.url, '_blank');
    };
  } else {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: options.url ? { url: options.url } : undefined,
        sound: 'default',
      },
      trigger: null,
    });
  }

  await appendInboxNotification(payload);
  await incrementCounter(quota.counter);
  return true;
}

export async function scheduleNotification(title, body, secondsFromNow = 0, options = {}) {
  if (!title || !body) return false;

  const permission = await requestNotificationPermission({
    prompt: options.promptForPermission !== false,
  });
  if (!permission.granted) return false;

  const quota = await canSendSmartNotification();
  if (!quota.allowed) return false;

  if (Platform.OS === 'web') {
    return sendSmartNotification(title, body, options);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: options.url ? { url: options.url } : undefined,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(secondsFromNow)),
    },
  });

  await incrementCounter(quota.counter);
  return true;
}
