import { describe, it, expect, vi } from 'vitest'
import { createWorkerRpc } from './worker-rpc'
import { makeWorkerSpy } from '~~/test/mock-worker'

const parse = (d: Record<string, unknown>) =>
  d.result !== undefined ? { kind: 'ok' as const, value: d.result } : { kind: 'error' as const, message: String(d.error) }

describe('createWorkerRpc', () => {
  it('a timeout kills the worker and settles EVERY request waiting on it', async () => {
    vi.useFakeTimers()
    try {
      const { spy, instances } = makeWorkerSpy('silent')
      const rpc = createWorkerRpc({ spawn: () => new spy(), parse })
      const untimed = rpc.call({ n: 1 }, { timeoutMs: null }) // e.g. the warm-up
      const timed = rpc.call({ n: 2 }, { timeoutMs: 1000 })
      await vi.advanceTimersByTimeAsync(1001)
      expect(await timed).toEqual({ kind: 'timeout', ms: 1000 })
      expect(await untimed).toEqual({ kind: 'timeout', ms: 1000 }) // no leaked promise
      expect(instances[0]!.terminate).toHaveBeenCalledTimes(1)

      // The next call constructs a fresh worker.
      void rpc.call({ n: 3 }, { timeoutMs: null })
      expect(spy).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clockStartsAfter delays the timeout until the gate settles', async () => {
    vi.useFakeTimers()
    try {
      const { spy } = makeWorkerSpy('silent')
      const rpc = createWorkerRpc({ spawn: () => new spy(), parse })
      let open!: () => void
      const gate = new Promise<void>(r => { open = r })
      let settled = false
      const p = rpc.call({}, { timeoutMs: 1000, clockStartsAfter: gate }).then(o => { settled = true; return o })
      await vi.advanceTimersByTimeAsync(5000)
      expect(settled).toBe(false)
      open()
      await vi.advanceTimersByTimeAsync(1001)
      expect((await p).kind).toBe('timeout')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores stale replies; routes untagged breadcrumbs; error replies keep the worker', async () => {
    const listeners = new Map<string, Set<(e: { data?: unknown }) => void>>()
    const posted: { requestId: number }[] = []
    const fake = {
      addEventListener: (t: string, f: (e: { data?: unknown }) => void) => {
        if (!listeners.has(t)) listeners.set(t, new Set())
        listeners.get(t)!.add(f)
      },
      removeEventListener: (t: string, f: (e: { data?: unknown }) => void) => listeners.get(t)?.delete(f),
      postMessage: (m: { requestId: number }) => posted.push(m),
      terminate: vi.fn(),
    }
    const emit = (data: unknown) => {
      for (const f of [...(listeners.get('message') ?? [])]) f({ data })
    }
    const onUntagged = vi.fn()
    const spawn = vi.fn(() => fake as unknown as Worker)
    const rpc = createWorkerRpc({ spawn, parse, onUntagged })

    const p = rpc.call({}, { timeoutMs: null })
    const id = posted[0]!.requestId
    emit({ stage: 'boot' })
    emit({ requestId: id - 1, result: 'STALE' })
    emit({ requestId: id, result: 'FRESH' })
    expect(await p).toEqual({ kind: 'ok', value: 'FRESH' })
    expect(onUntagged).toHaveBeenCalledWith({ stage: 'boot' })

    const p2 = rpc.call({}, { timeoutMs: null })
    emit({ requestId: posted[1]!.requestId, error: 'boom' })
    expect(await p2).toEqual({ kind: 'error', message: 'boom' })
    expect(fake.terminate).not.toHaveBeenCalled()
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('a worker that fires an error event resolves as unavailable', async () => {
    const { spy } = makeWorkerSpy('error-event')
    const rpc = createWorkerRpc({ spawn: () => new spy(), parse })
    expect(await rpc.call({}, { timeoutMs: null })).toEqual({ kind: 'unavailable' })
  })

  it('a spawn that throws resolves as unavailable', async () => {
    const rpc = createWorkerRpc({ spawn: () => { throw new Error('no workers') }, parse })
    expect(await rpc.call({}, { timeoutMs: null })).toEqual({ kind: 'unavailable' })
  })
})
