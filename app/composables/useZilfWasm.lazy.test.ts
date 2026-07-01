/**
 * Lazy-load assertion for useZilfWasm.
 *
 * Verifies that the ZILF Web Worker (and its 7.5 MB .NET WASM bundle) is NOT
 * constructed when the module is imported — i.e. navigating to /zil/ is free.
 * The Worker must only be spawned on the first call to compile().
 *
 * Environment: node (default — no DOM/localStorage needed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Build a minimal Worker mock that fires the message handler when postMessage is called. */
function makeWorkerMock() {
  let messageHandler: ((e: { data: unknown }) => void) | null = null
  return vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn((event: string, handler: (e: { data: unknown }) => void) => {
      if (event === 'message') messageHandler = handler
    }),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(() => {
      // Immediately resolve with a failed compile (enough for the Promise to settle).
      messageHandler?.({
        data: { success: false, storyBase64: null, diagnostics: [] },
      })
    }),
  }))
}

describe('useZilfWasm — lazy Worker construction', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does NOT construct a Worker on module import (page navigation is free)', async () => {
    const WorkerSpy = makeWorkerMock()
    vi.stubGlobal('Worker', WorkerSpy)

    // Just importing the composable must NOT touch the Worker global.
    await import('~/composables/useZilfWasm')

    expect(WorkerSpy).not.toHaveBeenCalled()
  })

  it('constructs the Worker exactly once on the first compile() call', async () => {
    const WorkerSpy = makeWorkerMock()
    vi.stubGlobal('Worker', WorkerSpy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')

    // Still no Worker after import.
    expect(WorkerSpy).not.toHaveBeenCalled()

    // First compile triggers construction.
    await useZilfWasm().compile('<ROUTINE GO () <CRLF>>', 3)
    expect(WorkerSpy).toHaveBeenCalledTimes(1)
  })

  it('reuses the same Worker instance on a second compile() call', async () => {
    const WorkerSpy = makeWorkerMock()
    vi.stubGlobal('Worker', WorkerSpy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')

    await useZilfWasm().compile('source-a', 3)
    await useZilfWasm().compile('source-b', 5)

    // Worker was constructed once, reused for the second call.
    expect(WorkerSpy).toHaveBeenCalledTimes(1)
  })
})
