const CRON_URL = 'https://outdooradvisor.app/api/push?action=cron&mode=cloudflare';

async function triggerAlertEngine(env) {
  if (!env.CRON_SECRET) throw new Error('CRON_SECRET is not configured.');

  const response = await fetch(CRON_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      'User-Agent': 'OutdoorAdvisor-Cloudflare-Cron/1.0',
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Alert engine returned ${response.status}: ${body.slice(0, 300)}`);
  }

  console.log(JSON.stringify({
    event: 'notification-cron-complete',
    status: response.status,
    body: body.slice(0, 1000),
  }));
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(triggerAlertEngine(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/health') return new Response('Not found', { status: 404 });
    return Response.json({
      ok: true,
      service: 'outdooradvisor-notification-cron',
      secretConfigured: Boolean(env.CRON_SECRET),
    });
  },
};
