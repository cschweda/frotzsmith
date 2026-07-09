import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeSetItem } from '~/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import {
  type TestScript,
  type PersistedV2,
  upsertScript,
  renameScript,
  deleteScript,
  setScriptText,
  nextActiveId,
  migrateScriptStore,
} from './test-scripts'

interface Bucket {
  scripts: TestScript[]
  activeId: string
}

let watching = false

/**
 * Named test scripts scoped per-game via `activeStoryKey`.
 *
 * Persisted shape (v2): `{ v: 2, buckets: { [storyKey]: { scripts, activeId } } }`.
 * Old flat (v1) shape is migrated on first load and preserved under the
 * currently-loaded game's key so no existing work is lost.
 *
 * `activeStoryKey` is the shared `useState('frotz:story-key')` written by
 * `useIde` at discrete load events. It is read directly here (instead of via
 * `useIde()`) to avoid a circular call chain: useIde → useTestScripts → useIde.
 */
export function useTestScripts() {
  // Read the shared state directly to avoid the circular call:
  // useIde() calls useTestScripts(), so calling useIde() here would recurse.
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')
  const { profile } = useLanguage()

  /** Namespaced localStorage key for the active language (e.g. frotzsmith:i6:scripts). */
  function getKey(): string {
    return buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.scripts)
  }

  const buckets = useState<Record<string, Bucket>>('frotz:script-buckets', () => ({}))

  const scripts = computed<TestScript[]>(() => buckets.value[activeStoryKey.value]?.scripts ?? [])
  const activeId = computed<string>(() => buckets.value[activeStoryKey.value]?.activeId ?? '')
  const activeScript = computed(() => scripts.value.find(s => s.id === activeId.value))

  function setBucket(key: string, bucket: Bucket) {
    buckets.value = { ...buckets.value, [key]: bucket }
  }

  function persist() {
    if (!import.meta.client) return
    const data: PersistedV2 = { v: 2, buckets: buckets.value }
    // QuotaExceededError — keep working in memory, but cue the author once.
    if (!safeSetItem(getKey(), JSON.stringify(data))) notifyStorageFull()
  }

  function seedFirst() {
    const first: TestScript = {
      id: newId(),
      name: 'Script 1',
      text: '! One command per line, or separate with periods.\nlook\n',
    }
    setBucket(activeStoryKey.value, { scripts: [first], activeId: first.id })
  }

  /** Ensure the given key has a non-empty bucket; reconcile a stale activeId. */
  function ensureBucket(key: string) {
    const bucket = buckets.value[key]
    if (!bucket || bucket.scripts.length === 0) {
      const first: TestScript = {
        id: newId(),
        name: 'Script 1',
        text: '! One command per line, or separate with periods.\nlook\n',
      }
      setBucket(key, { scripts: [first], activeId: first.id })
    } else {
      const reconciled = nextActiveId(bucket.scripts, bucket.activeId)
      if (reconciled !== bucket.activeId) {
        setBucket(key, { ...bucket, activeId: reconciled })
      }
    }
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(getKey())
      // No stored value for this language → start empty, so the previous
      // language's in-memory buckets don't leak into (and get persisted under)
      // this language's key on the next write.
      buckets.value = raw
        ? (migrateScriptStore(JSON.parse(raw) as unknown, activeStoryKey.value).buckets as Record<string, Bucket>)
        : {}
    } catch {
      // corrupt — ignore, start empty
      buckets.value = {}
    }
    ensureBucket(activeStoryKey.value)
  }

  function add(name?: string) {
    const key = activeStoryKey.value
    const bucket = buckets.value[key] ?? { scripts: [], activeId: '' }
    const script: TestScript = { id: newId(), name: name || `Script ${bucket.scripts.length + 1}`, text: '' }
    setBucket(key, { scripts: upsertScript(bucket.scripts, script), activeId: script.id })
    persist()
  }

  /** Create a script from ready-made text (e.g. a captured playthrough). */
  function addFromText(name: string, text: string) {
    const key = activeStoryKey.value
    const bucket = buckets.value[key] ?? { scripts: [], activeId: '' }
    const script: TestScript = { id: newId(), name, text }
    setBucket(key, { scripts: upsertScript(bucket.scripts, script), activeId: script.id })
    persist()
  }

  function rename(id: string, name: string) {
    const key = activeStoryKey.value
    const bucket = buckets.value[key] ?? { scripts: [], activeId: '' }
    setBucket(key, { ...bucket, scripts: renameScript(bucket.scripts, id, name) })
    persist()
  }

  function remove(id: string) {
    const key = activeStoryKey.value
    const bucket = buckets.value[key] ?? { scripts: [], activeId: '' }
    const newScripts = deleteScript(bucket.scripts, id)
    const newActiveId = nextActiveId(newScripts, bucket.activeId)
    setBucket(key, { scripts: newScripts, activeId: newActiveId })
    persist()
  }

  function updateText(id: string, text: string) {
    const key = activeStoryKey.value
    const bucket = buckets.value[key] ?? { scripts: [], activeId: '' }
    setBucket(key, { ...bucket, scripts: setScriptText(bucket.scripts, id, text) })
    persist()
  }

  function select(id: string) {
    const key = activeStoryKey.value
    const bucket = buckets.value[key] ?? { scripts: [], activeId: '' }
    setBucket(key, { ...bucket, activeId: id })
    persist()
  }

  if (import.meta.client && !watching) {
    watching = true
    // Detached scope so these session-long watchers survive component unmount
    // (see useSourceDocument for the failure mode).
    effectScope(true).run(() => {
      watch(buckets, persist, { deep: true })
      watch(activeStoryKey, newKey => {
        ensureBucket(newKey)
      })
    })
  }

  return { scripts, activeId, activeScript, add, addFromText, rename, remove, updateText, select, restore }
}

function newId(): string {
  return import.meta.client && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s_${Math.random().toString(36).slice(2)}`
}
