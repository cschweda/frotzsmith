import { describe, it, expect, vi } from 'vitest'
import { ref, watch, nextTick } from 'vue'
import { registerSessionOnce } from './session-once'

describe('registerSessionOnce', () => {
  it('runs setup once per app no matter how many callers', () => {
    const setup = vi.fn()
    registerSessionOnce('k', setup)
    registerSessionOnce('k', setup)
    registerSessionOnce('k', setup)
    expect(setup).toHaveBeenCalledTimes(1)
    registerSessionOnce('other', setup)
    expect(setup).toHaveBeenCalledTimes(2)
  })

  it('re-registers for a fresh app (the harness rebuilds state per test)', () => {
    const setup = vi.fn()
    registerSessionOnce('k', setup)
    expect(setup).toHaveBeenCalledTimes(1)
  })

  it('keeps watchers alive in a detached scope', async () => {
    const src = ref(0)
    const seen: number[] = []
    registerSessionOnce('w', () => watch(src, v => seen.push(v)))
    src.value = 1
    await nextTick()
    expect(seen).toEqual([1])
  })
})
