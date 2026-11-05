/**
 * Pure, framework-free logic for test scripts (mirrors project-files.ts). The
 * `useTestScripts` composable wraps these with reactive state + localStorage.
 */
export interface TestScript {
  id: string
  name: string
  text: string
}

export interface Bucket {
  scripts: TestScript[]
  activeId: string
}

/** Story key → that game's scripts. Always a NULL-PROTOTYPE object read with
 *  bucketOf: a game titled "Constructor" (key `constructor`) or a stored key
 *  like `toString` / `__proto__` must never hit Object.prototype (audit F7). */
export type Buckets = Record<string, Bucket>

export interface PersistedV2 {
  v: 2
  buckets: Buckets
}

export function emptyBuckets(): Buckets {
  return Object.create(null) as Buckets
}

/** The bucket stored under `key` — an own entry only, never an inherited
 *  member. Read through the property descriptor, not `buckets[key]`: Vue's
 *  reactive proxy answers a `hasOwnProperty` key with its own function. */
export function bucketOf(buckets: Buckets, key: string): Bucket | undefined {
  return Object.getOwnPropertyDescriptor(buckets, key)?.value as Bucket | undefined
}

/** A new prototype-free map: `buckets` with `key` set to `bucket`. */
export function withBucket(buckets: Buckets, key: string, bucket: Bucket): Buckets {
  const out = emptyBuckets()
  for (const k of Object.keys(buckets)) out[k] = buckets[k]!
  out[key] = bucket // on a null-prototype object even `__proto__` is an own key
  return out
}

function isBucket(v: unknown): v is { scripts: TestScript[]; activeId?: unknown } {
  return typeof v === 'object' && v !== null && Array.isArray((v as { scripts?: unknown }).scripts)
}

/**
 * Migrate a raw parsed localStorage value to the v2 bucketed shape.
 *  - v2 passthrough: returned as-is.
 *  - Old flat v1 shape (data.scripts is an array, data.v absent): converted to v2
 *    under `currentKey` so existing scripts are preserved for the current game.
 *  - Corrupt / unrecognised input: returns an empty v2 store.
 */
export function migrateScriptStore(raw: unknown, currentKey: string): PersistedV2 {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { v: 2, buckets: emptyBuckets() }
  }
  const data = raw as Record<string, unknown>

  // Already v2 — copied into a prototype-free map, own entries only, dropping
  // anything that isn't bucket-shaped.
  if (
    data.v === 2 &&
    data.buckets !== null &&
    typeof data.buckets === 'object' &&
    !Array.isArray(data.buckets)
  ) {
    const raw = data.buckets as Record<string, unknown>
    let buckets = emptyBuckets()
    for (const key of Object.keys(raw)) {
      const b = raw[key]
      if (isBucket(b)) buckets = withBucket(buckets, key, { scripts: b.scripts, activeId: typeof b.activeId === 'string' ? b.activeId : '' })
    }
    return { v: 2, buckets }
  }

  // Old flat v1 shape (data.scripts is an array and data.v is absent)
  if (Array.isArray(data.scripts)) {
    return {
      v: 2,
      buckets: withBucket(emptyBuckets(), currentKey, {
        scripts: data.scripts as TestScript[],
        activeId: typeof data.activeId === 'string' ? data.activeId : '',
      }),
    }
  }

  // Corrupt / unrecognised
  return { v: 2, buckets: emptyBuckets() }
}

export function upsertScript(list: TestScript[], script: TestScript): TestScript[] {
  const i = list.findIndex(s => s.id === script.id)
  if (i === -1) return [...list, script]
  const copy = list.slice()
  copy[i] = script
  return copy
}

export function renameScript(list: TestScript[], id: string, name: string): TestScript[] {
  return list.map(s => (s.id === id ? { ...s, name } : s))
}

export function deleteScript(list: TestScript[], id: string): TestScript[] {
  return list.filter(s => s.id !== id)
}

export function setScriptText(list: TestScript[], id: string, text: string): TestScript[] {
  return list.map(s => (s.id === id ? { ...s, text } : s))
}

/** Keep a still-valid active id; else the first script; else ''. */
export function nextActiveId(list: TestScript[], currentActive: string): string {
  if (list.some(s => s.id === currentActive)) return currentActive
  return list[0]?.id ?? ''
}
