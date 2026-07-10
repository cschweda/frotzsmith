/**
 * skein-store — persistence seam (node env).
 *
 * The Skein persists to IndexedDB (blessed outputs × nodes is exactly what
 * outgrows the localStorage quota this project fences), behind a SkeinStore
 * seam with an in-memory impl for tests/SSR. IDB is exercised via
 * fake-indexeddb; save() never throws — it resolves false so callers can cue
 * the storage notice.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createMemorySkeinStore, createIdbSkeinStore, getSkeinStore } from './skein-store'
import { createTree, addPath } from './skein-tree'

afterEach(() => vi.unstubAllGlobals())

function sampleTree() {
  return addPath(createTree(), ['north', 'take lamp']).tree
}

describe('memory store', () => {
  it('round-trips a tree and returns null for a missing key', async () => {
    const store = createMemorySkeinStore()
    expect(await store.load('i6:zork')).toBeNull()
    const tree = sampleTree()
    expect(await store.save('i6:zork', tree)).toBe(true)
    expect(await store.load('i6:zork')).toEqual(tree)
  })
})

describe('IndexedDB store (fake-indexeddb)', () => {
  it('round-trips a tree across store instances (real persistence)', async () => {
    const tree = sampleTree()
    expect(await createIdbSkeinStore().save('i6:cloak', tree)).toBe(true)
    // A fresh instance must read what the first wrote.
    expect(await createIdbSkeinStore().load('i6:cloak')).toEqual(tree)
  })

  it('save resolves false (never throws) when indexedDB is broken', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('storage denied')
      },
    })
    const store = createIdbSkeinStore()
    await expect(store.save('k', sampleTree())).resolves.toBe(false)
    await expect(store.load('k')).resolves.toBeNull()
  })
})

describe('getSkeinStore', () => {
  it('falls back to memory when indexedDB is absent', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const store = getSkeinStore()
    expect(await store.save('k', sampleTree())).toBe(true)
    expect(await store.load('k')).not.toBeNull()
  })
})
