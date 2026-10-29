import test from 'node:test';
import assert from 'node:assert/strict';

process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 'token';

const { checkStoredReceipts, getNativePushKey, listNativeDevices } = await import('../api/_lib/nativePush.js');

const NOW = Date.now();
const TOKEN = 'ExponentPushToken[abc123]';

// In-memory Upstash REST stand-in that records every command it receives.
function installFakes(store, expoReceipts = {}) {
  const commands = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url.includes('getReceipts')) {
      const data = Object.fromEntries(body.ids.filter((id) => expoReceipts[id]).map((id) => [id, expoReceipts[id]]));
      return { ok: true, json: async () => ({ data }) };
    }
    commands.push(body);
    const [name, ...args] = body;
    let result = null;
    if (name === 'KEYS') {
      const prefix = args[0].replace('*', '');
      result = Object.keys(store).filter((key) => key.startsWith(prefix));
    } else if (name === 'MGET') {
      result = args.map((key) => store[key] ?? null);
    } else if (name === 'DEL') {
      args.forEach((key) => delete store[key]);
      result = args.length;
    }
    return { ok: true, json: async () => ({ result }) };
  };
  return commands;
}

function receipt(id, ageMs, token = TOKEN) {
  return JSON.stringify({ id, token, createdAt: NOW - ageMs });
}

test('device list is read with one MGET regardless of device count', async () => {
  const store = {};
  for (let i = 0; i < 25; i += 1) {
    store[`push:native:${i}`] = JSON.stringify({ expoPushToken: `ExponentPushToken[d${i}]` });
  }
  const commands = installFakes(store);
  const devices = await listNativeDevices();
  assert.equal(devices.length, 25);
  assert.deepEqual(commands.map((command) => command[0]), ['KEYS', 'MGET']);
});

test('receipts Expo no longer serves are deleted instead of re-read forever', async () => {
  const store = {
    'push:receipt:old1': receipt('old1', 3 * 24 * 60 * 60 * 1000),
    'push:receipt:old2': receipt('old2', 25 * 60 * 60 * 1000),
    'push:receipt:broken': 'not json',
    'push:receipt:fresh': receipt('fresh', 5 * 60 * 1000),
  };
  const commands = installFakes(store);
  const result = await checkStoredReceipts();
  assert.equal(result.expired, 3);
  assert.equal(result.checked, 1);
  assert.deepEqual(Object.keys(store), ['push:receipt:fresh']);
  assert.deepEqual(commands.map((command) => command[0]), ['KEYS', 'MGET', 'DEL']);
});

test('resolved receipts are cleared and dead devices removed in one DEL', async () => {
  const store = {
    'push:receipt:ok1': receipt('ok1', 60 * 60 * 1000),
    'push:receipt:gone': receipt('gone', 60 * 60 * 1000),
    [getNativePushKey(TOKEN)]: JSON.stringify({ expoPushToken: TOKEN }),
  };
  const commands = installFakes(store, {
    ok1: { status: 'ok' },
    gone: { status: 'error', details: { error: 'DeviceNotRegistered' } },
  });
  const result = await checkStoredReceipts();
  assert.deepEqual(
    { ok: result.ok, errors: result.errors, removed: result.removed },
    { ok: 1, errors: 1, removed: 1 },
  );
  assert.deepEqual(Object.keys(store), []);
  assert.equal(commands.filter((command) => command[0] === 'DEL').length, 1);
});
