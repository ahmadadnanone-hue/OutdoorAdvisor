import { removeSubscription } from '../_lib/push.js';

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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
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
