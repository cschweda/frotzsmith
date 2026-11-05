/**
 * outside-source — the "came from a package or link, not yet run by hand" mark
 * that holds back Skein auto-run (audit 2026-11-04, F2 defence in depth).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useOutsideSource } from './outside-source'

beforeEach(() => sessionStorage.clear())

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

  it('survives a reload in the same tab (sessionStorage), not a new session', () => {
    useOutsideSource().markOutside()
    expect(sessionStorage.getItem('frotzsmith:outside-source')).toBe('1')
    ;(window as unknown as { __nuxtStateMap: Map<string, unknown> }).__nuxtStateMap.clear() // "reload"
    expect(useOutsideSource().untrusted.value).toBe(true)
    useOutsideSource().trust()
    expect(sessionStorage.getItem('frotzsmith:outside-source')).toBeNull()
  })
})
