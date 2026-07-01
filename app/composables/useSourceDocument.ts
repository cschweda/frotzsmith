import demoSource from '~/modules/inform6/samples/demo.inf?raw'
import zilSkeletonSource from '~/modules/languages/zil/samples/skeleton.zil?raw'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

// The autosave watcher must be registered only once, even though this composable
// may be called from several components.
let watching = false

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
  let timer: ReturnType<typeof setTimeout> | null = null

  /** Namespaced localStorage key for the active language (e.g. frotzsmith:i6:recovery). */
  function getKey(): string {
    return buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.recovery)
  }

  /** Restore the recovery snapshot, if any, on first client mount. */
  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(getKey())
      if (raw) {
        const snap = JSON.parse(raw) as RecoverySnapshot
        if (typeof snap.source === 'string' && snap.source.length > 0) {
          source.value = snap.source
          savedAt.value = snap.savedAt ?? null
        }
      } else if (profile.value.id === 'zil') {
        // No snapshot: seed the ZIL starter so a fresh /zil/ project shows ZIL
        // source.  Covers the navigation case (/ → /zil/ in one session) where
        // frotz:source is already initialised with the I6 demo from the factory
        // but the ZIL recovery bucket has nothing — without this branch the I6
        // demo would persist in the ZIL editor until the author starts typing.
        source.value = zilSkeletonSource
      }
      // i6: no branch needed — the factory initialises correctly (demoSource)
      // and the i6 recovery snapshot, if any, is already loaded above.
    } catch {
      // corrupt snapshot — ignore, keep the default
    }
  }

  function save() {
    if (!import.meta.client) return
    try {
      const snap: RecoverySnapshot = { source: source.value, savedAt: Date.now() }
      localStorage.setItem(getKey(), JSON.stringify(snap))
      savedAt.value = snap.savedAt
    } catch {
      // QuotaExceededError — keep editing in memory, don't interrupt
    }
  }

  /** Debounced save ~1s after the last keystroke. */
  function scheduleSave() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 1000)
  }

  if (import.meta.client && !watching) {
    watching = true
    // Detached scope: the first caller is a component (IdeLayout), and a bare
    // watch() would bind to its effect scope and die on unmount (any navigation)
    // while `watching` stays true — silently killing autosave for the session.
    effectScope(true).run(() => watch(source, scheduleSave))
  }

  return { source, savedAt, restore, save }
}
