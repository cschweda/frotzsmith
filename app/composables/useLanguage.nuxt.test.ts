/**
 * useLanguage composable tests — happy-dom env (via environmentMatchGlobs).
 *
 * Nuxt auto-imports (useState, computed) are provided as window globals
 * by test/nuxt-setup.ts.
 */
import { describe, it, expect } from 'vitest'

// Import after the global stubs from nuxt-setup.ts are in place.
const { useLanguage } = await import('./useLanguage')

describe('useLanguage', () => {
  // nuxt-setup.ts clears _stateMap beforeEach — every test starts with a fresh
  // useState('frotz:lang') that defaults to 'i6'.

  it('defaults to the i6 profile', () => {
    const { profile } = useLanguage()
    expect(profile.value.id).toBe('i6')
  })

  it('setLanguage("zil") swaps profile.value.id to "zil"', () => {
    const { profile, setLanguage } = useLanguage()
    setLanguage('zil')
    expect(profile.value.id).toBe('zil')
  })

  it('state is shared across two useLanguage() calls (useState semantics)', () => {
    const a = useLanguage()
    a.setLanguage('zil')
    const b = useLanguage()
    expect(b.profile.value.id).toBe('zil')
  })
})
