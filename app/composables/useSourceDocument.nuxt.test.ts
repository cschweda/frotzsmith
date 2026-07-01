/**
 * useSourceDocument seed behavior tests — happy-dom env.
 *
 * Verifies that a fresh project (no localStorage recovery snapshot) seeds the
 * language-appropriate default source:
 *   i6  → the I6 two-room demo   (Constant Story "FROTZSMITH DEMO" …)
 *   zil → the ZIL skeleton        (WEST-OF-HOUSE room)
 *
 * Both the useState() factory (first-visit) and restore() (navigation within
 * the same session) are exercised by resetting the state map and localStorage
 * before each test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLanguage } from './useLanguage'
import { useSourceDocument } from './useSourceDocument'

// Provide useLanguage as a global so useSourceDocument's auto-import resolves.
vi.stubGlobal('useLanguage', useLanguage)

describe('useSourceDocument — fresh-project seed (no snapshot)', () => {
  beforeEach(() => {
    // nuxt-setup.ts already clears _stateMap in its own beforeEach.
    // Clear localStorage so restore() finds no recovery snapshot.
    localStorage.clear()
  })

  it('seeds the I6 demo for a fresh i6 project', () => {
    // Default lang is 'i6' (frotz:lang defaults to 'i6' from useLanguage).
    const { source, restore } = useSourceDocument()
    restore()
    expect(source.value).toContain('Constant Story')
    expect(source.value).not.toContain('WEST-OF-HOUSE')
  })

  it('seeds the ZIL skeleton for a fresh zil project (factory path)', () => {
    // Simulate the page calling setLanguage('zil') before IdeLayout mounts.
    useLanguage().setLanguage('zil')

    const { source } = useSourceDocument()
    // Factory should have picked ZIL skeleton — no restore() needed.
    expect(source.value).toContain('WEST-OF-HOUSE')
    expect(source.value).not.toContain('Constant Story')
  })

  it('seeds the ZIL skeleton via restore() when navigating from i6 to zil', () => {
    // Simulate: user loaded / first (lang=i6, source=demoSource), then navigated
    // to /zil/ in the same session.  frotz:source is already set to the I6 demo
    // (the key exists in state), so the factory won't re-run.  restore() must
    // correct this.

    // Boot i6 first to initialise frotz:source with demoSource.
    const i6 = useSourceDocument()
    expect(i6.source.value).toContain('Constant Story')

    // Switch language to zil (as zil.vue's setLanguage('zil') would do).
    useLanguage().setLanguage('zil')

    // IdeLayout remounts for the new language → restore() is called.
    const { source, restore } = useSourceDocument()
    restore()
    expect(source.value).toContain('WEST-OF-HOUSE')
    expect(source.value).not.toContain('Constant Story')
  })
})
