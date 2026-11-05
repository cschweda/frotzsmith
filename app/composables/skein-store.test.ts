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

// F3: a tree saved before the fix (or written by anything else) is checked
// and rebuilt again on every restore.
describe('restores are sanitized (F3)', () => {
  const poisoned = (bad: string) => ({ root: 'r', nodes: {
    r: { id: 'r', command: '', parentId: null, childIds: [bad], status: 'unblessed' },
    [bad]: { id: bad, command: 'look', parentId: 'r', childIds: [], status: 'unblessed' },
  } })

  async function putRaw(key: string, value: unknown) {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('frotzsmith', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('skeins')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('skeins', 'readwrite')
      tx.objectStore('skeins').put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }

  it('IndexedDB: a tree with a Vue-reserved node id loads as null', async () => {
    await putRaw('i6:poison', poisoned('__v_isReactive'))
    expect(await createIdbSkeinStore().load('i6:poison')).toBeNull()
  })

  it('IndexedDB: unknown node fields are dropped on load', async () => {
    const t = { root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [], status: 'unblessed', __v_isRef: true, value: 1 } } }
    await putRaw('i6:extra', t)
    expect(await createIdbSkeinStore().load('i6:extra')).toEqual({ root: 'r', nodes: { r: { id: 'r', command: '', parentId: null, childIds: [], status: 'unblessed' } } })
  })

  it('memory store: a poisoned tree loads as null', async () => {
    const store = createMemorySkeinStore()
    await store.save('k', poisoned('__v_skip') as never)
    expect(await store.load('k')).toBeNull()
  })
})
