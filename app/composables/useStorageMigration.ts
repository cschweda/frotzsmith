import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

/**
 * One-time migration: move each old un-prefixed `frotzsmith:<key>` to
 * `frotzsmith:<stateKey>:<key>` so existing data is preserved after the
 * per-language namespace change introduced in Task 4.
 *
 * Only copies when the new key is absent AND the old key exists.
 * Idempotent — running twice is a no-op.
 *
 * Call on first client load (inside useIde.restore()) with the active
 * profile's stateKey ('i6' for existing I6 projects).
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
