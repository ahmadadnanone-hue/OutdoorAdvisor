const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

function ensureKvEnv() {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    throw new Error('KV environment variables are missing.');
  }
}

export async function kvCommand(command) {
  ensureKvEnv();

  const response = await fetch(KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  const json = await response.json();

  if (!response.ok || json.error) {
    throw new Error(json.error || `KV command failed (${response.status})`);
  }

  return json.result;
}

export async function kvSetJson(key, value, { ttlSeconds } = {}) {
  const command = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds) command.push('EX', String(ttlSeconds));
  await kvCommand(command);
}

function parseJson(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function kvGetJson(key) {
  return parseJson(await kvCommand(['GET', key]));
}

// One MGET instead of N GETs — Upstash bills per command, so reading every
// device/receipt record individually on each cron run burns the quota.
export async function kvMGetJson(keys) {
  if (!keys?.length) return [];
  const values = (await kvCommand(['MGET', ...keys])) || [];
  return keys.map((_, index) => parseJson(values[index]));
}

export async function kvDel(...keys) {
  if (!keys.length) return 0;
  return kvCommand(['DEL', ...keys]);
}

export async function kvKeys(pattern) {
  return kvCommand(['KEYS', pattern]);
}
