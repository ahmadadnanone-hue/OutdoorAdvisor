import crypto from 'crypto';
import { kvDel, kvGetJson, kvKeys, kvMGetJson, kvSetJson } from './kv.js';

const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_CHUNK_SIZE = 100;
// Expo only serves receipts for ~24h. Anything older will never resolve, so
// drop it instead of re-reading it every cron run; the TTL is a backstop.
const RECEIPT_STALE_MS = 24 * 60 * 60 * 1000;
const RECEIPT_TTL_SECONDS = 2 * 24 * 60 * 60;

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function isExpoPushToken(token) {
  return typeof token === 'string' && /^(ExpoPushToken|ExponentPushToken)\[[\w-]+\]$/.test(token);
}

export function getNativePushKey(token) {
  return `push:native:${hash(token)}`;
}

export function getReceiptKey(id) {
  return `push:receipt:${id}`;
}

export async function saveNativeDevice(payload) {
  const token = payload?.expoPushToken;
  if (!isExpoPushToken(token)) {
    throw new Error('A valid Expo push token is required.');
  }

  const key = getNativePushKey(token);
  const existing = await kvGetJson(key);
  const record = {
    expoPushToken: token,
    deviceId: payload.deviceId || existing?.deviceId || null,
    platform: payload.platform || existing?.platform || 'unknown',
    appVersion: payload.appVersion || existing?.appVersion || null,
    buildVersion: payload.buildVersion || existing?.buildVersion || null,
    timezone: payload.timezone || existing?.timezone || 'Asia/Karachi',
    location: normalizeLocation(payload.location || existing?.location),
    preferences: payload.preferences || existing?.preferences || {},
    thresholds: payload.thresholds || existing?.thresholds || {},
    motorwaySubscriptions: payload.motorwaySubscriptions || existing?.motorwaySubscriptions || {},
    premium: typeof payload.premium === 'boolean' ? payload.premium : !!existing?.premium,
    // "Mute alerts today" — non-critical pushes are skipped until this passes.
    muteUntil: 'muteUntil' in payload
      ? (Number(payload.muteUntil) || null)
      : existing?.muteUntil ?? null,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  await kvSetJson(key, record);
  return record;
}

export async function removeNativeDevice(token) {
  if (!token) return 0;
  return kvDel(getNativePushKey(token));
}

export async function listNativeDevices() {
  const keys = (await kvKeys('push:native:*')) || [];
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const records = await kvMGetJson(keys);
  return records.filter((record) => record && isExpoPushToken(record.expoPushToken));
}

export async function sendNativePush(records, payload) {
  const notificationId =
    payload.id ||
    payload.notificationId ||
    `${payload.source || 'outdooradvisor'}:${Date.now()}`;
  const messages = records
    .filter((record) => isExpoPushToken(record.expoPushToken))
    .map((record) => ({
      to: record.expoPushToken,
      sound: 'default',
      priority: payload.priority || 'high',
      title: payload.title,
      body: payload.body,
      // iOS: criticals break through Focus as time-sensitive; the category
      // identifier attaches the "Mute alerts today" action registered on-device.
      ...(payload.interruptionLevel ? { interruptionLevel: payload.interruptionLevel } : {}),
      ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
      data: {
        notificationId,
        category: payload.category || 'Alert',
        url: payload.url || null,
        source: payload.source || 'outdooradvisor',
        ...(payload.data || {}),
      },
    }));

  const chunks = [];
  for (let i = 0; i < messages.length; i += MAX_CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + MAX_CHUNK_SIZE));
  }

  const tickets = [];
  const ticketTokens = [];
  for (const chunk of chunks) {
    const response = await fetch(EXPO_PUSH_SEND_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    const json = await response.json();
    if (!response.ok || json.errors) {
      throw new Error(json.errors?.[0]?.message || `Expo push send failed (${response.status})`);
    }
    // Expo returns one ticket per message, in order — keep the token alongside
    // so receipt errors (DeviceNotRegistered) can unregister the dead device.
    const chunkTickets = json.data || [];
    tickets.push(...chunkTickets);
    chunkTickets.forEach((ticket, index) => {
      ticketTokens.push(chunk[index]?.to || null);
    });
  }

  await storeReceiptIds(tickets, ticketTokens);

  return {
    attempted: messages.length,
    ticketCount: tickets.length,
    tickets,
  };
}

export async function checkStoredReceipts(limit = 300) {
  const keys = ((await kvKeys('push:receipt:*')) || []).slice(0, limit);
  if (!keys.length) return { checked: 0, ok: 0, errors: 0 };

  const now = Date.now();
  const values = await kvMGetJson(keys);
  const records = [];
  const staleKeys = [];
  keys.forEach((key, index) => {
    const record = values[index];
    if (!record?.id || !(now - Number(record.createdAt) < RECEIPT_STALE_MS)) {
      staleKeys.push(key);
    } else {
      records.push(record);
    }
  });
  const ids = records.map((record) => record.id);
  if (!ids.length) {
    await kvDel(...staleKeys);
    return { checked: 0, ok: 0, errors: 0, expired: staleKeys.length };
  }

  const response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });
  const json = await response.json();
  if (!response.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || `Expo push receipt check failed (${response.status})`);
  }

  let ok = 0;
  let errors = 0;
  const doneKeys = [];
  const deadDeviceKeys = new Set();
  for (const record of records) {
    const receipt = json.data?.[record.id];
    if (!receipt) continue;
    doneKeys.push(getReceiptKey(record.id));
    if (receipt.status === 'ok') ok += 1;
    if (receipt.status === 'error') {
      errors += 1;
      // APNs says this token is permanently gone — drop the device record so
      // the engine stops fetching weather/AQI for it on every cron run.
      if (record.token && receipt.details?.error === 'DeviceNotRegistered') {
        deadDeviceKeys.add(getNativePushKey(record.token));
      }
    }
  }
  await kvDel(...staleKeys, ...doneKeys, ...deadDeviceKeys);

  return {
    checked: ids.length,
    ok,
    errors,
    removed: deadDeviceKeys.size,
    expired: staleKeys.length,
  };
}

async function storeReceiptIds(tickets, ticketTokens = []) {
  const now = Date.now();
  const writes = tickets
    .map((ticket, index) => ({ ticket, token: ticketTokens[index] || null }))
    .filter(({ ticket }) => ticket?.status === 'ok' && ticket.id)
    .map(({ ticket, token }) => kvSetJson(
      getReceiptKey(ticket.id),
      { id: ticket.id, token, createdAt: now },
      { ttlSeconds: RECEIPT_TTL_SECONDS },
    ));
  await Promise.all(writes);
}

function normalizeLocation(location) {
  if (!location || location.lat == null || location.lon == null) return null;
  const lat = Number(location.lat);
  const lon = Number(location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    city: location.city || 'Selected',
    region: location.region || location.address || '',
    source: location.source || 'unknown',
    updatedAt: location.updatedAt || Date.now(),
  };
}
