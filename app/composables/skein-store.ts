import type { SkeinTree } from './skein-tree'

/**
 * Skein persistence seam. The real store is IndexedDB — blessed outputs ×
 * nodes is exactly the payload that outgrows the 5-10 MB localStorage origin
 * quota this project fences elsewhere — with an in-memory impl for tests and
 * environments without IDB (node/SSR).
 *
 * Contract: `save` NEVER rejects — it resolves false on any failure so the
 * caller can cue the storage notice; `load` resolves null on missing/broken.
 * The `.skein` JSON export (useSkein) remains the canonical backup, mirroring
 * the ".inf is canonical, browser storage is a swap file" doctrine (D10).
 */
export interface SkeinStore {
  load(key: string): Promise<SkeinTree | null>
  save(key: string, tree: SkeinTree): Promise<boolean>
}

export function createMemorySkeinStore(): SkeinStore {
  const map = new Map<string, string>()
  return {
    load: async key => {
      const raw = map.get(key)
      return raw ? (JSON.parse(raw) as SkeinTree) : null
    },
    save: async (key, tree) => {
      map.set(key, JSON.stringify(tree))
      return true
    },
  }
}

const DB_NAME = 'frotzsmith'
const STORE = 'skeins'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'))
  })
}

/** One transaction, one op — the tree is a single value per game key. */
export function createIdbSkeinStore(): SkeinStore {
  return {
    async load(key) {
      try {
        const db = await openDb()
        try {
          return await new Promise<SkeinTree | null>((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
            req.onsuccess = () => resolve((req.result as SkeinTree | undefined) ?? null)
            req.onerror = () => reject(req.error ?? new Error('get failed'))
          })
        } finally {
          db.close()
        }
      } catch {
        return null
      }
    },
    async save(key, tree) {
      try {
        const db = await openDb()
        try {
          // Structured clone chokes on reactive proxies — persist plain data.
          const plain = JSON.parse(JSON.stringify(tree)) as SkeinTree
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            tx.objectStore(STORE).put(plain, key)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error ?? new Error('put failed'))
            tx.onabort = () => reject(tx.error ?? new Error('tx aborted'))
          })
          return true
        } finally {
          db.close()
        }
      } catch {
        return false
      }
    },
  }
}

/** IDB when the environment has it; memory otherwise (node/SSR/tests). */
export function getSkeinStore(): SkeinStore {
  return typeof indexedDB !== 'undefined' && indexedDB ? createIdbSkeinStore() : createMemorySkeinStore()
}
