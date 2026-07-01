import type { EngineTarget, ReplayResult, TurnRecord } from '~/modules/inform6/engine/StoryEngine'

export interface WorkerLike {
  postMessage(m: unknown): void
  terminate(): void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror: ((e: unknown) => void) | null
}

interface ReplayRequest {
  story: Uint8Array
  target: EngineTarget
  commands: string[]
}

type WorkerOut =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; turns: TurnRecord[]; ms: number }
  | { type: 'error'; message: string }

export class ReplayCancelledError extends Error {
  constructor() {
    super('Replay cancelled')
    this.name = 'ReplayCancelledError'
  }
}

export class ReplayTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Replay timed out after ${timeoutMs} ms`)
    this.name = 'ReplayTimeoutError'
  }
}

/**
 * Pure transport controller: drives a worker-like object to a ReplayResult, with
 * cancel() and an optional timeout — both `terminate()` the worker (ADR-003).
 * Injectable `spawn` makes it unit-testable without a real Worker.
 */
export function runReplayController(
  spawn: () => WorkerLike,
  req: ReplayRequest,
  opts: { onProgress?: (done: number, total: number) => void; timeoutMs?: number } = {},
): { promise: Promise<ReplayResult>; cancel: () => void } {
  const worker = spawn()
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  let reject: (e: unknown) => void = () => {}

  const cleanup = () => {
    if (timer) clearTimeout(timer)
    timer = null
    worker.terminate()
  }
  const fail = (e: unknown) => {
    if (settled) return
    settled = true
    cleanup()
    reject(e)
  }

  const promise = new Promise<ReplayResult>((resolve, rej) => {
    reject = rej
    worker.onmessage = (e: { data: unknown }) => {
      const msg = e.data as WorkerOut
      if (msg.type === 'progress') {
        opts.onProgress?.(msg.done, msg.total)
      } else if (msg.type === 'result') {
        if (settled) return
        settled = true
        cleanup()
        resolve({ turns: msg.turns, ms: msg.ms })
      } else if (msg.type === 'error') {
        fail(new Error(msg.message))
      }
    }
    worker.onerror = (err: unknown) => fail(err instanceof Error ? err : new Error('Worker error'))
    if (opts.timeoutMs != null) timer = setTimeout(() => fail(new ReplayTimeoutError(opts.timeoutMs!)), opts.timeoutMs)
    // Start the worker only after the handlers above are wired.
    worker.postMessage(req)
  })

  const cancel = () => fail(new ReplayCancelledError())

  return { promise, cancel }
}

/** Client-only composable: spawns the real module worker per run. */
export function useReplay() {
  function replay(
    story: Uint8Array,
    target: EngineTarget,
    commands: string[],
    opts: { onProgress?: (done: number, total: number) => void; timeoutMs?: number } = {},
  ) {
    const spawn = (): WorkerLike =>
      new Worker(new URL('../modules/inform6/engine/replay.worker.ts', import.meta.url), {
        type: 'module',
      }) as unknown as WorkerLike
    return runReplayController(spawn, { story, target, commands }, opts)
  }
  return { replay }
}
