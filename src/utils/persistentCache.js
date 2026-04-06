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
  const entry = getEntry(namespace, key);
  if (entry && Date.now() - entry.timestamp < ttlMs) return entry.data;
  if (entry) {
    const full = fullKey(namespace, key);
    delete memory[full];
    if (isWeb) {
      try {
        window.localStorage.removeItem(full);
      } catch {}
    }
  }
  return null;
}

export function getEntry(namespace, key) {
  const full = fullKey(namespace, key);

  // 1. In-memory (fastest)
  const mem = memory[full];
  if (mem && typeof mem.timestamp === 'number') return mem;

  // 2. localStorage fallback (survives reloads)
  if (isWeb) {
    try {
      const raw = window.localStorage.getItem(full);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.timestamp === 'number') {
          memory[full] = parsed; // promote into memory for future reads
          return parsed;
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
