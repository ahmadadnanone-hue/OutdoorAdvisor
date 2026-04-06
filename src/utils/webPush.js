import { fetchApiJson } from '../config/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready.then(() => registration);
}

export async function hasPushSubscription() {
  if (!isWebPushSupported()) return false;
  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  return Boolean(subscription);
}

export async function enableWebPush(preferences = {}) {
  if (!isWebPushSupported()) {
    throw new Error('Web push notifications are not supported in this browser.');
  }

  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('Public push key is missing from app configuration.');
  }

  const registration = await getServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission was not granted.');
    }
  } else if (Notification.permission !== 'granted') {
    throw new Error('Notification permission is blocked in this browser.');
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await fetchApiJson('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription,
      preferences,
    }),
  });

  return true;
}

export async function disableWebPush() {
  if (!isWebPushSupported()) return false;
  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await fetchApiJson('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });
    await subscription.unsubscribe();
  }

  return true;
}

export async function syncWebPushPreferences(preferences = {}) {
  if (!isWebPushSupported()) return false;
  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  await fetchApiJson('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription,
      preferences,
    }),
  });

  return true;
}

export async function sendWebPushTest(kind = 'severeAqi') {
  return fetchApiJson('/api/notifications/send-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  });
}
