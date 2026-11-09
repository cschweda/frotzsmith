/** useSolutions: per-game solution store (happy-dom env). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetStorageNoticeForTests } from './useStorageNotice'
import { useLanguage } from './useLanguage'

const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))
vi.stubGlobal('useLanguage', useLanguage)

const { useSolutions } = await import('./useSolutions')
const KEY = 'frotzsmith:i6:solutions'

function storyKey() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((globalThis as any).useState as (k: string, i?: () => string) => { value: string })('frotz:story-key', () => 'game1')
}

function stateBuckets() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((globalThis as any).useState as (k: string, i?: () => unknown) => { value: unknown })('frotz:solution-buckets', () => Object.create(null))
}
function reveal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;((globalThis as any).useState as (k: string, i?: () => unknown) => { value: unknown })('frotz:solution-revealed', () => null).value = 'game1'
}
function setLang(id: 'i6' | 'zil') {
  useLanguage().setLanguage(id) // state is reset per test, so resolve it fresh
}

describe('useSolutions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    _toastAdd.mockClear()
    localStorage.clear()
    resetStorageNoticeForTests()
    storyKey().value = 'game1'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;((globalThis as any).useState as (k: string, i?: () => unknown) => { value: unknown })('frotz:solution-revealed', () => null).value = null
    setLang('i6')
    useSolutions().flushPendingSave()
    stateBuckets().value = Object.create(null)
    localStorage.clear()
  })

  it('keeps one solution per story key', () => {
    const s = useSolutions()
    expect(s.has.value).toBe(false)
    expect(s.text.value).toBeNull()
    expect(s.set('one')).toEqual({ ok: true })
    storyKey().value = 'game2'
    expect(s.text.value).toBeNull()
    s.set('two')
    storyKey().value = 'game1'
    expect(s.text.value).toBe('one')
    expect(s.has.value).toBe(true)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ v: 1, buckets: { game1: { text: 'one' }, game2: { text: 'two' } } })
  })

  it('survives a reload', () => {
    const s = useSolutions()
    s.set('kept')
    s.restore() // reads storage
    expect(s.text.value).toBe('kept')
    localStorage.setItem(KEY, JSON.stringify({ v: 1, buckets: { game1: { text: 'other' } } }))
    s.restore()
    expect(s.text.value).toBe('other')
  })

  it('is prototype-free: a game titled "constructor" or "__proto__" works', () => {
    const s = useSolutions()
    for (const k of ['constructor', '__proto__', 'hasOwnProperty', 'toString']) {
      storyKey().value = k
      expect(s.text.value).toBeNull()
      s.set('for ' + k)
      expect(s.text.value).toBe('for ' + k)
    }
    s.restore()
    storyKey().value = '__proto__'
    expect(s.text.value).toBe('for __proto__')
    storyKey().value = 'plain'
    expect(s.text.value).toBeNull()
    expect(({} as Record<string, unknown>).text).toBeUndefined()
  })

  it('refuses over the caps and changes nothing', () => {
    const s = useSolutions()
    s.set('small')
    const r = s.set('x'.repeat(1024 * 1024 + 1))
    expect(r.ok).toBe(false)
    expect(s.text.value).toBe('small')
    // total cap: fill other games to ~2 MiB
    storyKey().value = 'a'
    expect(s.set('y'.repeat(1024 * 1024)).ok).toBe(true)
    storyKey().value = 'b'
    expect(s.set('y'.repeat(1024 * 1024)).ok).toBe(false) // 1 MiB elsewhere plus 1 MiB is over 2 MiB with game1
  })

  it('edit changes memory at once and persists after a pause', () => {
    vi.useFakeTimers()
    const s = useSolutions()
    s.set('v1')
    reveal() // only a shown solution can be edited
    s.edit('v2')
    expect(s.text.value).toBe('v2')
    expect(JSON.parse(localStorage.getItem(KEY)!).buckets.game1.text).toBe('v1')
    vi.advanceTimersByTime(1100)
    expect(JSON.parse(localStorage.getItem(KEY)!).buckets.game1.text).toBe('v2')
    vi.useRealTimers()
  })

  it('clear removes the active game only', () => {
    const s = useSolutions()
    s.set('a')
    storyKey().value = 'game2'
    s.set('b')
    s.clear()
    expect(s.has.value).toBe(false)
    storyKey().value = 'game1'
    expect(s.text.value).toBe('a')
  })

  it('storage full: text stays in memory and the cue fires once', () => {
    const s = useSolutions()
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    expect(s.set('mem')).toEqual({ ok: true })
    s.set('mem2')
    expect(s.text.value).toBe('mem2')
    expect(_toastAdd).toHaveBeenCalledTimes(1)
    full.mockRestore()
  })

  it('a pending edit is not written under the other language after a switch', () => {
    vi.useFakeTimers()
    const s = useSolutions()
    s.set('i6 text')
    reveal() // only a shown solution can be edited
    s.edit('i6 edited')
    setLang('zil')
    s.restore() // flushes the pending edit to its own (i6) key
    expect(JSON.parse(localStorage.getItem(KEY)!).buckets.game1.text).toBe('i6 edited')
    expect(localStorage.getItem('frotzsmith:zil:solutions')).toBeNull()
    vi.advanceTimersByTime(2000)
    expect(localStorage.getItem('frotzsmith:zil:solutions')).toBeNull()
    expect(s.text.value).toBeNull()
    vi.useRealTimers()
  })

  it('set() after a switch without restore() lands under the right key', () => {
    const s = useSolutions()
    s.set('i6 text')
    setLang('zil')
    expect(s.set('zil text')).toEqual({ ok: true })
    expect(JSON.parse(localStorage.getItem('frotzsmith:zil:solutions')!).buckets).toEqual({ game1: { text: 'zil text' } })
    expect(JSON.parse(localStorage.getItem(KEY)!).buckets).toEqual({ game1: { text: 'i6 text' } })
    setLang('i6')
  })
  // Task 5: the left-pane solution.txt honours the spoiler guard.
  describe('visible (spoiler guard for the left pane) and edits in a from-scratch session', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = <T,>(k: string, i: () => T) => ((globalThis as any).useState as (k: string, i: () => T) => { value: T })(k, i)
    const recState = () => st<'recording' | 'paused' | 'stopped'>('frotz:solution-rec-state', () => 'stopped')
    const scratch = () => st<boolean>('frotz:solution-rec-scratch', () => false)
    const revealedKey = () => st<string | null>('frotz:solution-revealed', () => null)
    beforeEach(() => {
      recState().value = 'stopped'
      scratch().value = false
      revealedKey().value = null
    })

    it('hidden until revealed for this game; a from-scratch session shows its live text only', () => {
      const s = useSolutions()
      s.set('> secret\n')
      expect(s.visible.value).toBe(false)
      revealedKey().value = 'game1'
      expect(s.visible.value).toBe(true)
      storyKey().value = 'game2'
      expect(s.visible.value).toBe(false)
      storyKey().value = 'game1'
      revealedKey().value = null
      recState().value = 'recording'
      scratch().value = true
      expect(s.visible.value).toBe(true)
      expect(s.view.value).toBe('')
      s.setLive('> new\n')
      expect(s.view.value).toBe('> new\n')
    })

    it('an edit while the solution is hidden is refused and changes nothing', () => {
      vi.useFakeTimers()
      const s = useSolutions()
      s.set('> secret\n')
      expect(s.visible.value).toBe(false)
      expect(s.edit('').ok).toBe(false)
      vi.advanceTimersByTime(2000)
      expect(s.text.value).toBe('> secret\n')
      expect(JSON.parse(localStorage.getItem(KEY)!).buckets.game1.text).toBe('> secret\n')
      revealedKey().value = 'game1'
      expect(s.edit('> mine\n').ok).toBe(true)
      expect(s.text.value).toBe('> mine\n')
      vi.useRealTimers()
    })

    it('a rejected edit in a paused from-scratch session keeps the session from scratch (residual leak a)', () => {
      const s = useSolutions()
      s.set('> secret\n')
      recState().value = 'paused'
      scratch().value = true
      expect(s.edit('x'.repeat(1024 * 1024 + 1)).ok).toBe(false)
      expect(scratch().value).toBe(true)
      expect(s.view.value).toBe('') // still not the hidden solution
      expect(s.text.value).toBe('> secret\n')
    })

    it('an accepted edit there becomes the solution, the author’s own, so it is shown', () => {
      const s = useSolutions()
      s.set('> secret\n')
      recState().value = 'paused'
      scratch().value = true
      expect(s.edit('> mine\n').ok).toBe(true)
      expect(scratch().value).toBe(false)
      expect(s.text.value).toBe('> mine\n')
      expect(s.visible.value).toBe(true)
      expect(s.view.value).toBe('> mine\n')
    })
  })
})
