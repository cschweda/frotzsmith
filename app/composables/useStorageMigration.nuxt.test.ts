/**
 * useStorageMigration tests — happy-dom env (needs localStorage).
 *
 * Verifies that migrateStorageKeys():
 *   1. Moves un-prefixed `frotzsmith:<key>` to `frotzsmith:i6:<key>`.
 *   2. Removes the old un-prefixed key after moving.
 *   3. Is idempotent — a second call leaves the namespaced key intact.
 *   4. Does not overwrite an already-migrated namespaced key.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { migrateStorageKeys } from './useStorageMigration'

describe('migrateStorageKeys', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates frotzsmith:scripts → frotzsmith:i6:scripts', () => {
    const oldKey = frotzsmith.storageKeys.scripts
    const newKey = buildStorageKey('i6', oldKey)
    localStorage.setItem(oldKey, '{"v":2,"buckets":{}}')

    migrateStorageKeys('i6')

    expect(localStorage.getItem(newKey)).toBe('{"v":2,"buckets":{}}')
    expect(localStorage.getItem(oldKey)).toBeNull()
  })

  it('migrates all frotzsmith:* keys', () => {
    const keys = Object.values(frotzsmith.storageKeys)
    for (const k of keys) localStorage.setItem(k, 'test-value')

    migrateStorageKeys('i6')

    for (const k of keys) {
      const newKey = buildStorageKey('i6', k)
      expect(localStorage.getItem(newKey)).toBe('test-value')
      expect(localStorage.getItem(k)).toBeNull()
    }
  })

  it('is idempotent — second call does not remove the namespaced key', () => {
    const oldKey = frotzsmith.storageKeys.scripts
    const newKey = buildStorageKey('i6', oldKey)
    localStorage.setItem(oldKey, 'data')

    migrateStorageKeys('i6') // first run — moves old → new
    migrateStorageKeys('i6') // second run — should be a no-op

    expect(localStorage.getItem(newKey)).toBe('data')
    expect(localStorage.getItem(oldKey)).toBeNull()
  })

  it('does not overwrite an already-present namespaced key', () => {
    const oldKey = frotzsmith.storageKeys.scripts
    const newKey = buildStorageKey('i6', oldKey)
    localStorage.setItem(newKey, 'already-migrated')
    localStorage.setItem(oldKey, 'stale-old-data')

    migrateStorageKeys('i6')

    // namespaced key must keep its original value
    expect(localStorage.getItem(newKey)).toBe('already-migrated')
    // old key is NOT removed because we didn't copy (the new key existed)
    expect(localStorage.getItem(oldKey)).toBe('stale-old-data')
  })

  it('is a no-op when there is nothing to migrate', () => {
    migrateStorageKeys('i6')
    // Nothing in localStorage — no errors, nothing written
    expect(localStorage.length).toBe(0)
  })
})
