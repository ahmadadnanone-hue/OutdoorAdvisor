import { ensurePushEnv, saveSubscription } from '../_lib/push.js';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    ensurePushEnv();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { subscription, preferences } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return sendJson(res, 400, { error: 'A valid push subscription is required.' });
    }

    const record = await saveSubscription({ subscription, preferences });
    return sendJson(res, 200, {
      success: true,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Could not save subscription.' });
  }
}
