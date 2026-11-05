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
    // total cap: fill other games to ~4 MiB
    for (const k of ['a', 'b', 'c']) { storyKey().value = k; expect(s.set('y'.repeat(1024 * 1024)).ok).toBe(true) }
    storyKey().value = 'd'
    expect(s.set('y'.repeat(1024 * 1024)).ok).toBe(false) // 3 MiB elsewhere plus 1 MiB is over 4 MiB with game1
  })

  it('edit changes memory at once and persists after a pause', () => {
    vi.useFakeTimers()
    const s = useSolutions()
    s.set('v1')
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
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    expect(s.set('mem')).toEqual({ ok: true })
    s.set('mem2')
    expect(s.text.value).toBe('mem2')
    expect(_toastAdd).toHaveBeenCalledTimes(1)
  })

  it('a pending edit is not written under the other language after a switch', () => {
    vi.useFakeTimers()
    const s = useSolutions()
    s.set('i6 text')
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
})
