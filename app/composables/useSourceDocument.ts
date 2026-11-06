import demoSource from '~/modules/inform6/samples/demo.inf?raw'
import zilSkeletonSource from '~/modules/languages/zil/samples/skeleton.zil?raw'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeSetItem } from '@frotzinc/nuxt-base/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'

import { registerSessionOnce } from '~/composables/session-once'

// Debounced autosave, module-level so every caller shares one timer. The key is
// captured when the save is SCHEDULED: by the time a language switch runs
// restore(), the profile already points at the new language, and a save keyed
// at fire time would file the old buffer under the wrong language.
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingKey: string | null = null

interface RecoverySnapshot {
  source: string
  savedAt: number
}

/**
 * Owns the editor's source buffer. The canonical artifact is the `.inf` the
 * author exports; this localStorage snapshot is only crash recovery (a swap
 * file), so a tab crash never loses the working buffer. New sessions start on the
 * language-appropriate seed: i6 → the I6 two-room demo, zil → the ZIL skeleton.
 */
export function useSourceDocument() {
  // useLanguage() must come before useState('frotz:source') so the factory can
  // read profile.value.id to pick the correct language seed on first access.
  // The page (index.vue / zil.vue) calls setLanguage() before IdeLayout mounts,
  // so frotz:lang is already set when this factory runs on a fresh page visit.
  const { profile } = useLanguage()
  const source = useState<string>('frotz:source', () =>
    profile.value.id === 'zil' ? zilSkeletonSource : demoSource,
  )
  const savedAt = useState<number | null>('frotz:savedAt', () => null)

  /** Namespaced localStorage key for the active language (e.g. frotzsmith:i6:recovery). */
  function getKey(): string {
    return buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.recovery)
  }

  const seedFor = () => (profile.value.id === 'zil' ? zilSkeletonSource : demoSource)

  /** Restore the recovery snapshot, if any, on first client mount. */
  function restore() {
    if (!import.meta.client) return
    // Typing then switching language inside the 1 s debounce: write the
    // pending edit (under ITS language) before the buffer is replaced.
    flushPendingSave()
    try {
      const raw = localStorage.getItem(getKey())
      if (raw) {
        const snap = JSON.parse(raw) as RecoverySnapshot
        if (typeof snap.source === 'string' && snap.source.length > 0) {
          source.value = snap.source
          savedAt.value = snap.savedAt ?? null
        }
      } else {
        // No snapshot for this language: seed its starter. The useState factory
        // only runs once per session, so after navigating between /zil/ and /
        // `source` still holds the OTHER language's text — both directions need
        // the explicit reseed (a zil-only branch here once leaked the ZIL
        // skeleton into the I6 editor, where autosave then persisted it).
        source.value = seedFor()
        savedAt.value = null
      }
    } catch {
      // Corrupt snapshot or blocked storage: start from this language's seed.
      // (Keeping the buffer would show the OTHER language's source here after
      // a switch — and autosave would then persist it under this key.)
      source.value = seedFor()
      savedAt.value = null
    }
  }

  function save(key = getKey()) {
    if (!import.meta.client) return
    const snap: RecoverySnapshot = { source: source.value, savedAt: Date.now() }
    if (safeSetItem(key, JSON.stringify(snap))) {
      savedAt.value = snap.savedAt
    } else {
      // QuotaExceededError — keep editing in memory, don't interrupt; but cue
      // the author once (this is the crash-recovery snapshot — the "Saved"
      // indicator must NOT advance when nothing was actually written).
      notifyStorageFull()
    }
  }

  /** Debounced save ~1s after the last keystroke. */
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    const key = getKey()
    pendingKey = key
    saveTimer = setTimeout(() => {
      saveTimer = null
      pendingKey = null
      save(key)
    }, 1000)
  }

  /** Write a scheduled-but-unfired save now, under the key it was scheduled for. */
  function flushPendingSave() {
    if (!saveTimer || !pendingKey) return
    clearTimeout(saveTimer)
    const key = pendingKey
    saveTimer = null
    pendingKey = null
    save(key)
  }

  // Detached, once-per-app: the first caller is a component (IdeLayout), and a
  // bare watch() would die with it on unmount (any navigation), silently
  // killing autosave for the session.
  registerSessionOnce('source-autosave', () => watch(source, scheduleSave))

  return { source, savedAt, restore, save, flushPendingSave }
}
