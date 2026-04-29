import AsyncStorage from '@react-native-async-storage/async-storage';

const INBOX_KEY = 'outdooradvisor_notification_inbox_v1';
const MAX_ITEMS = 40;

function inferCategory(payload) {
  const title = String(payload?.title || '').toLowerCase();
  if (title.includes('aqi') || title.includes('smog') || title.includes('pollen')) return 'Air';
  if (title.includes('rain') || title.includes('storm') || title.includes('wind') || title.includes('heat') || title.includes('fog')) return 'Weather';
  if (title.includes('route') || title.includes('closure') || title.includes('motorway')) return 'Travel';
  return 'General';
}

export async function loadNotificationInbox() {
  try {
    const raw = await AsyncStorage.getItem(INBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveNotificationInbox(items) {
  await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export async function appendInboxNotification(payload) {
  if (!payload?.title && !payload?.body) return loadNotificationInbox();
  const current = await loadNotificationInbox();
  const id = payload.id || payload.remoteId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dedupeKey = payload.dedupeKey || payload.remoteId || id;
  if (current.some((item) => item.dedupeKey === dedupeKey || item.id === id)) {
    return current;
  }
  const next = [
    {
      id,
      dedupeKey,
      title: payload.title,
      body: payload.body,
      url: payload.url || null,
      category: payload.category || inferCategory(payload),
      source: payload.source || null,
      createdAt: Date.now(),
      seen: false,
    },
    ...current,
  ];
  await saveNotificationInbox(next);
  return next;
}

export async function markInboxSeen(ids = null) {
  const current = await loadNotificationInbox();
  const set = ids ? new Set(ids) : null;
  const next = current.map((item) => ({
    ...item,
    seen: set ? (set.has(item.id) ? true : item.seen) : true,
  }));
  await saveNotificationInbox(next);
  return next;
}
