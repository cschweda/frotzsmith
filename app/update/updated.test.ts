import { describe, it, expect } from 'vitest'
import { markUpdating, takeUpdated } from './updated'

function memory() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

describe('takeUpdated', () => {
  it('is true once after markUpdating, then false', () => {
    const s = memory()
    markUpdating(s)
    expect(takeUpdated(s)).toBe(true)
    expect(takeUpdated(s)).toBe(false)
  })

  it('is false, without throwing, when storage throws', () => {
    const bad = {
      getItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(() => markUpdating(bad)).not.toThrow()
    expect(takeUpdated(bad)).toBe(false)
  })
})
