import { toRaw } from 'vue'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeGetItem, safeRemoveItem, safeSetItem } from '~/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { planSolution } from '~/composables/solution-text'

type Plan = { ok: true } | { ok: false; message: string }
type Bucket = { text: string }
/** Story key → solution. NULL-PROTOTYPE, read with Object.hasOwn only (audit F7). */
type Buckets = Record<string, Bucket>

const emptyBuckets = (): Buckets => Object.create(null) as Buckets

// Module-level debounce shared by every caller (as useZilProjectFiles).
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingWrite: (() => void) | null = null

function cancelPendingSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  pendingWrite = null
}

function ownText(buckets: Buckets, key: string): string | null {
  return Object.hasOwn(buckets, key) ? toRaw(buckets)[key]!.text : null
}

/**
 * Each game's solution text, one per story key, per language. The active game
 * is `activeStoryKey` (read directly, as useTestScripts does, to avoid
 * a useIde cycle). Storage failures never throw: the text stays in memory and
 * the author gets the storage-full cue (once per session).
 */
export function useSolutions() {
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')
  const { profile } = useLanguage()
  const buckets = useState<Buckets>('frotz:solution-buckets', () => emptyBuckets())
  /** The language the in-memory buckets belong to. */
  const bucketsLang = useState<string>('frotz:solution-lang', () => profile.value.stateKey)

  const storageKey = () => buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.solutions)

  const text = computed<string | null>(() => ownText(buckets.value, activeStoryKey.value))
  const has = computed(() => text.value !== null)

  function otherTotal(key: string): number {
    const raw = toRaw(buckets.value)
    let n = 0
    for (const k of Object.keys(raw)) if (k !== key) n += raw[k]!.text.length
    return n
  }

  function withText(key: string, value: string | null): Buckets {
    const raw = toRaw(buckets.value)
    const out = emptyBuckets()
    for (const k of Object.keys(raw)) if (k !== key) out[k] = raw[k]!
    if (value !== null) out[key] = { text: value } // own key even for `__proto__`
    return out
  }

  function persist() {
    cancelPendingSave()
    if (!import.meta.client) return
    const raw = toRaw(buckets.value)
    if (Object.keys(raw).length === 0) {
      safeRemoveItem(storageKey())
      return
    }
    if (!safeSetItem(storageKey(), JSON.stringify({ v: 1, buckets: raw }))) notifyStorageFull()
  }

  function flushPendingSave() {
    const write = pendingWrite
    cancelPendingSave()
    write?.()
  }

  /** Load the stored record for the active language. Corrupt data is dropped. */
  function restore() {
    if (!import.meta.client) return
    flushPendingSave()
    const lang = profile.value.stateKey
    const raw = safeGetItem(storageKey())
    if (raw === null) {
      // Nothing stored: keep this language's in-memory state (a refused write
      // leaves no record); another language's state must not leak across.
      if (bucketsLang.value !== lang) buckets.value = emptyBuckets()
      bucketsLang.value = lang
      return
    }
    let loaded = emptyBuckets()
    try {
      const d = JSON.parse(raw) as { v?: unknown; buckets?: unknown }
      if (d && d.v === 1 && d.buckets && typeof d.buckets === 'object' && !Array.isArray(d.buckets)) {
        const src = d.buckets as Record<string, unknown>
        for (const k of Object.keys(src)) {
          const b = src[k] as { text?: unknown } | null
          if (b && typeof b.text === 'string' && b.text.length <= 1024 * 1024) loaded[k] = { text: b.text }
        }
      }
    } catch {
      loaded = emptyBuckets()
    }
    buckets.value = loaded
    bucketsLang.value = lang
  }

  /** Save the active game's solution; one over a cap changes nothing. */
  function set(next: string): Plan {
    const key = activeStoryKey.value
    const plan = planSolution(next, otherTotal(key))
    if (!plan.ok) return plan
    buckets.value = withText(key, next)
    bucketsLang.value = profile.value.stateKey
    persist()
    return plan
  }

  /** An edit typed in the solution's tab: memory now, written after ~1 s idle. */
  function edit(next: string): Plan {
    const key = activeStoryKey.value
    const plan = planSolution(next, otherTotal(key))
    if (!plan.ok) return plan
    buckets.value = withText(key, next)
    if (saveTimer) clearTimeout(saveTimer)
    pendingWrite = persist
    saveTimer = setTimeout(() => {
      const write = pendingWrite
      saveTimer = null
      pendingWrite = null
      write?.()
    }, 1000)
    return plan
  }

  function clear() {
    buckets.value = withText(activeStoryKey.value, null)
    persist()
  }

  return { text, has, set, edit, clear, restore, flushPendingSave }
}
