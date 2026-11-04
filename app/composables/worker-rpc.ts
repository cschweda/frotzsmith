import type { CompileResult, StoryExt } from '~/modules/inform6/types'

/**
 * Shared request/response client for the compile workers (Inform 6 and ZIL).
 *
 * One long-lived worker per client, requests tagged with a monotonic
 * `requestId` so a late reply from an abandoned request is ignored. Every
 * call settles with an explicit outcome — the caller owns the policy:
 *
 *   ok           the worker answered this request
 *   error        the worker answered with `{ error }` (its compile path threw)
 *   unavailable  the worker can't be built, or fired `error`/`messageerror`
 *                (script failed to load, bad message) — it will never answer
 *   timeout      no answer within the budget; the worker was terminated
 *
 * On `unavailable` and `timeout` the worker is terminated and dropped, so the
 * next call constructs a fresh one — and every OTHER request still waiting on
 * the dead worker is settled too (as the same outcome) instead of leaking.
 */

export type WorkerOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable' }
  | { kind: 'timeout'; ms: number }

/** How a worker message maps onto a request: ignore it (progress/breadcrumb),
 *  or settle the request as ok / error. */
export type ParsedReply<T> = { kind: 'ignore' } | { kind: 'ok'; value: T } | { kind: 'error'; message: string }

export interface WorkerRpcOptions<T> {
  spawn: () => Worker
  /** Map a message for THIS request (requestId already matched) to a reply. */
  parse: (data: Record<string, unknown>) => ParsedReply<T>
  /** Messages without a requestId (e.g. boot breadcrumbs) go here. */
  onUntagged?: (data: Record<string, unknown>) => void
}

export interface CallOptions {
  /** Wall-clock budget; `null` = no timeout. */
  timeoutMs: number | null
  /** Start the timeout clock only once this settles (a request queued behind
   *  other work in the single-threaded worker shouldn't pay for it). */
  clockStartsAfter?: Promise<unknown>
}

export function createWorkerRpc<T>(o: WorkerRpcOptions<T>) {
  let worker: Worker | null = null
  let seq = 0
  /** Settlers for every request in flight on the current worker. */
  const inflight = new Set<(outcome: WorkerOutcome<T>) => void>()

  function kill(outcome: WorkerOutcome<T>) {
    const w = worker
    worker = null
    try {
      w?.terminate()
    } catch {
      /* already dead */
    }
    for (const settle of [...inflight]) settle(outcome)
  }

  function call(request: Record<string, unknown>, opts: CallOptions): Promise<WorkerOutcome<T>> {
    return new Promise((resolve) => {
      let w: Worker
      try {
        w = worker ?? (worker = o.spawn())
      } catch {
        worker = null
        resolve({ kind: 'unavailable' })
        return
      }

      const requestId = ++seq
      let timer: ReturnType<typeof setTimeout> | null = null
      let done = false

      const settle = (outcome: WorkerOutcome<T>) => {
        if (done) return
        done = true
        if (timer !== null) clearTimeout(timer)
        inflight.delete(settle)
        w.removeEventListener('message', onMessage)
        w.removeEventListener('error', onBroken)
        w.removeEventListener('messageerror', onBroken)
        resolve(outcome)
      }

      const onMessage = (event: MessageEvent) => {
        const data = (event.data ?? {}) as Record<string, unknown>
        if (data.requestId === undefined) {
          o.onUntagged?.(data)
          return
        }
        if (data.requestId !== requestId) return // another (or a stale) request's reply
        const reply = o.parse(data)
        if (reply.kind === 'ignore') return
        settle(reply)
      }

      const onBroken = () => {
        if (worker === w) kill({ kind: 'unavailable' })
        else settle({ kind: 'unavailable' })
      }

      const startClock = () => {
        if (done || opts.timeoutMs === null) return
        const ms = opts.timeoutMs
        timer = setTimeout(() => {
          // Terminate the stuck worker; anything queued behind it can't finish.
          if (worker === w) kill({ kind: 'timeout', ms })
          else settle({ kind: 'timeout', ms })
        }, ms)
      }

      inflight.add(settle)
      w.addEventListener('message', onMessage)
      w.addEventListener('error', onBroken)
      w.addEventListener('messageerror', onBroken)
      w.postMessage({ ...request, requestId })

      if (opts.clockStartsAfter) void opts.clockStartsAfter.then(startClock, startClock)
      else startClock()
    })
  }

  return { call }
}

/** The CompileResult a timed-out compile reports — no main-thread retry: a
 *  source that spun the worker for a minute would freeze the tab instead. */
export function timedOutResult(storyExt: StoryExt, ms: number): CompileResult {
  const msg =
    `Compile timed out after ${Math.round(ms / 1000)} s and was stopped. `
    + 'Compile again to retry; if it keeps happening, please report it (bug icon).'
  return {
    ok: false,
    storyExt,
    diagnostics: [{ severity: 'fatal', message: msg }],
    rawStderr: msg,
    ms,
    byteLength: 0,
  }
}
