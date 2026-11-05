import { toRaw } from 'vue'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeGetItem, safeRemoveItem, safeSetItem } from '~/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { planSolution, SOLUTION_MAX, SOLUTION_STORE_MAX } from '~/composables/solution-text'

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

  /** While a recording runs, the solution is regenerated live after each
   *  captured command (useSolutionRecorder). That text is shown, not saved:
   *  Pause or Stop saves. Memory only, for the game it was made for. */
  const live = useState<{ key: string; text: string } | null>('frotz:solution-live', () => null)
  /** The recorder's state (owned by useSolutionRecorder; read here so the
   *  store needs no recorder import). */
  const recState = useState<'recording' | 'paused' | 'stopped'>('frotz:solution-rec-state', () => 'stopped')
  /** True while recording: the solution can't be edited by hand. */
  const readOnly = computed(() => recState.value === 'recording')
  /** The open session is a from-scratch recording that hasn't saved yet. */
  const recScratch = useState<boolean>('frotz:solution-rec-scratch', () => false)
  /** What the solution's editor shows: the live text while recording, else the saved text. */
  const view = computed<string | null>(() => {
    const l = live.value
    const ownLive = l && l.key === activeStoryKey.value ? l.text : null
    // Recording from scratch: the new text or nothing yet — never the old
    // solution (it may still be behind the spoiler guard).
    if (recScratch.value && recState.value !== 'stopped') return ownLive ?? ''
    if (readOnly.value && ownLive !== null) return ownLive
    return text.value
  })
  /** The story key whose solution the author chose to see (the spoiler guard,
   *  owned by useSolutionTab / useSolutionRecorder). */
  const revealedKey = useState<string | null>('frotz:solution-revealed', () => null)
  /** Whether the solution's text may be shown at all: once revealed for this
   *  game, or — during a from-scratch session — its own live text only (which
   *  `view` then gives). Everything else shows the "hidden" placeholder. */
  const visible = computed(
    () => revealedKey.value === activeStoryKey.value || (recScratch.value && recState.value !== 'stopped'),
  )
  /** Show `next` as the live text of the active game (null drops it). */
  function setLive(next: string | null) {
    live.value = next === null ? null : { key: activeStoryKey.value, text: next }
  }
  const READ_ONLY: Plan = { ok: false, message: 'The solution can’t be edited while recording, so press Pause first.' }

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

  /** Write `data` to `key`. Both are captured by the caller when the write is
   *  queued, so a language switch in between can't cross the streams. */
  function write(key: string, data: Buckets) {
    if (!import.meta.client) return
    const raw = toRaw(data)
    if (Object.keys(raw).length === 0) {
      safeRemoveItem(key)
      return
    }
    if (!safeSetItem(key, JSON.stringify({ v: 1, buckets: raw }))) notifyStorageFull()
  }

  function persist() {
    cancelPendingSave()
    write(storageKey(), buckets.value)
  }

  /** In-memory buckets still belong to the other language (a switch happened
   *  and restore() hasn't run): load this language's first. */
  function syncLanguage() {
    if (bucketsLang.value !== profile.value.stateKey) restore()
  }

  function flushPendingSave() {
    const run = pendingWrite
    cancelPendingSave()
    run?.()
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
        let total = 0
        for (const k of Object.keys(src)) {
          const b = src[k] as { text?: unknown } | null
          if (b && typeof b.text === 'string' && b.text.length <= SOLUTION_MAX && total + b.text.length <= SOLUTION_STORE_MAX) {
            loaded[k] = { text: b.text }
            total += b.text.length
          }
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
    syncLanguage()
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
    if (readOnly.value) return READ_ONLY
    syncLanguage()
    const key = activeStoryKey.value
    const plan = planSolution(next, otherTotal(key))
    // Refused: nothing changes — a from-scratch session stays one (so the
    // hidden solution is still not shown).
    if (!plan.ok) return plan
    buckets.value = withText(key, next)
    if (recScratch.value) {
      // An edit while a from-scratch session is paused becomes the solution
      // that Resume carries on from. The author wrote it: nothing to guard.
      recScratch.value = false
      revealedKey.value = key
    }
    const target = storageKey()
    const snapshot = buckets.value
    if (saveTimer) clearTimeout(saveTimer)
    pendingWrite = () => write(target, snapshot)
    saveTimer = setTimeout(() => {
      const run = pendingWrite
      saveTimer = null
      pendingWrite = null
      run?.()
    }, 1000)
    return plan
  }

  function clear() {
    syncLanguage()
    buckets.value = withText(activeStoryKey.value, null)
    persist()
  }

  /** The solution saved for `storyKey` (any game of the active language), or null. */
  function textFor(storyKey: string): string | null {
    syncLanguage()
    return ownText(buckets.value, storyKey)
  }

  /** Whether `next` would fit as `storyKey`'s solution (both caps). */
  function planFor(storyKey: string, next: string): Plan {
    syncLanguage()
    return planSolution(next, otherTotal(storyKey))
  }

  /** Put the active game's solution back behind the spoiler guard. */
  function conceal() {
    if (revealedKey.value === activeStoryKey.value) revealedKey.value = null
  }

  return { conceal, text, has, view, visible, readOnly, setLive, set, edit, clear, restore, flushPendingSave, textFor, planFor }
}
