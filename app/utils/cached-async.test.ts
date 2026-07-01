import { describe, it, expect, vi } from 'vitest'
import { cachedAsync } from './cached-async'

describe('cachedAsync', () => {
  it('caches a successful load (loader runs once)', async () => {
    const loader = vi.fn().mockResolvedValue('ok')
    const get = cachedAsync(loader)
    await expect(get()).resolves.toBe('ok')
    await expect(get()).resolves.toBe('ok')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('shares one in-flight promise across concurrent callers', async () => {
    let resolveIt!: (v: string) => void
    const loader = vi.fn(() => new Promise<string>(r => (resolveIt = r)))
    const get = cachedAsync(loader)
    const a = get()
    const b = get()
    resolveIt('done')
    await expect(a).resolves.toBe('done')
    await expect(b).resolves.toBe('done')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('clears the cache on rejection so the next call retries', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce('recovered')
    const get = cachedAsync(loader)
    await expect(get()).rejects.toThrow('network blip')
    await expect(get()).resolves.toBe('recovered')
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
