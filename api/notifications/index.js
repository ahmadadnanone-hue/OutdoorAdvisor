/**
 * /api/notifications  — unified push subscription endpoint
 *
 * POST   → subscribe   (save / update a push subscription)
 * DELETE → unsubscribe (remove a push subscription by endpoint)
 */

import { ensurePushEnv, saveSubscription, removeSubscription } from '../_lib/push.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

  /* ── POST: subscribe ────────────────────────────────────────── */
  if (req.method === 'POST') {
    try {
      ensurePushEnv();
      const { subscription, preferences } = body;

      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return sendJson(res, 400, { error: 'A valid push subscription is required.' });
      }

      const record = await saveSubscription({ subscription, preferences });
      return sendJson(res, 200, { success: true, updatedAt: record.updatedAt });
    } catch (error) {
      return sendJson(res, 500, { error: error.message || 'Could not save subscription.' });
    }
  }

  /* ── DELETE: unsubscribe ────────────────────────────────────── */
  if (req.method === 'DELETE') {
    try {
      const endpoint = body?.endpoint;
      if (!endpoint) {
        return sendJson(res, 400, { error: 'Subscription endpoint is required.' });
      }

      await removeSubscription(endpoint);
      return sendJson(res, 200, { success: true });
    } catch (error) {
      return sendJson(res, 500, { error: error.message || 'Could not remove subscription.' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed.' });
}
