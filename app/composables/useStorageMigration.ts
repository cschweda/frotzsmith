import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

/**
 * One-time migration: move each old un-prefixed `frotzsmith:<key>` to
 * `frotzsmith:<stateKey>:<key>` so existing data is preserved after the
 * per-language namespace change introduced in Task 4.
 *
 * Only copies when the new key is absent AND the old key exists.
 * Idempotent — running twice is a no-op.
 *
 * Called once on first client load from the `00.migrate-storage.client.ts`
 * plugin (before any component mounts, so reads see migrated keys). The old
 * un-prefixed keys are pre-namespacing Inform 6 data, so the caller passes
 * 'i6' — never the active profile's stateKey.
 */
export function migrateStorageKeys(stateKey: string): void {
  if (!import.meta.client) return
  try {
    for (const baseKey of Object.values(frotzsmith.storageKeys)) {
      const newKey = buildStorageKey(stateKey, baseKey)
      if (localStorage.getItem(newKey) === null) {
        const old = localStorage.getItem(baseKey)
        if (old !== null) {
          localStorage.setItem(newKey, old)
          localStorage.removeItem(baseKey)
        }
      }
    }
  } catch {
    // localStorage unavailable or quota exceeded — skip silently
  }
}
