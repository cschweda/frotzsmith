/**
 * Worker-disabled + main-thread compile behavior for useZilfWasm.
 *
 * The ZILF Web Worker is currently DISABLED (`WORKER_ENABLED = false`) because
 * `dotnet.create()` hangs inside a plain Web Worker — see
 * docs/superpowers/notes/2026-07-01-zil-worker-followup.md. Compiles therefore
 * run on the main thread. These tests assert:
 *   1. importing the module constructs no Worker (page navigation stays free);
 *   2. compile() constructs no Worker either (worker disabled), goes straight to
 *      the main-thread path, and always RESOLVES to a CompileResult — never hangs
 *      (in the test env the .NET runtime can't load, so it resolves ok:false).
 *
 * Environment: node (no DOM/localStorage needed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** A Worker mock we assert is NEVER constructed while the worker is disabled. */
function makeWorkerSpy() {
  return vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    terminate: vi.fn(),
    postMessage: vi.fn(),
  }))
}

describe('useZilfWasm — worker disabled, main-thread compile', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does NOT construct a Worker on module import (page navigation is free)', async () => {
    const WorkerSpy = makeWorkerSpy()
    vi.stubGlobal('Worker', WorkerSpy)

    // Just importing the composable must NOT touch the Worker global.
    await import('~/composables/useZilfWasm')

    expect(WorkerSpy).not.toHaveBeenCalled()
  })

  it('compile() constructs no Worker (disabled) and resolves to a CompileResult', async () => {
    const WorkerSpy = makeWorkerSpy()
    vi.stubGlobal('Worker', WorkerSpy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')

    // Worker disabled → straight to the main-thread path. The .NET runtime can't
    // load in the test env, so it resolves ok:false — the point is it never
    // spawns a Worker and never hangs.
    const result = await useZilfWasm().compile('<ROUTINE GO () <CRLF>>', 3)

    expect(WorkerSpy).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
  })

  it('resolves (never hangs) across repeated compiles, still without a Worker', async () => {
    const WorkerSpy = makeWorkerSpy()
    vi.stubGlobal('Worker', WorkerSpy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')

    const r1 = await useZilfWasm().compile('source-a', 3)
    const r2 = await useZilfWasm().compile('source-b', 5)

    expect(r1.ok).toBe(false)
    expect(r2.ok).toBe(false)
    expect(WorkerSpy).not.toHaveBeenCalled()
  })
})
