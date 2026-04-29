import crypto from 'crypto';
import { kvDel, kvGetJson, kvKeys, kvSetJson } from './kv.js';

const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_CHUNK_SIZE = 100;

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
    premium: !!payload.premium,
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
  const records = await Promise.all(keys.map((key) => kvGetJson(key)));
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
    tickets.push(...(json.data || []));
  }

  await storeReceiptIds(tickets);

  return {
    attempted: messages.length,
    ticketCount: tickets.length,
    tickets,
  };
}

export async function checkStoredReceipts(limit = 300) {
  const keys = ((await kvKeys('push:receipt:*')) || []).slice(0, limit);
  if (!keys.length) return { checked: 0, ok: 0, errors: 0 };

  const records = (await Promise.all(keys.map((key) => kvGetJson(key)))).filter(Boolean);
  const ids = records.map((record) => record.id).filter(Boolean);
  if (!ids.length) return { checked: 0, ok: 0, errors: 0 };

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
  await Promise.all(keys.map(async (key) => {
    const id = key.replace('push:receipt:', '');
    const receipt = json.data?.[id];
    if (!receipt) return;
    await kvDel(key);
    if (receipt.status === 'ok') ok += 1;
    if (receipt.status === 'error') errors += 1;
  }));

  return { checked: ids.length, ok, errors };
}

async function storeReceiptIds(tickets) {
  const now = Date.now();
  const writes = tickets
    .filter((ticket) => ticket?.status === 'ok' && ticket.id)
    .map((ticket) => kvSetJson(getReceiptKey(ticket.id), { id: ticket.id, createdAt: now }));
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
