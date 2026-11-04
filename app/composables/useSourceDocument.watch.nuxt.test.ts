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

describe('useSourceDocument — language switch', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function boot() {
    const { useLanguage } = await import('./useLanguage')
    vi.stubGlobal('useLanguage', useLanguage)
    const { useSourceDocument } = await import('./useSourceDocument')
    return { useLanguage, useSourceDocument }
  }

  it('flushes the pending save under the OLD language before switching buffers', async () => {
    const { useLanguage, useSourceDocument } = await boot()
    const doc = useSourceDocument()
    doc.source.value = 'Constant Story "Typed Just Now";'
    await nextTick() // watcher schedules the 1 s debounce…
    vi.advanceTimersByTime(300) // …and the user switches language before it fires

    useLanguage().setLanguage('zil')
    useSourceDocument().restore()
    vi.advanceTimersByTime(1100)

    const i6 = JSON.parse(localStorage.getItem('frotzsmith:i6:recovery')!)
    expect(i6.source).toContain('Typed Just Now')
    const zil = localStorage.getItem('frotzsmith:zil:recovery')
    expect(zil === null || !JSON.parse(zil).source.includes('Typed Just Now')).toBe(true)
  })

  it('blocked storage still reseeds the new language instead of keeping the old buffer', async () => {
    const { useLanguage, useSourceDocument } = await boot()
    const doc = useSourceDocument()
    expect(doc.source.value).toContain('Constant Story')
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    useLanguage().setLanguage('zil')
    useSourceDocument().restore()
    spy.mockRestore()
    expect(doc.source.value).toContain('WEST-OF-HOUSE')
  })
})

describe('useSourceDocument — flushPendingSave', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes the recovery copy immediately, without advancing timers', async () => {
    const { useLanguage } = await import('./useLanguage')
    vi.stubGlobal('useLanguage', useLanguage)
    const { useSourceDocument } = await import('./useSourceDocument')
    const doc = useSourceDocument()
    doc.source.value = 'Constant Story "Flushed";'
    await nextTick()
    expect(localStorage.getItem('frotzsmith:i6:recovery')).toBeNull()
    doc.flushPendingSave()
    const raw = localStorage.getItem('frotzsmith:i6:recovery')
    expect(JSON.parse(raw!).source).toContain('Flushed')
  })
})
