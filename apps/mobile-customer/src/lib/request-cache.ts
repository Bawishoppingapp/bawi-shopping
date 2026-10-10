/** Bounded, memory-only read cache. Failures never replace the last good value.
 * Invalidating detaches in-flight reads so an old response cannot refill it. */
export function createRequestCache<T>(ttlMs: number, maxEntries = 40) {
  type Entry = { value?: T; updatedAt: number; pending?: Promise<T> };
  const entries = new Map<string, Entry>();
  return {
    clear() { entries.clear(); },
    peek(key: string): T | undefined { return entries.get(key)?.value; },
    get(key: string, load: () => Promise<T>, force = false): Promise<T> {
      let entry = entries.get(key);
      if (entry?.pending) return entry.pending;
      if (!force && entry?.value !== undefined && Date.now() - entry.updatedAt < ttlMs) {
        return Promise.resolve(entry.value);
      }
      if (!entry) {
        entry = { updatedAt: 0 };
        entries.set(key, entry);
        if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
      }
      const target = entry;
      target.pending = Promise.resolve().then(load).then((value) => {
        target.value = value;
        target.updatedAt = Date.now();
        return value;
      }).finally(() => { target.pending = undefined; });
      return target.pending;
    },
  };
}
