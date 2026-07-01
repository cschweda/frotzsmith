/**
 * Autosave-watcher lifetime — the watcher must survive the unmount of the
 * component that first called useSourceDocument() (IdeLayout unmounts on every
 * navigation, e.g. / → /technical). Module state (the `watching` flag) is reset
 * per test via vi.resetModules() + dynamic import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick } from 'vue'

describe('useSourceDocument — autosave watcher survives component unmount', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('still autosaves after the registering scope is stopped', async () => {
    const { useLanguage } = await import('./useLanguage')
    vi.stubGlobal('useLanguage', useLanguage)
    const { useSourceDocument } = await import('./useSourceDocument')

    // First call happens inside a component-like effect scope…
    const scope = effectScope()
    let source!: ReturnType<typeof useSourceDocument>['source']
    scope.run(() => {
      source = useSourceDocument().source
    })
    // …which is then disposed (component unmounted on navigation).
    scope.stop()

    source.value = 'Constant Story "After Nav";'
    await nextTick() // let the (pre-flush) watcher callback run
    vi.advanceTimersByTime(1100) // debounce

    const raw = localStorage.getItem('frotzsmith:i6:recovery')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).source).toContain('After Nav')
  })
})
