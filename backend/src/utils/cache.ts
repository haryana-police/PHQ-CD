// ── Shared in-memory cache for API responses (5 min TTL)
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (e && e.expiresAt > Date.now()) return e.data as T;
  cache.delete(key);
  return null;
}

export function setCached(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

export function getRequestCacheKey(route: string, query: any): string {
  const qs = Object.keys(query || {})
    .sort()
    .map(k => `${k}=${query[k]}`)
    .join('&');
  return `${route}?${qs}`;
}
