import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

/**
 * "Outside source, not yet trusted" (audit 2026-11-04, F2 defence in depth).
 *
 * A game source that arrived from outside — an opened .frotzsmith project or a
 * share link — is attacker-controlled. The Skein's "Auto-run on compile" would
 * otherwise replay it in the headless interpreter on the first Compile, with no
 * Play click. So such a source is marked here and auto-run holds back while
 * the mark is set.
 *
 * - Lifetime: the mark lives in localStorage next to the autosaved source it
 *   describes, so closing the tab and coming back doesn't quietly re-arm
 *   auto-run for the same source.
 * - Scope: one mark per language profile (`frotzsmith:<stateKey>:outside-source`);
 *   an I6 package doesn't hold back ZIL auto-run, and trusting one leaves the
 *   other marked.
 * - Set by: package open, share-link load. Cleared ONLY by the author's
 *   explicit Play or Skein Run in that profile, or by replacing the source
 *   wholesale with their own (a bundled sample, New/blank). Editing does not
 *   clear it.
 * - Fail closed: the in-memory mark is authoritative for this session, so a
 *   source marked now stays marked even when storage refuses the write or the
 *   read. Nothing here throws.
 */

function storageKey(stateKey: string): string {
  return buildStorageKey(stateKey, frotzsmith.storageKeys.outsideSource)
}

function readStored(stateKey: string): boolean {
  try {
    return localStorage.getItem(storageKey(stateKey)) === '1'
  } catch {
    return false // unreadable: only this session's in-memory marks apply
  }
}

function writeStored(stateKey: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(storageKey(stateKey), '1')
    else localStorage.removeItem(storageKey(stateKey))
  } catch {
    /* storage unavailable: the in-memory mark still holds for this session */
  }
}

export function useOutsideSource() {
  const { profile } = useLanguage()
  /** This session's marks per profile stateKey, once set or cleared here. */
  const marks = useState<Record<string, boolean>>('frotz:outside-source', () => ({}))
  /** A compile happened while untrusted and auto-run waited (the Skein panel says so). */
  const autoRunHeld = useState<boolean>('frotz:skein-autorun-held', () => false)

  function isMarked(stateKey: string): boolean {
    // Set this session → authoritative (even if storage refused it);
    // otherwise whatever an earlier session left in storage.
    if (Object.hasOwn(marks.value, stateKey)) return marks.value[stateKey] === true
    return import.meta.client ? readStored(stateKey) : false
  }

  function set(on: boolean) {
    const stateKey = profile.value.stateKey
    marks.value = { ...marks.value, [stateKey]: on }
    autoRunHeld.value = false
    writeStored(stateKey, on)
  }

  /** The current profile's source came from a package or link and hasn't been run by hand. */
  const untrusted = computed(() => isMarked(profile.value.stateKey))

  return {
    untrusted,
    autoRunHeld,
    /** A package or share link just put its source in the editor. */
    markOutside: () => set(true),
    /** The author pressed Play or a Skein Run, or loaded a source of their own. */
    trust: () => set(false),
  }
}
