/**
 * Worker-enabled compile behavior for useZilfWasm.
 *
 * The ZILF Web Worker is ENABLED (dotnet/runtime#114918 workaround: the worker
 * registers its message handler via addEventListener — never `self.onmessage =`
 * — so dotnet.js boots standalone instead of hanging in its pthread-deputy
 * path; see zilf.worker.ts). These tests assert:
 *   1. importing the module constructs no Worker (page navigation stays free);
 *   2. compile() constructs the Worker lazily, tags requests with a requestId,
 *      and falls back to the main thread when the worker reports an error —
 *      resolving (never hanging) with ok:false in this env (no .NET runtime);
 *   3. after a worker failure, later compiles skip the Worker entirely
 *      (_workerFailed caching) and still resolve.
 *
 * Environment: node (no DOM/localStorage needed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeWorkerSpy } from '~~/test/mock-worker'

/** A Worker mock that immediately reports a boot error for any compile request. */
function makeFailingWorkerSpy() {
  return makeWorkerSpy('reply-error')
}

describe('useZilfWasm — worker enabled, error fallback to main thread', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does NOT construct a Worker on module import (page navigation is free)', async () => {
    const { spy } = makeFailingWorkerSpy()
    vi.stubGlobal('Worker', spy)

    await import('~/composables/useZilfWasm')

    expect(spy).not.toHaveBeenCalled()
  })

  it('compile() uses the Worker lazily, tags the request, and falls back on worker error', async () => {
    const { spy, instances } = makeFailingWorkerSpy()
    vi.stubGlobal('Worker', spy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')
    const result = await useZilfWasm().compile('<ROUTINE GO () <CRLF>>', 3)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(instances[0]!.posted[0]).toMatchObject({ version: 3, requestId: expect.any(Number) })
    // Worker reported an error → main-thread fallback → the .NET runtime can't
    // load in node, so ok:false — the point is it resolves and never hangs.
    expect(result.ok).toBe(false)
  })

  it('warmZilCompiler respects Data Saver — no ~9 MB download uninvited', async () => {
    // A visitor who opens /zil/ just to LOOK, on a metered connection, must
    // not be committed to the .NET bundle download + ~20 s background warm-up.
    const { spy } = makeWorkerSpy('silent')
    vi.stubGlobal('Worker', spy)
    vi.stubGlobal('navigator', { connection: { saveData: true } })

    const mod = await import('~/composables/useZilfWasm')
    mod.warmZilCompiler()
    await new Promise(r => setTimeout(r, 0))

    expect(spy).not.toHaveBeenCalled() // no worker, no download
  })

  it('warmZilCompiler skips 2g-class connections', async () => {
    const { spy } = makeWorkerSpy('silent')
    vi.stubGlobal('Worker', spy)
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: 'slow-2g' } })

    const mod = await import('~/composables/useZilfWasm')
    mod.warmZilCompiler()
    await new Promise(r => setTimeout(r, 0))

    expect(spy).not.toHaveBeenCalled()
  })

  it('warmZilCompiler pre-boots the worker once and is idempotent', async () => {
    const { spy, instances } = makeFailingWorkerSpy()
    vi.stubGlobal('Worker', spy)

    const mod = await import('~/composables/useZilfWasm')
    mod.warmZilCompiler()
    mod.warmZilCompiler() // second call must be a no-op
    await new Promise(r => setTimeout(r, 0)) // let the fire-and-forget settle

    expect(spy).toHaveBeenCalledTimes(1)
    // The warm-up goes through the normal compile protocol (throwaway skeleton).
    expect(instances[0]!.posted).toHaveLength(1)
    expect(instances[0]!.posted[0]).toMatchObject({ version: 3, requestId: expect.any(Number) })
  })

  it('after a worker failure, later compiles skip the Worker and still resolve', async () => {
    const { spy } = makeFailingWorkerSpy()
    vi.stubGlobal('Worker', spy)

    const { useZilfWasm } = await import('~/composables/useZilfWasm')
    const r1 = await useZilfWasm().compile('source-a', 3)
    const r2 = await useZilfWasm().compile('source-b', 5)

    expect(r1.ok).toBe(false)
    expect(r2.ok).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1) // _workerFailed caches the fallback decision
  })
})

describe('useZilfWasm — worker error/messageerror events fail fast', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('falls back promptly when the worker script fails to boot (error event)', async () => {
    // A worker whose script fails to load/parse (bad deploy, CSP, dev
    // transform) fires `error` and never posts a message — without an error
    // listener the user stares at "Compiling…" for the full 60 s timeout.
    vi.useFakeTimers()
    try {
      const { spy } = makeWorkerSpy('error-event')
      vi.stubGlobal('Worker', spy)

      const { useZilfWasm } = await import('~/composables/useZilfWasm')
      let settled = false
      const p = useZilfWasm().compile('src', 3).then((r) => {
        settled = true
        return r
      })
      await vi.advanceTimersByTimeAsync(1_000) // far below the 60 s timeout
      expect(settled).toBe(true)

      const r = await p
      expect(r.ok).toBe(false) // main-thread fallback (no .NET in node); the point is it resolved fast
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back promptly on a messageerror event', async () => {
    vi.useFakeTimers()
    try {
      const { spy } = makeWorkerSpy('messageerror-event')
      vi.stubGlobal('Worker', spy)

      const { useZilfWasm } = await import('~/composables/useZilfWasm')
      let settled = false
      const p = useZilfWasm().compile('src', 3).then((r) => {
        settled = true
        return r
      })
      await vi.advanceTimersByTimeAsync(1_000)
      expect(settled).toBe(true)

      const r = await p
      expect(r.ok).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useZilfWasm — warm-up must not sabotage real compiles', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('a stalled warm-up neither terminates the worker nor latches main-thread mode', async () => {
    // Regression: the warm-up shared the real compiles' 60 s timeout. On a slow
    // connection (7.5 MB download + ~20 s boot) the warm-up's timer fired,
    // terminate()d the shared worker — killing any real compile queued behind
    // it — and latched _workerFailed, so every later compile silently froze
    // the main thread with no signal that degraded mode was active.
    vi.useFakeTimers()
    try {
      const { spy, instances } = makeWorkerSpy('silent')
      vi.stubGlobal('Worker', spy)

      const mod = await import('~/composables/useZilfWasm')
      mod.warmZilCompiler()
      await vi.advanceTimersByTimeAsync(61_000) // well past WORKER_TIMEOUT_MS

      // The stalled warm-up must not have killed the worker…
      expect(instances[0]!.terminate).not.toHaveBeenCalled()

      // …and a real compile must still attempt the worker path (no latch).
      const p = mod.useZilfWasm().compile('src', 3)
      await vi.advanceTimersByTimeAsync(0)
      expect(instances[0]!.posted).toHaveLength(2) // warm-up + real compile

      // The real compile still owns its own timeout: a genuinely dead worker
      // is terminated and latched by IT, and the compile resolves via fallback.
      await vi.advanceTimersByTimeAsync(61_000)
      const r = await p
      expect(r.ok).toBe(false)
      expect(instances[0]!.terminate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
