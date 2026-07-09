/**
 * safe-storage tests — node env (no DOM), which doubles as the "no
 * localStorage at all" case. Blocked-access and quota failures are simulated
 * by stubbing a throwing localStorage global.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeGetItem, safeSetItem } from './safe-storage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('safeGetItem', () => {
  it('returns null when localStorage does not exist at all (node/SSR)', () => {
    expect(safeGetItem('k')).toBeNull()
  })

  it('returns null when storage access is blocked (getItem throws)', () => {
    // Chrome "Block all cookies" / some embedded contexts: ANY access throws.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(safeGetItem('k')).toBeNull()
  })

  it('returns the stored value (or null for a missing key) when storage works', () => {
    const store = new Map([['k', 'v']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
    })
    expect(safeGetItem('k')).toBe('v')
    expect(safeGetItem('missing')).toBeNull()
  })
})

describe('safeSetItem', () => {
  it('returns false when localStorage does not exist at all (node/SSR)', () => {
    expect(safeSetItem('k', 'v')).toBe(false)
  })

  it('returns false instead of throwing when the quota is full (setItem throws)', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
    })
    expect(safeSetItem('k', 'v')).toBe(false)
  })

  it('writes the value and returns true when storage works', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      setItem: (key: string, value: string) => store.set(key, value),
    })
    expect(safeSetItem('k', 'v')).toBe(true)
    expect(store.get('k')).toBe('v')
  })
})
