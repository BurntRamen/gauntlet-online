// Browser privacy settings and full storage must not prevent menu access. Keep
// failed writes (including removals) authoritative until storage accepts them.
export function createBrowserStorage(resolveStorage = () => window.localStorage) {
  const memory = new Map();
  const pending = new Map();

  function flush(storage, key) {
    if (!pending.has(key)) return;
    const value = pending.get(key);
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    pending.delete(key);
  }

  return Object.freeze({
    getItem(key) {
      const name = String(key);
      try {
        const storage = resolveStorage();
        flush(storage, name);
        const value = storage.getItem(name);
        if (value === null) memory.delete(name);
        else memory.set(name, value);
        return value;
      } catch {
        return memory.get(name) ?? null;
      }
    },
    setItem(key, value) {
      const name = String(key);
      const text = String(value);
      memory.set(name, text);
      pending.set(name, text);
      try { flush(resolveStorage(), name); } catch { /* Session memory remains available. */ }
    },
    removeItem(key) {
      const name = String(key);
      memory.delete(name);
      pending.set(name, null);
      try { flush(resolveStorage(), name); } catch { /* Do not revive a stale saved session. */ }
    },
  });
}

export const browserStorage = createBrowserStorage();
export default browserStorage;
