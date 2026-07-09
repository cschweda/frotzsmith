/**
 * The non-blocking "storage full" cue (tracked in the 2026-06-30 audit).
 *
 * Persist paths call notifyStorageFull() when a localStorage write is refused
 * (QuotaExceededError, or storage blocked entirely). Before this cue existed,
 * the first symptom of a full quota was silently lost crash-recovery data —
 * the author kept typing, believing autosave worked.
 *
 * At most one toast per session: persists retry on every keystroke, and a
 * repeating warning would be a storm. Never throws — it runs inside failure
 * handling, and a broken cue must not take the persist path down with it.
 */

let _warned = false

/** Test hook: reset the once-per-session latch. */
export function resetStorageNoticeForTests(): void {
  _warned = false
}

export function notifyStorageFull(): void {
  if (!import.meta.client || _warned) return
  _warned = true
  try {
    useToast().add({
      title: 'Browser storage is full',
      description:
        'Your work stays in memory for this session, but autosave and settings can no longer persist. ' +
        'Save As to keep your source safe, then free space by removing uploaded extensions or old test scripts.',
      color: 'warning',
      icon: 'i-lucide-hard-drive',
      duration: 0, // sticky — dismiss manually; this is a data-loss warning
    })
  } catch {
    console.warn('[frotzsmith] Browser storage is full — changes are kept in memory only.')
  }
}
