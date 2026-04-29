import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { appendInboxNotification } from '../utils/notificationInbox';

function notificationToInboxPayload(notification, eventType = 'received') {
  const content = notification?.request?.content || {};
  const data = content.data || {};
  const remoteId =
    data.notificationId ||
    data.alertKey ||
    data.day ||
    notification?.request?.identifier ||
    null;

  return {
    id: remoteId ? `push-${remoteId}` : undefined,
    dedupeKey: remoteId ? `push-${remoteId}` : undefined,
    remoteId,
    title: content.title || data.title || 'OutdoorAdvisor alert',
    body: content.body || data.body || '',
    category: data.category || 'Alert',
    source: data.source || eventType,
    url: data.url || null,
  };
}

async function persistNotification(notification, eventType) {
  const payload = notificationToInboxPayload(notification, eventType);
  if (!payload.title && !payload.body) return null;
  return appendInboxNotification(payload);
}

export async function syncLastNotificationResponseToInbox() {
  if (Platform.OS === 'web') return null;
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response?.notification) return null;
  return persistNotification(response.notification, 'tap');
}

export function startNativeNotificationInboxSync() {
  if (Platform.OS === 'web') return () => {};

  syncLastNotificationResponseToInbox().catch(() => {});

  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    persistNotification(notification, 'received').catch(() => {});
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    persistNotification(response.notification, 'tap').catch(() => {});
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
