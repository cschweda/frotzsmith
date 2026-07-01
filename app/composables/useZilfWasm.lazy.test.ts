/**
 * Lazy-load and fallback behavior assertions for useZilfWasm.
 *
 * 1. Lazy Worker construction — the ZILF Web Worker (and its 7.5 MB .NET WASM
 *    bundle) must NOT be constructed when the module is imported.
 *
 * 2. Main-thread fallback — when the Worker sends an error response, subsequent
 *    compiles must bypass the Worker entirely and attempt the main-thread path.
 *
 * Environment: node (default — no DOM/localStorage needed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Worker mock helpers ───────────────────────────────────────────────────────

/** Build a Worker mock that resolves with a failed-compile (non-error) payload. */
function makeSuccessWorkerMock() {
  let messageHandler: ((e: { data: unknown }) => void) | null = null
  return vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn((event: string, handler: (e: { data: unknown }) => void) => {
      if (event === 'message') messageHandler = handler
    }),
    removeEventListener: vi.fn(),
    terminate: vi.fn(),
    postMessage: vi.fn(() => {
      // Immediately resolve with a compile-failure (enough to settle the Promise).
      messageHandler?.({
        data: { success: false, storyBase64: null, diagnostics: [] },
      })
    }),
  }))
}

/** Build a Worker mock that fires an { error } response immediately. */
function makeErrorWorkerMock() {
  let messageHandler: ((e: { data: unknown }) => void) | null = null
  return vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn((event: string, handler: (e: { data: unknown }) => void) => {
      if (event === 'message') messageHandler = handler
    }),
    removeEventListener: vi.fn(),
    terminate: vi.fn(),
    postMessage: vi.fn(() => {
      messageHandler?.({ data: { error: 'Worker boot failed (mock)' } })
    }),
  }))
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useZilfWasm — lazy Worker construction', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does NOT construct a Worker on module import (page navigation is free)', async () => {
    const WorkerSpy = makeSuccessWorkerMock()
    vi.stubGlobal('Worker', WorkerSpy)

    // Just importing the composable must NOT touch the Worker global.
    await import('~/composables/useZilfWasm')

    expect(WorkerSpy).not.toHaveBeenCalled()
  })

  it('constructs the Worker exactly once on the first compile() call', async () => {
    const WorkerSpy = makeSuccessWorkerMock()
    vi.stubGlobal('Worker', WorkerSpy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')

    // Still no Worker after import.
    expect(WorkerSpy).not.toHaveBeenCalled()

    // First compile triggers construction.
    await useZilfWasm().compile('<ROUTINE GO () <CRLF>>', 3)
    expect(WorkerSpy).toHaveBeenCalledTimes(1)
  })

  it('reuses the same Worker instance on a second compile() call', async () => {
    const WorkerSpy = makeSuccessWorkerMock()
    vi.stubGlobal('Worker', WorkerSpy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')

    await useZilfWasm().compile('source-a', 3)
    await useZilfWasm().compile('source-b', 5)

    // Worker was constructed once, reused for the second call.
    expect(WorkerSpy).toHaveBeenCalledTimes(1)
  })
})

describe('useZilfWasm — main-thread fallback after worker error', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('falls back to main-thread and skips Worker on subsequent compiles when worker errors', async () => {
    const WorkerSpy = makeErrorWorkerMock()
    vi.stubGlobal('Worker', WorkerSpy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')

    // First compile: worker fires an error → fallback triggers.
    // The main-thread fallback will also fail (no real dotnet.js in tests),
    // but the important thing is the result is ok:false (not a hang).
    const result1 = await useZilfWasm().compile('source-a', 3)
    expect(result1.ok).toBe(false)

    // Worker was tried once.
    expect(WorkerSpy).toHaveBeenCalledTimes(1)

    // Second compile: worker is marked failed → should NOT call Worker again.
    const result2 = await useZilfWasm().compile('source-b', 5)
    expect(result2.ok).toBe(false)

    // Worker count stays at 1 — second compile went straight to main-thread.
    expect(WorkerSpy).toHaveBeenCalledTimes(1)
  })
})
