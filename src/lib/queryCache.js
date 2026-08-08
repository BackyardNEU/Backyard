// A small keyed cache so navigating away from a page and back does not refetch what was
// just on screen.
//
// React Router unmounts a route's component on navigation, so anything fetched in an
// effect is fetched again on return — visiting a friend, going back, and returning
// re-requested the same profile every time.
//
// Same three ideas as clubPageCache and calendarCache, which predate this and keep their
// own domain-specific loaders: dedupe concurrent callers onto one promise, expire on a
// TTL, and expose a synchronous read so a component can seed its first render instead of
// painting an empty state it immediately replaces.

const cache = new Map();     // key -> { data, at }
const inflight = new Map();  // key -> Promise

const DEFAULT_TTL_MS = 60_000;

function isFresh(entry, ttl) {
  return entry && Date.now() - entry.at < ttl;
}

/**
 * Resolve `key`, running `loader` only if nothing fresh is cached.
 *
 * Rejections are not cached — a failed load should be retried on the next attempt rather
 * than remembered as a result.
 */
export function cachedFetch(key, loader, { ttl = DEFAULT_TTL_MS } = {}) {
  if (!key) return Promise.resolve(null);

  const entry = cache.get(key);
  if (isFresh(entry, ttl)) return Promise.resolve(entry.data);

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = loader()
    .then((data) => {
      cache.set(key, { data, at: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

/** Synchronous read, for seeding initial state. null when absent or stale. */
export function readCached(key, { ttl = DEFAULT_TTL_MS } = {}) {
  const entry = cache.get(key);
  return isFresh(entry, ttl) ? entry.data : null;
}

/**
 * Write a value straight into the cache, without a fetch.
 *
 * For "I just saved this, and I already know the new value" — invalidating instead would
 * make the next visit show a loading state for something the app is certain about.
 */
export function writeCached(key, data) {
  if (!key) return;
  cache.set(key, { data, at: Date.now() });
  inflight.delete(key);
}

export function invalidateKey(key) {
  cache.delete(key);
  inflight.delete(key);
}

/** Drop a family of keys, e.g. every `user:*` after blocking someone. */
export function invalidatePrefix(prefix) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

/** Everything. Called on sign-in and sign-out, where all of it is viewer-specific. */
export function invalidateAllQueries() {
  cache.clear();
  inflight.clear();
}
