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

/** A Worker mock that immediately reports a boot error for any compile request. */
function makeFailingWorkerSpy() {
  const instances: Array<{ posted: unknown[] }> = []
  const spy = vi.fn().mockImplementation(() => {
    const listeners = new Set<(e: { data: unknown }) => void>()
    const inst = {
      posted: [] as unknown[],
      addEventListener: (_type: string, fn: (e: { data: unknown }) => void) => listeners.add(fn),
      removeEventListener: (_type: string, fn: (e: { data: unknown }) => void) => listeners.delete(fn),
      terminate: vi.fn(),
      postMessage(msg: { requestId?: number }) {
        inst.posted.push(msg)
        queueMicrotask(() => {
          for (const fn of [...listeners]) fn({ data: { error: 'boot failed (test env)', requestId: msg.requestId } })
        })
      },
    }
    instances.push(inst)
    return inst
  })
  return { spy, instances }
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
