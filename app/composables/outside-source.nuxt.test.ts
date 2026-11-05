/**
 * outside-source — the "came from a package or link, not yet run by hand" mark
 * that holds back Skein auto-run (audit 2026-11-04, F2 defence in depth).
 * Per language profile, in localStorage next to the autosaved source, fail
 * closed when storage misbehaves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const _profile = ref({ id: 'i6', stateKey: 'i6', route: '/' })
vi.stubGlobal('useLanguage', () => ({ profile: _profile }))

const { useOutsideSource } = await import('./outside-source')

const I6 = { id: 'i6', stateKey: 'i6', route: '/' }
const ZIL = { id: 'zil', stateKey: 'zil', route: '/zil/' }
/** A page reload: fresh composable state, storage kept. */
const reload = () => (window as unknown as { __nuxtStateMap: Map<string, unknown> }).__nuxtStateMap.clear()

beforeEach(() => {
  localStorage.clear()
  _profile.value = I6
})
afterEach(() => vi.restoreAllMocks())

describe('useOutsideSource — the held note is per language, like the mark', () => {
  it('a note held for Inform 6 is not shown for ZIL, and trusting ZIL keeps it', () => {
    useOutsideSource().markOutside()
    useOutsideSource().autoRunHeld.value = true
    _profile.value = ZIL
    expect(useOutsideSource().autoRunHeld.value).toBe(false)
    useOutsideSource().markOutside()
    useOutsideSource().trust()
    _profile.value = I6
    expect(useOutsideSource().autoRunHeld.value).toBe(true)
    useOutsideSource().trust()
    expect(useOutsideSource().autoRunHeld.value).toBe(false)
  })
})

describe('useOutsideSource', () => {
  it('starts trusted', () => {
    expect(useOutsideSource().untrusted.value).toBe(false)
    expect(useOutsideSource().autoRunHeld.value).toBe(false)
  })

  it('markOutside sets it; trust clears it and the held note', () => {
    const o = useOutsideSource()
    o.markOutside()
    expect(useOutsideSource().untrusted.value).toBe(true)
    o.autoRunHeld.value = true
    o.trust()
    expect(o.untrusted.value).toBe(false)
    expect(o.autoRunHeld.value).toBe(false)
  })

  it('survives a reload and a closed tab (localStorage, namespaced per profile)', () => {
    useOutsideSource().markOutside()
    expect(localStorage.getItem('frotzsmith:i6:outside-source')).toBe('1')
    reload()
    expect(useOutsideSource().untrusted.value).toBe(true)
    useOutsideSource().trust()
    expect(localStorage.getItem('frotzsmith:i6:outside-source')).toBeNull()
    reload()
    expect(useOutsideSource().untrusted.value).toBe(false)
  })

  it('an I6 mark does not affect ZIL; trusting one profile leaves the other marked', () => {
    useOutsideSource().markOutside()
    _profile.value = ZIL
    expect(useOutsideSource().untrusted.value).toBe(false)
    useOutsideSource().markOutside()
    useOutsideSource().trust()
    expect(useOutsideSource().untrusted.value).toBe(false)
    _profile.value = I6
    expect(useOutsideSource().untrusted.value).toBe(true)
    reload()
    expect(useOutsideSource().untrusted.value).toBe(true)
  })

  it('fails closed: a mark set this session holds when storage refuses writes and reads', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    const o = useOutsideSource()
    expect(() => o.markOutside()).not.toThrow()
    expect(useOutsideSource().untrusted.value).toBe(true)
  })
})
