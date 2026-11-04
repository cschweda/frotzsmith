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

  it('a silent worker times out: terminated, reported, NOT retried on the main thread', async () => {
    // Regression: a timeout used to latch main-thread mode and immediately
    // re-run the same source on the main thread — a source that spun the
    // worker for 60 s then froze the tab with nothing able to stop it.
    vi.useFakeTimers()
    try {
      const { spy, instances } = makeWorkerSpy('silent')
      vi.stubGlobal('Worker', spy)
      const { runI6Compile } = await import('~/modules/inform6/compile-main')
      vi.mocked(runI6Compile).mockClear() // earlier tests in this file used the fallback

      const { useI6Wasm } = await import('~/composables/useI6Wasm')
      const p = useI6Wasm().compile('src', { ext: 'z5' })
      await vi.advanceTimersByTimeAsync(61_000)

      const r = await p
      expect(r.ok).toBe(false)
      expect(r.diagnostics[0]!.severity).toBe('fatal')
      expect(r.rawStderr).toMatch(/timed out after 60 s/)
      expect(instances[0]!.terminate).toHaveBeenCalledTimes(1)
      expect(runI6Compile).not.toHaveBeenCalled()

      // Not latched: the next compile gets a FRESH worker.
      const p2 = useI6Wasm().compile('src2', { ext: 'z5' })
      await vi.advanceTimersByTimeAsync(0)
      expect(spy).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(61_000)
      await p2
    } finally {
      vi.useRealTimers()
    }
  })
})
