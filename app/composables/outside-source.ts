/**
 * "Outside source, not yet trusted" (audit 2026-11-04, F2 defence in depth).
 *
 * A game source that arrived from outside — an opened .frotzsmith project or a
 * share link — is attacker-controlled. The Skein's "Auto-run on compile" would
 * otherwise replay it in the headless interpreter on the first Compile, with no
 * Play click. So such a source is marked here, auto-run holds back while the
 * mark is set, and the author's first explicit Play or Skein Run clears it.
 *
 * Per browser tab session: kept in sessionStorage so a reload (the restored
 * source is still the outside one) doesn't quietly re-arm auto-run. Storage
 * failures fall back to memory only.
 */

const SESSION_KEY = 'frotzsmith:outside-source'

function readSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeSession(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(SESSION_KEY, '1')
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable: memory only */
  }
}

export function useOutsideSource() {
  /** The current source came from a package or link and hasn't been run by hand yet. */
  const untrusted = useState<boolean>('frotz:outside-source', () => (import.meta.client ? readSession() : false))
  /** A compile happened while untrusted and auto-run waited (the Skein panel says so). */
  const autoRunHeld = useState<boolean>('frotz:skein-autorun-held', () => false)

  /** A package or share link just put its source in the editor. */
  function markOutside() {
    untrusted.value = true
    autoRunHeld.value = false
    writeSession(true)
  }

  /** The author pressed Play or a Skein Run: from now on auto-run as usual. */
  function trust() {
    untrusted.value = false
    autoRunHeld.value = false
    writeSession(false)
  }

  return { untrusted, autoRunHeld, markOutside, trust }
}
