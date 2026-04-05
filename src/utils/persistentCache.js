// Tiny TTL cache backed by localStorage on web (survives page reloads).
// Falls back to in-memory only on native. All access is synchronous.
//
// Namespaces partition keys so different callers don't collide:
//   get('aqi', '31.520_74.359', 15*60*1000)
//   set('aqi', '31.520_74.359', data)

const memory = {};
const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function fullKey(namespace, key) {
  return `oa_cache::${namespace}::${key}`;
}

export function get(namespace, key, ttlMs) {
  const full = fullKey(namespace, key);

  // 1. In-memory (fastest)
  const mem = memory[full];
  if (mem && Date.now() - mem.timestamp < ttlMs) return mem.data;

  // 2. localStorage fallback (survives reloads)
  if (isWeb) {
    try {
      const raw = window.localStorage.getItem(full);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.timestamp === 'number') {
          if (Date.now() - parsed.timestamp < ttlMs) {
            memory[full] = parsed; // promote into memory for future reads
            return parsed.data;
          }
          // Expired — clean it up
          window.localStorage.removeItem(full);
        }
      }
    } catch {
      /* ignore quota/parse errors */
    }
  }

  return null;
}

export function set(namespace, key, data) {
  const full = fullKey(namespace, key);
  const entry = { data, timestamp: Date.now() };
  memory[full] = entry;
  if (isWeb) {
    try {
      window.localStorage.setItem(full, JSON.stringify(entry));
    } catch {
      // Quota exceeded — drop silently, in-memory still works
    }
  }
}

export function clear(namespace) {
  // Wipe all keys in a namespace (useful for manual "clear cache" action).
  const prefix = `oa_cache::${namespace}::`;
  for (const k of Object.keys(memory)) {
    if (k.startsWith(prefix)) delete memory[k];
  }
  if (isWeb) {
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) window.localStorage.removeItem(k);
      }
    } catch {}
  }
}
