import { runAlertEngine } from './_lib/alertEngine.js';
import {
  checkStoredReceipts,
  listNativeDevices,
  removeNativeDevice,
  saveNativeDevice,
  sendNativePush,
} from './_lib/nativePush.js';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function getAction(req) {
  return String(req.query.action || '').trim().toLowerCase();
}

function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return req.headers['user-agent']?.includes('vercel-cron') || process.env.VERCEL_ENV !== 'production';
  }
  return req.headers.authorization === `Bearer ${secret}` || req.query.secret === secret;
}

function isTestAuthorized(req) {
  const secret = process.env.PUSH_TEST_SECRET || process.env.CRON_SECRET;
  if (!secret) return process.env.VERCEL_ENV !== 'production';
  return req.headers.authorization === `Bearer ${secret}` || req.query.secret === secret;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = getAction(req);

  try {
    if (action === 'register') return handleRegister(req, res);
    if (action === 'unregister') return handleUnregister(req, res);
    if (action === 'test') return handleTest(req, res);
    if (action === 'cron') return handleCron(req, res);
    return sendJson(res, 400, { error: 'Valid action query parameter is required.' });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Push request failed.',
    });
  }
}

async function handleRegister(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
  const body = parseBody(req);
  try {
    const record = await saveNativeDevice(body);
    return sendJson(res, 200, { success: true, updatedAt: record.updatedAt });
  } catch (error) {
    return sendJson(res, 400, {
      success: false,
      error: error.message || 'Could not register push token.',
    });
  }
}

async function handleUnregister(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  const body = parseBody(req);
  await removeNativeDevice(body.expoPushToken);
  return sendJson(res, 200, { success: true });
}

async function handleTest(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
  if (!isTestAuthorized(req)) return sendJson(res, 401, { error: 'Unauthorized.' });

  const body = parseBody(req);
  const devices = await listNativeDevices();
  const response = await sendNativePush(devices, {
    title: body.title || 'OutdoorAdvisor test alert',
    body: body.body || 'Native push is connected. Alerts can arrive even when the app is closed.',
    category: 'Test',
    source: 'manual-test',
    url: 'https://outdooradvisor.app',
    data: { test: true },
  });
  return sendJson(res, 200, { success: true, devices: devices.length, ...response });
}

async function handleCron(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  if (!isCronAuthorized(req)) return sendJson(res, 401, { error: 'Unauthorized.' });

  const [alertResult, receiptResult] = await Promise.all([
    runAlertEngine({ mode: req.query.mode || 'scheduled' }),
    checkStoredReceipts(),
  ]);
  return sendJson(res, 200, {
    success: true,
    alerts: alertResult,
    receipts: receiptResult,
  });
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}
