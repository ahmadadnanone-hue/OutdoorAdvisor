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

export async function kvSetJson(key, value) {
  await kvCommand(['SET', key, JSON.stringify(value)]);
}

export async function kvGetJson(key) {
  const value = await kvCommand(['GET', key]);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function kvDel(key) {
  return kvCommand(['DEL', key]);
}

export async function kvKeys(pattern) {
  return kvCommand(['KEYS', pattern]);
}
