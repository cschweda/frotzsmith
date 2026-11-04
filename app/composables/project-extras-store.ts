/**
 * What an opened `.frotzsmith` project carries that the IDE has no place to
 * show — files it doesn't recognise, unknown manifest fields, the creation
 * date, where the Skein sat, per-test manifest fields, the main file's name and
 * extension names it doesn't know — kept per game so the next Download writes
 * them back (spec §1.1: never lose anything). Mirrors `skein-store.ts`:
 * IndexedDB (bytes go in as Uint8Array via structured clone) with an in-memory
 * fallback for node/SSR/no-IDB.
 *
 * Contract: `save` NEVER rejects — it resolves false on any failure so the
 * caller can cue the storage notice; `load` resolves null on missing/broken.
 */
export interface ProjectExtras {
  /** Unrecognised package files, kept byte-for-byte. */
  entries: { path: string; bytes: Uint8Array }[]
  /** Unknown manifest fields. */
  manifestExtra: Record<string, unknown>
  created?: string
  /** The Skein's package path when not `<main stem>.skein`. */
  skeinPath?: string
  /** The package's main file name (e.g. `haunted.inf`). */
  main?: string
  /** Unknown fields of manifest `tests[]` entries, by test name, in order. */
  testExtras: { name: string; extra: Record<string, unknown> }[]
  /** The manifest `extensions` list as opened, and the names in it that match
   *  no extension here (kept, in place, on the next Download). */
  extensions?: { order: string[]; unknown: string[] }
  /** The package had no test scripts (the IDE's seed script is dropped on Download). */
  noTests?: boolean
}

export interface ExtrasStore {
  load(key: string): Promise<ProjectExtras | null>
  save(key: string, extras: ProjectExtras): Promise<boolean>
}

/** Plain, unshared data: no reactive proxies, no aliasing of the caller's bytes. */
function plain(x: ProjectExtras): ProjectExtras {
  return structuredClone({
    ...x,
    entries: x.entries.map(e => ({ path: e.path, bytes: new Uint8Array(e.bytes) })),
  })
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A stored value of the right shape, or null (storage is not trusted blindly). */
function checked(v: unknown): ProjectExtras | null {
  if (!isRecord(v) || !Array.isArray(v.entries) || !isRecord(v.manifestExtra)) return null
  if (!v.entries.every(e => isRecord(e) && typeof e.path === 'string' && e.bytes instanceof Uint8Array)) return null
  const x = v as unknown as ProjectExtras
  return { ...x, testExtras: Array.isArray(x.testExtras) ? x.testExtras : [] }
}

export function createMemoryExtrasStore(): ExtrasStore {
  const map = new Map<string, ProjectExtras>()
  return {
    load: async key => {
      const x = map.get(key)
      return x ? plain(x) : null
    },
    save: async (key, extras) => {
      try {
        map.set(key, plain(extras))
        return true
      } catch {
        return false
      }
    },
  }
}

const DB_NAME = 'frotzsmith-extras'
const STORE = 'opaque'

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

export function createIdbExtrasStore(): ExtrasStore {
  return {
    async load(key) {
      try {
        const db = await openDb()
        try {
          const v = await new Promise<unknown>((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error ?? new Error('get failed'))
          })
          return checked(v)
        } finally {
          db.close()
        }
      } catch {
        return null
      }
    },
    async save(key, extras) {
      try {
        const value = plain(extras)
        const db = await openDb()
        try {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            tx.objectStore(STORE).put(value, key)
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

/** One memory store per session, so the fallback still survives game switches. */
let _memory: ExtrasStore | null = null

/** IDB when the environment has it; memory otherwise (node/SSR/tests). */
export function getExtrasStore(): ExtrasStore {
  if (typeof indexedDB !== 'undefined' && indexedDB) return createIdbExtrasStore()
  return (_memory ??= createMemoryExtrasStore())
}
