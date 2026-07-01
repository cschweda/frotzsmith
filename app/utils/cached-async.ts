/**
 * Lazily run `loader` once and cache the promise — but clear the cache when it
 * rejects, so a transient failure (e.g. a network blip fetching a WASM bundle
 * on first compile) doesn't permanently brick every later call for the session.
 */
export function cachedAsync<T>(loader: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null
  return () => {
    if (!cached) {
      cached = loader()
      // Side-branch handler: clears the cache without swallowing the rejection
      // for callers awaiting `cached` itself.
      cached.catch(() => {
        cached = null
      })
    }
    return cached
  }
}
