import { ensurePushEnv, listSubscriptions, sendPushToRecord } from '../_lib/push.js';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

const TEST_PAYLOADS = {
  severeAqi: {
    title: 'OutdoorAdvisor · Severe AQI Warning',
    body: 'Air quality has reached an unhealthy level. Consider moving outdoor plans indoors.',
    tag: 'oa-severe-aqi',
    url: 'https://outdooradvisor.vercel.app',
  },
  travelClosure: {
    title: 'OutdoorAdvisor · Route Alert',
    body: 'An important travel advisory was detected. Check the Travel tab before heading out.',
    tag: 'oa-route-alert',
    url: 'https://outdooradvisor.vercel.app',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    ensurePushEnv();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const kind = body?.kind === 'travelClosure' ? 'travelClosure' : 'severeAqi';
    const payload = TEST_PAYLOADS[kind];

    const subscriptions = await listSubscriptions();
    if (!subscriptions.length) {
      return sendJson(res, 200, {
        success: false,
        sent: 0,
        message: 'No devices are subscribed to browser push yet.',
      });
    }

    const results = await Promise.all(subscriptions.map((record) => sendPushToRecord(record, payload)));
    const sent = results.filter((result) => result.ok).length;

    return sendJson(res, 200, {
      success: true,
      attempted: results.length,
      sent,
      kind,
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Could not send test push.' });
  }
}
