import AsyncStorage from '@react-native-async-storage/async-storage';

const INBOX_KEY = 'outdooradvisor_notification_inbox_v1';
const MAX_ITEMS = 40;
const CONTENT_DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;
const ROUTINE_CATEGORIES = new Set(['smart', 'summary']);
const ROUTINE_TITLE_PATTERNS = [
  /^avoid the hot window$/i,
  /^shift movement indoors$/i,
  /^good window for easy movement$/i,
  /^short walk window$/i,
  /^easy finish if you want it$/i,
  /^tomorrow'?s outlook\b/i,
  /^pakistan morning brief\b/i,
];

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getContentKey(item) {
  return `${normalizeText(item?.title)}|${normalizeText(item?.body)}`;
}

function isRoutineInboxItem(item) {
  const category = normalizeText(item?.category);
  const source = normalizeText(item?.source);
  const title = String(item?.title || '').trim();

  if (ROUTINE_CATEGORIES.has(category)) return true;
  if (source === 'local-smart-advisor') return true;
  return ROUTINE_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function compactInboxItems(items) {
  const seenIds = new Set();
  const seenContent = new Map();
  const compacted = [];

  for (const item of items) {
    if (!item?.title && !item?.body) continue;
    if (isRoutineInboxItem(item)) continue;
    const idKey = item.dedupeKey || item.id;
    if (idKey && seenIds.has(idKey)) continue;

    const contentKey = getContentKey(item);
    const createdAt = Number(item.createdAt || Date.now());
    const previousAt = seenContent.get(contentKey);
    if (previousAt != null && Math.abs(previousAt - createdAt) < CONTENT_DEDUPE_WINDOW_MS) {
      continue;
    }

    if (idKey) seenIds.add(idKey);
    seenContent.set(contentKey, createdAt);
    compacted.push(item);
  }

  return compacted.slice(0, MAX_ITEMS);
}

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
    if (!Array.isArray(parsed)) return [];
    const compacted = compactInboxItems(parsed);
    if (compacted.length !== parsed.length) {
      await saveNotificationInbox(compacted);
    }
    return compacted;
  } catch {
    return [];
  }
}

export async function saveNotificationInbox(items) {
  await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(compactInboxItems(items)));
}

export async function appendInboxNotification(payload) {
  if (!payload?.title && !payload?.body) return loadNotificationInbox();
  if (isRoutineInboxItem(payload)) return loadNotificationInbox();
  const current = await loadNotificationInbox();
  const id = payload.id || payload.remoteId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dedupeKey = payload.dedupeKey || payload.remoteId || id;
  const contentKey = getContentKey(payload);
  const now = Date.now();
  if (current.some((item) =>
    item.dedupeKey === dedupeKey ||
    item.id === id ||
    (getContentKey(item) === contentKey && Math.abs(Number(item.createdAt || now) - now) < CONTENT_DEDUPE_WINDOW_MS)
  )) {
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
      createdAt: now,
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
