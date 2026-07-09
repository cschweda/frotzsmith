/**
 * useI6Wasm worker failure-mode timing: error/messageerror events must fall
 * back promptly (not after the 60 s timeout), and a silent worker must be
 * terminated + latched by the timeout. compile-main is mocked so the fallback
 * is instant and deterministic under fake timers.
 *
 * Environment: node.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeWorkerSpy } from '~~/test/mock-worker'

const FALLBACK_RESULT = {
  ok: false,
  storyExt: 'z5',
  diagnostics: [],
  rawStderr: 'FROM-FALLBACK',
  ms: 1,
  byteLength: 0,
}

vi.mock('~/modules/inform6/compile-main', () => ({
  runI6Compile: vi.fn(async () => FALLBACK_RESULT),
}))

describe('useI6Wasm — worker error/messageerror events fail fast', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  for (const behavior of ['error-event', 'messageerror-event'] as const) {
    it(`falls back promptly on ${behavior}, not after the 60 s timeout`, async () => {
      vi.useFakeTimers()
      try {
        const { spy } = makeWorkerSpy(behavior)
        vi.stubGlobal('Worker', spy)

        const { useI6Wasm } = await import('~/composables/useI6Wasm')
        let settled = false
        const p = useI6Wasm()
          .compile('src', { ext: 'z5' })
          .then((r) => {
            settled = true
            return r
          })
        await vi.advanceTimersByTimeAsync(1_000) // far below the 60 s timeout
        expect(settled).toBe(true)

        const r = await p
        expect(r.rawStderr).toBe('FROM-FALLBACK')
      } finally {
        vi.useRealTimers()
      }
    })
  }

  it('a silent worker is terminated and latched by the timeout', async () => {
    vi.useFakeTimers()
    try {
      const { spy, instances } = makeWorkerSpy('silent')
      vi.stubGlobal('Worker', spy)

      const { useI6Wasm } = await import('~/composables/useI6Wasm')
      const p = useI6Wasm().compile('src', { ext: 'z5' })
      await vi.advanceTimersByTimeAsync(61_000)

      const r = await p
      expect(r.rawStderr).toBe('FROM-FALLBACK')
      expect(instances[0]!.terminate).toHaveBeenCalledTimes(1)

      // Latched: the next compile skips the Worker entirely.
      const r2 = await useI6Wasm().compile('src2', { ext: 'z5' })
      expect(r2.rawStderr).toBe('FROM-FALLBACK')
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
