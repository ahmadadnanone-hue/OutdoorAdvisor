import crypto from 'crypto';
import webpush from 'web-push';
import { kvDel, kvGetJson, kvKeys, kvSetJson } from './kv.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@outdooradvisor.app';

export function ensurePushEnv() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys are missing in Vercel environment variables.');
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getSubscriptionKey(endpoint) {
  return `push:sub:${crypto.createHash('sha256').update(endpoint).digest('hex')}`;
}

export async function saveSubscription({ subscription, preferences = {} }) {
  const key = getSubscriptionKey(subscription.endpoint);
  const existing = await kvGetJson(key);
  const record = {
    subscription,
    preferences,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  await kvSetJson(key, record);
  return record;
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return 0;
  return kvDel(getSubscriptionKey(endpoint));
}

export async function listSubscriptions() {
  const keys = (await kvKeys('push:sub:*')) || [];
  if (!Array.isArray(keys) || keys.length === 0) return [];

  const records = await Promise.all(keys.map((key) => kvGetJson(key)));
  return records.filter(Boolean);
}

export async function sendPushToRecord(record, payload) {
  try {
    await webpush.sendNotification(record.subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await removeSubscription(record.subscription?.endpoint);
    }
    return { ok: false, error: error.message || 'Push send failed' };
  }
}
