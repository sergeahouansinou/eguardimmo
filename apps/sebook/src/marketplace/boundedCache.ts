export interface BoundedCache<T> {
  read(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

interface Options {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

// performance.now() : Cache Components refuse Date.now() pendant un prérendu.
export function createBoundedCache<T>({ ttlMs, maxEntries, now = () => performance.now() }: Options): BoundedCache<T> {
  const entries = new Map<string, { value: T; expiresAt: number }>();

  function keep(key: string, entry: { value: T; expiresAt: number }): void {
    entries.delete(key);
    entries.set(key, entry);
    const oldest = entries.keys().next();
    if (entries.size > maxEntries && !oldest.done) entries.delete(oldest.value);
  }

  return {
    // Pas de partage d'une lecture en cours : le 429 d'un visiteur atteindrait ceux qui l'attendent.
    async read(key, load) {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) {
        keep(key, hit);
        return hit.value;
      }
      entries.delete(key);
      const value = await load();
      keep(key, { value, expiresAt: now() + ttlMs });
      return value;
    },
    clear: () => {
      entries.clear();
    },
  };
}
