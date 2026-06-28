import demoSource from '~/modules/inform6/samples/demo.inf?raw'
import { frotzsmith } from '~~/frotzsmith.config'

const RECOVERY_KEY = frotzsmith.storageKeys.recovery

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
 * bundled demo game.
 */
export function useSourceDocument() {
  const source = useState<string>('frotz:source', () => demoSource)
  const savedAt = useState<number | null>('frotz:savedAt', () => null)
  let timer: ReturnType<typeof setTimeout> | null = null

  /** Restore the recovery snapshot, if any, on first client mount. */
  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(RECOVERY_KEY)
      if (!raw) return
      const snap = JSON.parse(raw) as RecoverySnapshot
      if (typeof snap.source === 'string' && snap.source.length > 0) {
        source.value = snap.source
        savedAt.value = snap.savedAt ?? null
      }
    } catch {
      // corrupt snapshot — ignore, keep the default
    }
  }

  function save() {
    if (!import.meta.client) return
    try {
      const snap: RecoverySnapshot = { source: source.value, savedAt: Date.now() }
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(snap))
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
    watch(source, scheduleSave)
  }

  return { source, savedAt, restore, save }
}
