import { describe, it, expect, vi } from 'vitest'
import { runReplayController, ReplayCancelledError, ReplayTimeoutError, type WorkerLike } from './useReplay'

function fakeWorker() {
  const w: WorkerLike & { terminated: boolean; emit: (data: unknown) => void } = {
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage: () => {},
    terminate() {
      this.terminated = true
    },
    emit(data: unknown) {
      this.onmessage?.({ data })
    },
  }
  return w
}

describe('runReplayController', () => {
  it('resolves with the result message and reports progress', async () => {
    const w = fakeWorker()
    const onProgress = vi.fn()
    const { promise } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: ['n'] }, { onProgress })
    w.emit({ type: 'progress', done: 1, total: 1 })
    w.emit({ type: 'result', turns: [{ command: '', output: 'hi' }], ms: 5 })
    await expect(promise).resolves.toEqual({ turns: [{ command: '', output: 'hi' }], ms: 5 })
    expect(onProgress).toHaveBeenCalledWith(1, 1)
    expect(w.terminated).toBe(true)
  })

  it('rejects with the error message', async () => {
    const w = fakeWorker()
    const { promise } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: [] })
    w.emit({ type: 'error', message: 'bad story' })
    await expect(promise).rejects.toThrow('bad story')
    expect(w.terminated).toBe(true)
  })

  it('cancel() terminates the worker and rejects with ReplayCancelledError', async () => {
    const w = fakeWorker()
    const { promise, cancel } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: [] })
    cancel()
    await expect(promise).rejects.toBeInstanceOf(ReplayCancelledError)
    expect(w.terminated).toBe(true)
  })

  it('times out with ReplayTimeoutError (distinct from a user cancel), terminating the worker', async () => {
    vi.useFakeTimers()
    const w = fakeWorker()
    const { promise } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: [] }, { timeoutMs: 1000 })
    const assertion = expect(promise).rejects.toBeInstanceOf(ReplayTimeoutError)
    vi.advanceTimersByTime(1000)
    await assertion
    expect(w.terminated).toBe(true)
    vi.useRealTimers()
  })
})
