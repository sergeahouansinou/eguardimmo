export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  maxKeys: number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  check: (key: string, now: number) => RateLimitResult;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ limit, windowMs, maxKeys }: RateLimitOptions): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function purge(now: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next();
      if (oldest.done) break;
      buckets.delete(oldest.value);
    }
  }

  return {
    check(key, now) {
      const bucket = buckets.get(key);
      if (bucket && bucket.resetAt > now) {
        if (bucket.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
        bucket.count += 1;
        return { allowed: true };
      }
      if (buckets.size >= maxKeys) purge(now);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    },
  };
}

const UNKNOWN_CLIENT = "inconnu";

// Le dernier élément de X-Forwarded-For est celui ajouté par le proxy de confiance ; le client ne contrôle pas les précédents.
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const candidate = forwarded && forwarded !== "" ? forwarded : headers.get("x-real-ip")?.trim();
  return candidate && candidate !== "" ? candidate.slice(0, 64) : UNKNOWN_CLIENT;
}
